import { useRouter } from 'next/router';
import { useEffect, useState, useMemo, useCallback } from 'react';
// 型名を ChildOrderRecord に変更
import type { ChildOrderRecord, ProjectWithProgress, ProjectDetailApiResponse } from '@/lib/db';
// Chart 関連のインポートは変更なし
import { Chart } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';

ChartJS.register(/* ... */);

// FutureScenario, FixedVolumeScenario, FinalMetrics インターフェースは変更なし

const ProjectDetailPage = () => {
  const router = useRouter();
  const { projectID } = router.query;
  const [data, setData] = useState<ProjectDetailApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [finalMetrics, setFinalMetrics] = useState<FinalMetrics | null>(null);

  // market price 関連の state は変更なし
  const [currentMarketPrice, setCurrentMarketPrice] = useState<number | null>(null);
  const [currentAllDayVWAP, setCurrentAllDayVWAP] = useState<number | null>(null);
  const [marketPriceLoading, setMarketPriceLoading] = useState<boolean>(false);
  const [marketPriceError, setMarketPriceError] = useState<string | null>(null);
  const [priceToAdjustedBenchmarkDeviation, setPriceToAdjustedBenchmarkDeviation] = useState<number | null>(null);

  // sim input state は変更なし
  const [simInputPrice, setSimInputPrice] = useState<string>('');
  const [simInputShares, setSimInputShares] = useState<string>('');
  const [simInputDays, setSimInputDays] = useState<string>('1');

  const [xValueInput, setXValueInput] = useState<string>('0');

  // scenario state は変更なし
  const [futureScenarios, setFutureScenarios] = useState<FutureScenario[]>([]);
  const [fixedVolumeScenarios, setFixedVolumeScenarios] = useState<FixedVolumeScenario[]>([]);
  const simulatedDateLabel = "シミュレーション";

  const [isDailyBreakdownVisible, setIsDailyBreakdownVisible] = useState<boolean>(false);
  const [isHistoryVisible, setIsHistoryVisible] = useState<boolean>(true);

  // データ取得ロジックは変更なし (API側でカラム名変更は吸収される)
  useEffect(() => {
    // ... (fetchProjectDetails)
  }, [projectID, router.isReady]);

  // Ticker に基づく市場データ取得ロジックは変更なし
  useEffect(() => {
    // ... (fetchMarketData)
  }, [data?.project?.Ticker]);

  // ベンチマーク乖離率計算ロジックは変更なし
  useEffect(() => {
    // ... (calculate deviation)
  }, [currentMarketPrice, currentAllDayVWAP, data?.project]);

  // シミュレーション入力の初期値設定ロジックを更新
  useEffect(() => {
    if (data?.project) {
        // stockRecords (実際は ChildOrderRecord[]) を使用
        if (data.stockRecords && data.stockRecords.length > 0) {
            const lastRecord = data.stockRecords[data.stockRecords.length - 1];
            // カラム名を AvgPx, ExecQty に変更
            setSimInputPrice(prev => prev || (lastRecord?.AvgPx?.toString() ?? ''));
            setSimInputShares(prev => prev || (lastRecord?.ExecQty?.toString() ?? ''));
        } else {
            setSimInputPrice(prev => prev || '');
            setSimInputShares(prev => prev || '');
        }
    }
  }, [data]);

  // フォーマット関数は変更なし
  const formatNumber = (/* ... */);
  const formatCurrency = (/* ... */);

  // 計算関数は変更なし (引数の意味は変わらない)
  const calculatePLInBasisPoints = useCallback((/* ... */), []);
  const calculatePriceVsBenchmarkPct = useCallback((/* ... */), []);

  // シナリオ計算関数は変更なし (内部ロジックは API 側で更新済み)
  const calculateFutureScenario = useCallback((/* ... */), [calculatePLInBasisPoints, calculatePriceVsBenchmarkPct]);
  const calculateFixedVolumeScenario = useCallback((/* ... */), [calculatePLInBasisPoints, calculatePriceVsBenchmarkPct]);

  // シナリオ生成ロジックを更新
  useEffect(() => {
    const numFuturePrice = parseFloat(simInputPrice);
    const numSimShares = parseFloat(simInputShares);
    const numMaxDays = parseInt(simInputDays, 10);

    if (data?.project && data.stockRecords && /* ... */) {
        // VwapPx を使用して過去のVWAPリストを作成
        const historicalDailyVwaps = data.stockRecords.map(r => r.VwapPx); // カラム名を VwapPx に変更

        // calculateFutureScenario, calculateFixedVolumeScenario 呼び出しは変更なし
        // ... (シナリオ生成)
    } else {
      setFutureScenarios([]);
      setFixedVolumeScenarios([]);
    }
  }, [simInputPrice, simInputShares, simInputDays, data, calculateFutureScenario, calculateFixedVolumeScenario]);

  // チャートデータ生成ロジックを更新
  const finalChartData = useMemo(() => {
    if (!data) return null;

    const currentProject = data?.project;
    // stockRecords (ChildOrderRecord[]) を使用
    const currentStockRecords = data?.stockRecords || [];
    const numPriceForChart = /* ... */;
    const numSharesForChart = /* ... */;

    const baseLabels = currentStockRecords.map(record => record.Date);
    // カラム名を AvgPx, VwapPx, ExecQty に変更
    const baseAvgPriceData = currentStockRecords.map(record => record.AvgPx);
    const baseDailyVwapData = currentStockRecords.map(record => record.VwapPx);
    const baseBenchmarkTrendData = currentStockRecords.map(record => record.cumulativeBenchmarkVWAP); // これは変更なし
    const baseQtyData = currentStockRecords.map(record => record.ExecQty);
    // ... (以降のチャートデータ構築ロジックは変更なし)
    return {
      labels: chartLabels,
      datasets: [
        { type: 'line' as const, label: '約定平均価格', data: toChartableData(chartAvgPriceData), /* ... */ },
        { type: 'line' as const, label: '当日VWAP', data: toChartableData(chartDailyVwapData), /* ... */ },
        { type: 'line' as const, label: 'ベンチマーク推移', data: toChartableData(chartBenchmarkTrendData), /* ... */ },
        { type: 'bar' as const, label: '約定数量', data: toChartableData(chartQtyData), /* ... */ },
      ],
    };
  }, [data?.project, data?.stockRecords, simInputPrice, simInputShares, simulatedDateLabel]);

  // chartOptions は変更なし

  // 散布図データ生成ロジックを更新
  const scatterChartData = useMemo(() => {
    const records = data?.stockRecords || []; // ChildOrderRecord[]
    const avgPrice = data?.project?.averageExecutionPrice ?? null;
    const avgQty = data?.project?.averageDailyShares ?? null;
    const side = data?.project?.Side;

    const datasets: any[] = [];

    // カラム名を AvgPx, ExecQty に変更
    const points = records.map(record => ({
        x: record.AvgPx,
        y: record.ExecQty,
        date: record.Date
    }));
    // ... (以降の散布図データ構築ロジックは変更なし)
    return { datasets };
  }, [data?.stockRecords, data?.project, simInputPrice, simInputShares, xValueInput]);

  // scatterChartOptions は変更なし

  // --- Render ---
  if (loading && !data) return <p>...</p>;
  if (error) return <p>...</p>;
  if (!data || !data.project) return <p>...</p>;

  const { project, stockRecords } = data; // stockRecords は ChildOrderRecord[]

  // 表示用変数計算は変更なし
  let displayTotalShares = /* ... */;
  let displayTotalAmount = /* ... */;

  // 取引履歴表示用に逆順にするのは変更なし
  const displayChildOrder = [...stockRecords].reverse(); // 変数名を変更

  // 日数計算は変更なし
  const tradedDays = project.tradedDaysCount || 0;
  let daysUntilEarliest = /* ... */;
  let remainingBusinessDays = /* ... */;

  // 残株数計算は変更なし (totalFilledQty は API 側で ExecQty の合計になっているはず)
  let effectiveRemainingTargetShares = /* ... */;
  let sharesCalcStatusMessage = /* ... */;
  let remainingAmount = /* ... */;

  // 目安株数計算は変更なし
  let maxSharesPerDayText = /* ... */;
  let minSharesPerDayText = /* ... */;

  // 日毎内訳計算は変更なし
  let dailySharesBreakdown = /* ... */;
  const canCalculateBreakdown = /* ... */;

  return (
    <div className="space-y-6 pb-12">
      {/* 基本情報、サマリー、損益・手数料、シミュレーション入力欄の表示は変更なし */}
      {/* ... */}

      {/* シナリオテーブル表示は変更なし */}
      {/* ... */}

      {/* チャート表示は変更なし */}
      {/* ... */}

      {/* 取引履歴テーブル */}
      {displayChildOrder && displayChildOrder.length > 0 ? ( // 変数名変更
        <div className="bg-white shadow-md rounded-lg">
          {/* ... (表示/非表示ボタン) */}
          {isHistoryVisible && (
            <div className="overflow-x-auto">
              <table className="min-w-full leading-normal">
                <thead>
                  {/* テーブルヘッダー名を変更 */}
                  <tr className="bg-gray-200 text-gray-600 uppercase text-xs leading-normal">
                    <th className="py-3 px-6 text-left">日付</th>
                    <th className="py-3 px-6 text-right">約定数量(ExecQty)</th>
                    <th className="py-3 px-6 text-right">累積約定株数</th>
                    <th className="py-3 px-6 text-right">約定平均価格(AvgPx)</th>
                    <th className="py-3 px-6 text-right">当日VWAP(VwapPx)</th>
                    <th className="py-3 px-6 text-right">ベンチマーク推移</th>
                    <th className="py-3 px-6 text-right">VWAP Perf. (bps)</th>
                    <th className="py-3 px-6 text-right">P/L (評価損益)</th>
                    <th className="py-3 px-6 text-right">成功報酬額</th>
                    <th className="py-3 px-6 text-right">固定手数料(累積)</th>
                    <th className="py-3 px-6 text-right">P/L (bps)</th>
                    <th className="py-3 px-6 text-right">累積約定金額(円)</th>
                  </tr>
                </thead>
                <tbody className="text-gray-700 text-sm">
                   {/* displayChildOrder を使用 */}
                  {displayChildOrder.map((record, index) => {
                    let performanceFeeAmount = /* ... */; // 変更なし
                    let plBpsDisplay: string | number = /* ... */; // 変更なし (cumulativeFilledQty は ExecQty の累積)
                    return (
                      <tr key={index} /* ... */>
                        {/* カラム名を変更してデータアクセス */}
                        <td className="py-3 px-6 text-left whitespace-nowrap">{record.Date}</td>
                        <td className="py-3 px-6 text-right">{formatNumber(record.ExecQty, 0)}</td>
                        <td className="py-3 px-6 text-right">{formatNumber(record.cumulativeFilledQty, 0, '-')}</td>
                        <td className="py-3 px-6 text-right">{formatNumber(record.AvgPx, 2)}</td>
                        <td className="py-3 px-6 text-right">{formatNumber(record.VwapPx, 2)}</td>
                        <td className="py-3 px-6 text-right">{formatNumber(record.cumulativeBenchmarkVWAP, 2, '-')}</td>
                        <td className="py-3 px-6 text-right">{formatNumber(record.vwapPerformanceBps, 2, '-')}</td>
                        <td /* ... */>{formatCurrency(record.dailyPL, '-')}</td>
                        <td /* ... */>{formatCurrency(performanceFeeAmount, /* ... */)}</td>
                        <td className="py-3 px-6 text-right">{formatCurrency(record.cumulativeFixedFee, '-')}</td>
                        <td className="py-3 px-6 text-right">{plBpsDisplay}</td>
                        <td className="py-3 px-6 text-right">{formatCurrency(record.cumulativeFilledAmount, '-')}</td>
                      </tr>);
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : ( /* ... */)}
    </div>
  );
};

export default ProjectDetailPage;