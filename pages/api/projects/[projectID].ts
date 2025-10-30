// pages/api/projects/[projectID].ts
import type { NextApiRequest, NextApiResponse } from 'next';
// ChildOrderRecord と Project をインポート、ProjectWithProgress, ProjectDetailApiResponse も
import { getDb, Project, ChildOrderRecord, ProjectWithProgress, ProjectDetailApiResponse } from '@/lib/db';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ProjectDetailApiResponse | { message: string }>
) {
  const { projectID } = req.query; // これは Project テーブルの ProjectID を指す

  if (typeof projectID !== 'string') {
    res.status(400).json({ message: 'Invalid ProjectID' });
    return;
  }

  try {
    const db = await getDb();
    // Project テーブルの取得は変更なし
    const projectData = await db.get<Project>(
      'SELECT * FROM projects WHERE ProjectID = ?',
      projectID
    );

    if (!projectData) {
      res.status(404).json({ message: 'Project not found' });
      return;
    }

    // ChildOrder テーブルからデータを取得するように変更
    let rawChildOrder: Omit<ChildOrderRecord, 'cumulativeBenchmarkVWAP' | 'vwapPerformanceBps' | 'cumulativeFilledAmount' | 'cumulativeFilledQty' | 'dailyPL' | 'cumulativeFixedFee'>[] = [];
    if (projectData.ProjectID) { // Project テーブルの ProjectID をキーにする
      // テーブル名とカラム名を変更
      rawChildOrder = await db.all<any[]>(
        'SELECT * FROM ChildOrder WHERE ParentOrderId = ?', // テーブル名と WHERE句のカラム名を変更
        projectData.ProjectID
      );

      // ソートは変更なし
      rawChildOrder.sort((a, b) => {
        const dateA = new Date(a.Date.replace(/\//g, '-'));
        const dateB = new Date(b.Date.replace(/\//g, '-'));
        return dateA.getTime() - dateB.getTime();
      });
    }

    const distinctDailyVWAPsEncountered = new Map<string, number>();
    let sumOfDistinctVWAPsForBenchmark = 0;
    let countOfDistinctDaysForBenchmark = 0;
    let currentCumulativeFilledAmount = 0;
    let currentCumulativeFilledQty = 0; // cumulativeExecQty とすべきかもしれないが、影響範囲を考慮
    let currentCumulativeFixedFee = 0;
    const fixedFeeRate = projectData.Fixed_Fee_Rate;

    // ChildOrderRecord 配列として処理するように変更
    const processedChildOrder: ChildOrderRecord[] = rawChildOrder.map(rawRecord => {
      // カラム名を変更 (ExecQty, AvgPx, VwapPx)
      const recordExecQty = typeof rawRecord.ExecQty === 'number' ? rawRecord.ExecQty : null;
      const recordAvgPx = typeof rawRecord.AvgPx === 'number' ? rawRecord.AvgPx : null;
      const recordVwapPx = typeof rawRecord.VwapPx === 'number' ? rawRecord.VwapPx : null;

      // 日付ごとのVWAP (VwapPx) を使用
      if (!distinctDailyVWAPsEncountered.has(rawRecord.Date) && recordVwapPx !== null) {
        distinctDailyVWAPsEncountered.set(rawRecord.Date, recordVwapPx);
        sumOfDistinctVWAPsForBenchmark += recordVwapPx;
        countOfDistinctDaysForBenchmark++;
      }
      const currentProjectBenchmarkVWAP = (countOfDistinctDaysForBenchmark > 0)
        ? (sumOfDistinctVWAPsForBenchmark / countOfDistinctDaysForBenchmark)
        : null;

      let vwapPerfBps: number | null = null;
      // 計算に AvgPx と VwapPx を使用
      if (recordAvgPx != null && recordVwapPx != null && recordVwapPx !== 0) {
        if (projectData.Side === 'BUY') {
          vwapPerfBps = ((recordVwapPx - recordAvgPx) / recordVwapPx) * 10000;
        } else if (projectData.Side === 'SELL') {
          vwapPerfBps = ((recordAvgPx - recordVwapPx) / recordVwapPx) * 10000;
        }
      }

      let dailyFilledAmount = 0;
      // 計算に ExecQty と AvgPx を使用
      if (recordExecQty != null && recordAvgPx != null) {
        dailyFilledAmount = recordExecQty * recordAvgPx;
      }
      currentCumulativeFilledAmount += dailyFilledAmount;

      // ExecQty を使用
      if (recordExecQty != null) {
        currentCumulativeFilledQty += recordExecQty;
      }

      let dailyFixedFee = 0;
      if (fixedFeeRate !== null && fixedFeeRate > 0 && dailyFilledAmount > 0) {
          dailyFixedFee = dailyFilledAmount * (fixedFeeRate / 100);
      }
      currentCumulativeFixedFee += dailyFixedFee;

      let dailyPL: number | null = null;
      if (currentProjectBenchmarkVWAP != null &&
          currentCumulativeFilledQty > 0 &&
          currentCumulativeFilledAmount != null &&
          (projectData.Side === 'BUY' || projectData.Side === 'SELL') ) {
        if (projectData.Side === 'BUY') {
          dailyPL = (currentProjectBenchmarkVWAP * currentCumulativeFilledQty) - currentCumulativeFilledAmount;
        } else {
          dailyPL = currentCumulativeFilledAmount - (currentProjectBenchmarkVWAP * currentCumulativeFilledQty);
        }
      } else if (currentCumulativeFilledQty === 0) {
          dailyPL = 0;
      }

      // 戻り値のオブジェクトのカラム名を変更
      return {
        ...rawRecord, // 元のデータ（ParentOrderId などが含まれる）
        ExecQty: recordExecQty ?? 0,
        AvgPx: recordAvgPx ?? 0,
        VwapPx: recordVwapPx ?? 0,
        // 以下は計算結果フィールドなので名前は変更しない
        cumulativeBenchmarkVWAP: currentProjectBenchmarkVWAP,
        vwapPerformanceBps: vwapPerfBps,
        cumulativeFilledAmount: currentCumulativeFilledAmount,
        cumulativeFilledQty: currentCumulativeFilledQty,
        dailyPL: dailyPL,
        cumulativeFixedFee: currentCumulativeFixedFee > 0 ? currentCumulativeFixedFee : null,
      } as ChildOrderRecord; // 型を ChildOrderRecord に変更
    });

    // 変数名は filledQty/Amount のままでも良いが、意味的には Exec の方が正しい
    const finalTotalProjectFilledQty = currentCumulativeFilledQty;
    const finalTotalProjectFilledAmount = currentCumulativeFilledAmount;
    const overallProjectBenchmarkVWAPToDisplay = (countOfDistinctDaysForBenchmark > 0)
        ? (sumOfDistinctVWAPsForBenchmark / countOfDistinctDaysForBenchmark)
        : null;

    // P/L計算部分は変更なし (ロジックは同じ)
    let finalPL: number | null = null;
    if (overallProjectBenchmarkVWAPToDisplay !== null && finalTotalProjectFilledQty > 0) {
        if (projectData.Side === 'BUY') {
            finalPL = (overallProjectBenchmarkVWAPToDisplay * finalTotalProjectFilledQty) - finalTotalProjectFilledAmount;
        } else { // SELL
            finalPL = finalTotalProjectFilledAmount - (overallProjectBenchmarkVWAPToDisplay * finalTotalProjectFilledQty);
        }
    }

    let finalPerformanceFee: number | null = null;
    const perfFeeRate = projectData.Performance_Based_Fee_Rate;
    if (finalPL !== null && finalPL > 0 && perfFeeRate !== null) {
        finalPerformanceFee = finalPL * (perfFeeRate / 100);
    }

    const finalFixedFee = currentCumulativeFixedFee > 0 ? currentCumulativeFixedFee : null;

    let finalPLBps: number | null = null;
    if (finalPL !== null && overallProjectBenchmarkVWAPToDisplay !== null && overallProjectBenchmarkVWAPToDisplay > 0 && finalTotalProjectFilledQty > 0) {
        const denominator = overallProjectBenchmarkVWAPToDisplay * finalTotalProjectFilledQty;
        if(denominator !== 0) finalPLBps = (finalPL / denominator) * 10000;
    }

    // 進捗計算部分は変更なし (ロジックは同じ)
    let daysProgress = 0;
    const currentTradedDaysCount = distinctDailyVWAPsEncountered.size;
    if (projectData.Business_Days && projectData.Business_Days > 0) {
        daysProgress = (currentTradedDaysCount / projectData.Business_Days) * 100;
    }

    let executionProgress = 0;
    if (projectData.Total_Shares !== null && projectData.Total_Shares > 0) {
      executionProgress = (finalTotalProjectFilledQty / projectData.Total_Shares) * 100;
    }
    else if (projectData.Total_Amount !== null && projectData.Total_Amount > 0) {
      executionProgress = (finalTotalProjectFilledAmount / projectData.Total_Amount) * 100;
    }

    let averageExecutionPrice: number | null = null;
    if (finalTotalProjectFilledQty > 0) {
        averageExecutionPrice = finalTotalProjectFilledAmount / finalTotalProjectFilledQty;
    }
    let averageDailyShares: number | null = null;
    if (currentTradedDaysCount > 0) {
        averageDailyShares = finalTotalProjectFilledQty / currentTradedDaysCount;
    }

    // ProjectWithProgress の totalFilledQty/Amount は変数名変更しない方が影響少ないか？
    const projectWithProgressData: ProjectWithProgress = {
      ...projectData,
      daysProgress: Math.min(100, Math.max(0, daysProgress)),
      executionProgress: Math.min(100, Math.max(0, executionProgress)),
      totalFilledQty: finalTotalProjectFilledQty,
      totalFilledAmount: finalTotalProjectFilledAmount,
      tradedDaysCount: currentTradedDaysCount,
      benchmarkVWAP: overallProjectBenchmarkVWAPToDisplay,
      averageExecutionPrice: averageExecutionPrice,
      averageDailyShares: averageDailyShares,
    };

    // レスポンスのキー名を stockRecords から childOrder に変更するか検討
    res.status(200).json({
        project: projectWithProgressData,
        stockRecords: processedChildOrder, // キー名は stockRecords のまま or childOrder に変更
        finalPL,
        finalPerformanceFee,
        finalFixedFee,
        finalPLBps
    });

  } catch (error) {
    console.error(`Error fetching project details for ${projectID}:`, error);
    res.status(500).json({ message: 'Error fetching project details' });
  }
}