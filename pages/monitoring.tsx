// pages/monitoring.tsx
import { useEffect, useState } from 'react';
// ★ ProjectWithProgress をインポート
import type { ProjectWithProgress } from '@/lib/db'; 
import useSWR from 'swr';

// fetcher 関数 (変更なし)
const fetcher = (url: string) => fetch(url).then(res => {
    if (!res.ok) {
        throw new Error('An error occurred while fetching the data.');
    }
    return res.json();
});

// ★ MarketData インターフェースを更新
interface MarketData {
  ticker: string;
  price: number | null;
  allDayVWAP: number | null;
  chgPct1d: number | null; // ★ 1日% を追加
  error?: string;
  isLoading: boolean;
  name: string;
  projectID: string | null;
  side: 'BUY' | 'SELL';
  // ▼▼▼ 乖離率計算用にプロジェクトの過去実績を追加 ▼▼▼
  benchmarkVWAP: number | null; // 過去のVWAP平均
  tradedDaysCount: number;     // 過去の取引日数
}

const MonitoringPage = () => {
  // ★ /api/projects から ProjectWithProgress[] を取得するように変更
  const { data: projectsWithProgress, error: projectsError } = useSWR<ProjectWithProgress[]>('/api/projects', fetcher);
  
  const [marketData, setMarketData] = useState<MarketData[]>([]);
  const [loadingMarketData, setLoadingMarketData] = useState(true);

  useEffect(() => {
    // ★ projectsWithProgress を使用
    if (projectsWithProgress) {
      const fetchAllMarketData = async () => {
        setLoadingMarketData(true);
        // ★ プロジェクト情報 (benchmarkVWAP, tradedDaysCount も) を抽出
        const projectTickers = projectsWithProgress
          .filter(p => p.Ticker)
          .map(p => ({ 
              ticker: p.Ticker, 
              name: p.Name, 
              projectID: p.ProjectID,
              side: p.Side,
              benchmarkVWAP: p.benchmarkVWAP || null, // 過去のVWAP平均
              tradedDaysCount: p.tradedDaysCount || 0, // 過去の取引日数
          }));

        // 各ティッカーの市場データを並行して取得
        const dataPromises = projectTickers.map(async (p) => {
          try {
            // ★ APIは chgPct1d も返すようになっている
            const res = await fetch(`/api/fetch-market-price?ticker=${encodeURIComponent(p.ticker)}`);
            if (!res.ok) {
              const errorData = await res.json().catch(() => ({}));
              throw new Error(errorData.error || `Failed: ${res.statusText}`);
            }
            const marketData = await res.json();
            if (marketData.error) {
              throw new Error(marketData.error);
            }
            return {
              ticker: p.ticker,
              price: marketData.price,
              allDayVWAP: marketData.allDayVWAP,
              chgPct1d: marketData.chgPct1d, // ★ 追加
              isLoading: false,
              name: p.name,
              projectID: p.projectID,
              side: p.side,
              benchmarkVWAP: p.benchmarkVWAP, // ★ コピー
              tradedDaysCount: p.tradedDaysCount, // ★ コピー
            };
          } catch (e: any) {
            return {
              ticker: p.ticker,
              price: null,
              allDayVWAP: null,
              chgPct1d: null, // ★ 追加
              error: e.message,
              isLoading: false,
              name: p.name,
              projectID: p.projectID,
              side: p.side,
              benchmarkVWAP: p.benchmarkVWAP, // ★ コピー
              tradedDaysCount: p.tradedDaysCount, // ★ コピー
            };
          }
        });

        const results = await Promise.all(dataPromises);
        setMarketData(results);
        setLoadingMarketData(false);
      };

      fetchAllMarketData();
      
      // 5分ごとにデータを自動更新
      const interval = setInterval(fetchAllMarketData, 300000); // 300000ms = 5分
      return () => clearInterval(interval); // クリーンアップ
      
    } else if (projectsError) {
      setLoadingMarketData(false);
    }
  }, [projectsWithProgress, projectsError]); // ★ 依存配列を変更

  const formatPrice = (price: number | null, fractionDigits = 2) => {
    if (price === null) return <span className="text-gray-500">N/A</span>;
    return price.toLocaleString(undefined, { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits });
  };
  
  // ★ 1日% フォーマット用関数
  const formatPercent = (pct: number | null) => {
    if (pct === null) return <span className="text-gray-500">N/A</span>;
    const colorClass = pct > 0 ? 'text-green-600' : pct < 0 ? 'text-red-600' : 'text-gray-700';
    return (
        <span className={`font-medium ${colorClass}`}>
            {pct.toFixed(2)}%
        </span>
    );
  };

  // ★ 乖離率計算ロジックをプロジェクト詳細ページのものに変更
  const calculateAdjustedDeviation = (data: MarketData) => {
    const { price, allDayVWAP, side, benchmarkVWAP, tradedDaysCount } = data;

    // 現在価格または当日VWAPがなければ計算不可
    if (price === null || allDayVWAP === null) {
      return <span className="text-gray-500">N/A</span>;
    }

    // --- ここから詳細ページと同じロジック ---
    let newAdjustedBenchmark: number | null = null;
    const currentTradedDaysCount = tradedDaysCount || 0;
    const historicalSum = (benchmarkVWAP !== null && currentTradedDaysCount > 0) ? benchmarkVWAP * currentTradedDaysCount : 0;

    if (currentTradedDaysCount === 0) {
        // 過去の取引がなければ、当日VWAPがベンチマーク
        newAdjustedBenchmark = allDayVWAP;
    } else {
        // 過去の取引があれば、当日VWAPも加えて平均
        newAdjustedBenchmark = (historicalSum + allDayVWAP) / (currentTradedDaysCount + 1);
    }
    // --- ここまで ---
    
    let deviation: number | null = null;
    if (newAdjustedBenchmark !== null && newAdjustedBenchmark !== 0) {
      if (side === 'SELL') {
        deviation = ((price - newAdjustedBenchmark) / newAdjustedBenchmark) * 10000; // bps
      } else if (side === 'BUY') {
        deviation = ((newAdjustedBenchmark - price) / newAdjustedBenchmark) * 10000; // bps
      }
    }

    if (deviation === null) {
      return <span className="text-gray-500">N/A</span>;
    }
    
    const colorClass = deviation >= 0 ? 'text-green-600' : 'text-red-600';
    return (
      <span className={`font-medium ${colorClass}`}>
        {deviation.toFixed(1)} bps
      </span>
    );
  };

  const getStatusIndicator = (data: MarketData) => {
    if (data.isLoading) {
      return <span className="animate-pulse text-gray-400">Loading...</span>;
    }
    if (data.error) {
      return <span className="text-red-500" title={data.error}>Error</span>;
    }
    if (data.price !== null) {
      return <span className="text-green-500">OK</span>;
    }
    return <span className="text-gray-500">N/A</span>;
  };

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6 text-gray-800">
        リアルタイム モニタリング
        {(loadingMarketData || projectsError) && (
            <span className="text-sm font-normal text-gray-500 ml-4">
                {projectsError ? 'プロジェクト読込エラー' : 'データ読込中...'}
            </span>
        )}
      </h1>

      {projectsError && (
        <p className="text-center text-red-500">プロジェクトの読み込みに失敗しました: {projectsError.message}</p>
      )}

      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        <table className="min-w-full leading-normal">
          <thead>
            <tr className="bg-gray-200 text-gray-600 uppercase text-xs leading-normal">
              <th className="py-3 px-4 text-left">Project ID</th>
              <th className="py-3 px-4 text-left">銘柄名</th>
              <th className="py-3 px-4 text-left">Ticker</th>
              <th className="py-3 px-4 text-left">Side</th>
              <th className="py-3 px-4 text-right">現在株価 (PX_LAST)</th>
              <th className="py-3 px-4 text-right">1日％ (CHG_PCT_1D)</th> {/* ★ 追加 */}
              <th className="py-3 px-4 text-right">当日VWAP (ALL_DAY_VWAP)</th>
              <th className="py-3 px-4 text-right">乖離 (bps) (vs 修正BM)</th> {/* ★ ヘッダー名修正 */}
              <th className="py-3 px-4 text-center">ステータス</th>
            </tr>
          </thead>
          <tbody className="text-gray-700 text-sm">
            {marketData.length > 0 ? (
              marketData.map((data, index) => (
                <tr key={`${data.projectID}-${data.ticker}-${index}`} className="border-b border-gray-200 hover:bg-gray-100">
                  <td className="py-3 px-4 text-left whitespace-nowrap">{data.projectID || 'N/A'}</td>
                  <td className="py-3 px-4 text-left">{data.name}</td>
                  <td className="py-3 px-4 text-left whitespace-nowrap">{data.ticker}</td>
                  <td className="py-3 px-4 text-left">
                     <span className={`px-2 py-1 rounded-full text-xs font-semibold
                      ${data.side === 'BUY' ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'}`}>
                      {data.side}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right font-medium">{formatPrice(data.price, 2)}</td>
                  <td className="py-3 px-4 text-right">{formatPercent(data.chgPct1d)}</td> {/* ★ 追加 */}
                  <td className="py-3 px-4 text-right font-medium">{formatPrice(data.allDayVWAP, 2)}</td>
                  <td className="py-3 px-4 text-right">
                    {calculateAdjustedDeviation(data)} {/* ★ 関数呼び出し変更 */}
                  </td>
                  <td className="py-3 px-4 text-center text-xs">
                    {getStatusIndicator(data)}
                  </td>
                </tr>
              ))
            ) : (
              !loadingMarketData && !projectsError && (
                <tr>
                  <td colSpan={9} className="py-4 text-center text-gray-500"> {/* ★ colSpan 変更 */}
                    {projectsWithProgress ? 'モニタリング対象のプロジェクトが見つかりません。' : 'プロジェクトを読み込み中...'} {/* ★ 変数名変更 */}
                  </td>
                </tr>
              )
            )}
            {loadingMarketData && marketData.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-4 text-center text-gray-500"> {/* ★ colSpan 変更 */}
                    市場データを読み込み中...
                  </td>
                </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default MonitoringPage;