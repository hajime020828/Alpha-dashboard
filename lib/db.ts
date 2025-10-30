// lib/db.ts
import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';

let db: Database | null = null;

export async function getDb() {
  if (!db) {
    const dbPath = path.join(process.cwd(), 'VWAP_Alpha.db'); // DBファイル名を確認
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    // テーブル名変更の反映（初回のみ、またはマイグレーションとして）
    // await db.exec('ALTER TABLE stock_records RENAME TO ChildOrder').catch(e => console.log("Rename failed or already done:", e.message));
    // カラム名変更の反映（SQLiteはカラム名変更が複雑なため、ここではコメントアウト。別途マイグレーション推奨）
    // await db.exec('ALTER TABLE ChildOrder RENAME COLUMN ProjectID TO ParentOrderId').catch(e => console.log("Rename failed or already done:", e.message));
    // ...他のカラムも同様
  }
  return db;
}

export interface Project {
  internal_id: number;
  ProjectID: string | null; // 親注文IDとして使用される場合があるため残す
  Ticker: string;
  Name: string;
  Side: 'BUY' | 'SELL';
  Total_Shares: number | null;
  Total_Amount: number | null;
  Start_Date: string;
  End_Date: string;
  Price_Limit: number | null;
  Performance_Based_Fee_Rate: number | null;
  Fixed_Fee_Rate: number | null;
  Business_Days: number | null;
  Earliest_Day_Count: number | null;
  Excluded_Days: number | null;
  Note: string | null;
  TS_Contact: string;
}

// StockRecord -> ChildOrderRecord に変更し、カラム名を更新
export interface ChildOrderRecord {
  // StockCycle: string; // 削除
  ParentOrderId: string; // ProjectID から変更
  ExecQty: number; // FilledQty から変更
  AvgPx: number; // FilledAveragePrice から変更
  VwapPx: number; // ALL_DAY_VWAP から変更
  Date: string;
  // Benchmark カラムはフロントエンド計算のためここでは不要

  // フロントエンド計算用に追加される可能性のあるフィールド（変更なし）
  cumulativeBenchmarkVWAP: number | null;
  vwapPerformanceBps: number | null;
  cumulativeFilledAmount: number | null;
  cumulativeFilledQty: number | null; // ExecQty の累積だが、フィールド名は変更しない方が影響範囲が少ない可能性
  dailyPL: number | null;
  cumulativeFixedFee: number | null;
}

// 既存の型名も残すか検討 (影響範囲による)
export type StockRecord = ChildOrderRecord;

export interface ProjectWithProgress extends Project {
  daysProgress: number;
  executionProgress: number;
  totalFilledQty?: number;
  totalFilledAmount?: number;
  tradedDaysCount?: number;
  benchmarkVWAP: number | null;
  averageExecutionPrice: number | null;
  averageDailyShares: number | null;
}

// ProjectDetailApiResponse 内の StockRecord も ChildOrderRecord に変更
export interface ProjectDetailApiResponse {
  project: ProjectWithProgress | undefined;
  stockRecords: ChildOrderRecord[]; // ここを変更
  finalPL: number | null;
  finalPerformanceFee: number | null;
  finalFixedFee: number | null;
  finalPLBps: number | null;
}

// 重複定義を削除 (前の定義に含まれているため)
// export interface ProjectDetailApiResponse {
//   project: ProjectWithProgress | undefined;
//   stockRecords: ChildOrderRecord[]; // ここを変更
// }