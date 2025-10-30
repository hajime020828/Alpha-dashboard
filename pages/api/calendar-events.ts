// pages/api/calendar-events.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getDb, CalendarEventDb } from '@/lib/db';

type ApiEventInput = {
  id?: number; // 編集(PUT)の際に使用
  title: string;
  start: string; // ISO String from client
  end: string;   // ISO String from client
  allDay: boolean;
  color?: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<CalendarEventDb[] | CalendarEventDb | { message: string }>
) {
  const db = await getDb();
  const tableName = 'calendar_events';

  if (req.method === 'GET') {
    // すべての予定を取得
    try {
      const events = await db.all<CalendarEventDb[]>(`SELECT * FROM ${tableName}`);
      res.status(200).json(events);
    } catch (error: any) {
      console.error(`Failed to fetch ${tableName}:`, error);
      res.status(500).json({ message: `Failed to fetch ${tableName}: ${error.message}` });
    }
  } 
  
  else if (req.method === 'POST') {
    // 新しい予定を追加
    try {
      const { title, start, end, allDay, color }: ApiEventInput = req.body;

      if (!title || !start || !end) {
        return res.status(400).json({ message: 'Missing required fields (title, start, end)' });
      }

      const stmt = await db.prepare(
        `INSERT INTO ${tableName} (title, start_date, end_date, allDay, color)
         VALUES (?, ?, ?, ?, ?)`
      );
      const allDayInt = allDay ? 1 : 0;
      
      const result = await stmt.run(title, start, end, allDayInt, color || null);
      await stmt.finalize();

      if (result.lastID) {
        const newEvent = await db.get<CalendarEventDb>(`SELECT * FROM ${tableName} WHERE id = ?`, result.lastID);
        res.status(201).json(newEvent!);
      } else {
        res.status(500).json({ message: 'Failed to insert event, no lastID returned.' });
      }
    } catch (error: any) {
      console.error(`Failed to insert ${tableName}:`, error);
      res.status(500).json({ message: `Failed to insert ${tableName}: ${error.message}` });
    }
  } 
  
  // ▼▼▼ 【ここから追加】 ▼▼▼
  else if (req.method === 'PUT') {
    // 既存の予定を編集
    try {
      const { id, title, start, end, allDay, color }: ApiEventInput = req.body;

      if (!id || !title || !start || !end) {
        return res.status(400).json({ message: 'Missing required fields (id, title, start, end)' });
      }

      const stmt = await db.prepare(
        `UPDATE ${tableName} 
         SET title = ?, start_date = ?, end_date = ?, allDay = ?, color = ?
         WHERE id = ?`
      );
      
      const allDayInt = allDay ? 1 : 0;
      
      await stmt.run(title, start, end, allDayInt, color || null, id);
      await stmt.finalize();

      const updatedEvent = await db.get<CalendarEventDb>(`SELECT * FROM ${tableName} WHERE id = ?`, id);
      if (updatedEvent) {
        res.status(200).json(updatedEvent);
      } else {
        res.status(404).json({ message: `Event with id ${id} not found after update.` });
      }
    } catch (error: any) {
      console.error(`Failed to update ${tableName}:`, error);
      res.status(500).json({ message: `Failed to update ${tableName}: ${error.message}` });
    }
  } 
  
  else if (req.method === 'DELETE') {
    // 既存の予定を削除
    try {
      const { id } = req.query; // クエリパラメータから id を取得 (例: /api/calendar-events?id=123)

      if (!id || typeof id !== 'string') {
        return res.status(400).json({ message: 'Missing required query parameter: id' });
      }
      
      const numericId = parseInt(id, 10);
      if (isNaN(numericId)) {
        return res.status(400).json({ message: 'ID must be a number.' });
      }

      const stmt = await db.prepare(`DELETE FROM ${tableName} WHERE id = ?`);
      const result = await stmt.run(numericId);
      await stmt.finalize();

      if (result.changes && result.changes > 0) {
        res.status(200).json({ message: `Event with id ${numericId} deleted successfully.` });
      } else {
        res.status(404).json({ message: `Event with id ${numericId} not found.` });
      }
    } catch (error: any) {
      console.error(`Failed to delete ${tableName}:`, error);
      res.status(500).json({ message: `Failed to delete ${tableName}: ${error.message}` });
    }
  }
  // ▲▲▲ 【ここまで追加】 ▲▲▲
  
  else {
    res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']); // 許可メソッドに追加
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}