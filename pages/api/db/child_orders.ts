// pages/api/db/child_orders.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getDb, ChildOrderRecord } from '@/lib/db'; // インターフェース名を変更

// インターフェース名を変更し、カラム名を更新
interface ChildOrderForApi extends Pick<ChildOrderRecord, 'ParentOrderId' | 'ExecQty' | 'AvgPx' | 'VwapPx' | 'Date'> {
  rowid?: number;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ChildOrderForApi[] | ChildOrderForApi | { message: string } | { error: string }>
) {
  const db = await getDb();
  const tableName = 'ChildOrder'; // テーブル名を変数化

  if (req.method === 'GET') {
    try {
      // カラム名とテーブル名を更新
      const records = await db.all<ChildOrderForApi[]>(
        `SELECT ROWID as rowid, ParentOrderId, ExecQty, AvgPx, VwapPx, Date FROM ${tableName} ORDER BY Date DESC, ParentOrderId ASC`
      );
      res.status(200).json(records);
    } catch (error: any) {
      console.error(`Failed to fetch ${tableName} table:`, error);
      res.status(500).json({ message: `Failed to fetch ${tableName} table: ${error.message}` });
    }
  } else if (req.method === 'POST') {
    try {
      // カラム名を更新
      const {
        ParentOrderId, ExecQty, AvgPx, VwapPx, Date
      }: ChildOrderForApi = req.body;

      // バリデーションのカラム名を更新
      if (!ParentOrderId || !Date || ExecQty === undefined || AvgPx === undefined || VwapPx === undefined) {
        return res.status(400).json({ error: 'Missing required fields for child order record' });
      }

      // カラム名とテーブル名を更新
      const stmt = await db.prepare(
        `INSERT INTO ${tableName} (
          ParentOrderId, ExecQty, AvgPx, VwapPx, Date
        ) VALUES (?, ?, ?, ?, ?)` // StockCycle を削除
      );

      // カラム名を更新
      const result = await stmt.run(
        ParentOrderId, Number(ExecQty), Number(AvgPx), Number(VwapPx), Date
      );
      await stmt.finalize();

      if (result.lastID) {
         // カラム名とテーブル名を更新
         const newRecord = await db.get<ChildOrderForApi>(
           `SELECT ROWID as rowid, ParentOrderId, ExecQty, AvgPx, VwapPx, Date FROM ${tableName} WHERE ROWID = ?`,
           result.lastID
          );
        if (newRecord) {
            res.status(201).json(newRecord);
        } else {
            res.status(500).json({ message: `Failed to retrieve the newly inserted ${tableName} record.`})
        }
      } else {
        res.status(500).json({ message: `Failed to insert ${tableName} record, no lastID returned` });
      }
    } catch (error: any) {
      console.error(`Failed to insert ${tableName} record:`, error);
      res.status(500).json({ message: `Failed to insert ${tableName} record: ${error.message}` });
    }
  } else if (req.method === 'PUT') {
    try {
        // カラム名を更新
        const {
            rowid, ParentOrderId, ExecQty, AvgPx, VwapPx, Date
        }: ChildOrderForApi = req.body;

        if (rowid === undefined) {
            return res.status(400).json({ error: `rowid is required for updating ${tableName} record.` });
        }
        // バリデーションのカラム名を更新
        if (!ParentOrderId || !Date || ExecQty === undefined || AvgPx === undefined || VwapPx === undefined) {
            return res.status(400).json({ error: `Missing required fields for ${tableName} record update.` });
        }

        // カラム名とテーブル名を更新
        const stmt = await db.prepare(
            `UPDATE ${tableName} SET
                ParentOrderId = ?, ExecQty = ?, AvgPx = ?, VwapPx = ?, Date = ?
             WHERE ROWID = ?` // StockCycle を削除
        );
        // カラム名を更新
        await stmt.run(
            ParentOrderId, Number(ExecQty), Number(AvgPx),
            Number(VwapPx), Date, rowid
        );
        await stmt.finalize();

        // カラム名とテーブル名を更新
        const updatedRecord = await db.get<ChildOrderForApi>(
          `SELECT ROWID as rowid, ParentOrderId, ExecQty, AvgPx, VwapPx, Date FROM ${tableName} WHERE ROWID = ?`,
           rowid
        );
        if (updatedRecord) {
            res.status(200).json(updatedRecord);
        } else {
            res.status(404).json({ message: `${tableName} record with rowid ${rowid} not found after update.`})
        }
    } catch (error: any) {
        console.error(`Failed to update ${tableName} record:`, error);
        res.status(500).json({ message: `Failed to update ${tableName} record: ${error.message}` });
    }
  } else if (req.method === 'DELETE') {
    try {
        const { rowid } = req.query;
        if (!rowid || typeof rowid !== 'string') {
            return res.status(400).json({ message: 'rowid (as a query parameter) is required for deleting.' });
        }
        const numericRowId = parseInt(rowid, 10);
        if (isNaN(numericRowId)) {
            return res.status(400).json({ message: 'rowid must be a valid number.'});
        }

        // テーブル名を更新
        const stmt = await db.prepare(`DELETE FROM ${tableName} WHERE ROWID = ?`);
        const result = await stmt.run(numericRowId);
        await stmt.finalize();

        if (result.changes && result.changes > 0) {
            res.status(200).json({ message: `${tableName} record with rowid ${numericRowId} deleted successfully.`});
        } else {
            res.status(404).json({ message: `${tableName} record with rowid ${numericRowId} not found or not deleted.`});
        }
    } catch (error: any) {
        console.error(`Failed to delete ${tableName} record:`, error);
        res.status(500).json({ message: `Failed to delete ${tableName} record: ${error.message}`});
    }
  }
  else {
    res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}