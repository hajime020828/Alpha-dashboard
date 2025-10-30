// pages/api/projects.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getDb, Project, ProjectWithProgress } from '@/lib/db';

// カラム名を更新
interface AggregatedOrderData {
  ParentOrderId: string; // ProjectID から変更
  totalExecQty: number | null; // totalFilledQty から変更
  totalExecAmount: number | null; // totalFilledAmount から変更 (ExecQty * AvgPx の合計)
  tradedDaysCount: number;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ProjectWithProgress[] | { message: string }>
) {
  try {
    const db = await getDb();
    // Projectテーブル取得は変更なし
    const projects = await db.all<Project[]>('SELECT * FROM projects');

    // ChildOrder テーブルから集計するように変更、カラム名も変更
    const aggregatedOrderDataArray = await db.all<AggregatedOrderData[]>(`
      SELECT
        ParentOrderId,
        SUM(ExecQty) as totalExecQty,
        SUM(ExecQty * AvgPx) as totalExecAmount, -- 計算式を変更
        COUNT(DISTINCT Date) as tradedDaysCount
      FROM ChildOrder -- テーブル名を変更
      GROUP BY ParentOrderId -- グループ化キーを変更
    `);

    // Map のキーと型名を変更
    const orderDataMap = new Map<string, AggregatedOrderData>();
    aggregatedOrderDataArray.forEach(record => {
      // ParentOrderId で Map に格納
      if (record.ParentOrderId) {
        orderDataMap.set(record.ParentOrderId, record);
      }
    });

    const projectsWithProgress: ProjectWithProgress[] = projects.map(p => {
      // Map から取得するキーを ProjectID (projects テーブルの) にする
      const projectOrderData = p.ProjectID ? orderDataMap.get(p.ProjectID) : undefined;

      // 日数進捗は変更なし
      const currentTradedDaysCount = projectOrderData?.tradedDaysCount || 0;
      let daysProgress = 0;
      if (p.Business_Days && p.Business_Days > 0) {
        daysProgress = (currentTradedDaysCount / p.Business_Days) * 100;
      }

      let executionProgress = 0;
      // 集計結果のカラム名を使用 (totalExecQty, totalExecAmount)
      const currentTotalExecQty = projectOrderData?.totalExecQty || 0;
      const currentTotalExecAmount = projectOrderData?.totalExecAmount || 0;

      // 進捗計算ロジックは変更なし
      if (p.Total_Shares !== null && p.Total_Shares > 0) {
          executionProgress = (currentTotalExecQty / p.Total_Shares) * 100;
      }
      else if (p.Total_Amount !== null && p.Total_Amount > 0) {
          executionProgress = (currentTotalExecAmount / p.Total_Amount) * 100;
      }

      // 戻り値のオブジェクトのキー名を totalFilledQty/Amount のままにするか検討
      return {
        ...p,
        daysProgress: Math.min(100, Math.max(0, daysProgress)),
        executionProgress: Math.min(100, Math.max(0, executionProgress)),
        totalFilledQty: currentTotalExecQty, // totalExecQty だがキー名は変更しない
        totalFilledAmount: currentTotalExecAmount, // totalExecAmount だがキー名は変更しない
        tradedDaysCount: currentTradedDaysCount,
        // 以下はここでは計算しないので変更なし
        benchmarkVWAP: null,
        averageExecutionPrice: null,
        averageDailyShares: null,
      };
    });

    res.status(200).json(projectsWithProgress);
  } catch (error) {
    console.error('Error fetching projects with progress:', error);
    res.status(500).json({ message: 'Error fetching projects with progress' });
  }
}