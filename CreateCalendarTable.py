import sqlite3
import os

# データベースファイルの絶対パス
db_path = r'C:\Alpha-Dash-main\VWAP_Alpha.db'

# 1. projects テーブル (存在しない場合のみ作成)
create_projects_table_sql = """
CREATE TABLE IF NOT EXISTS projects (
    internal_id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectID TEXT UNIQUE,
    Ticker TEXT,
    Name TEXT,
    Side TEXT,
    Total_Shares REAL,
    Total_Amount REAL,
    Start_Date TEXT NOT NULL,
    End_Date TEXT NOT NULL,
    Price_Limit REAL,
    Performance_Based_Fee_Rate REAL,
    Fixed_Fee_Rate REAL,
    Business_Days INTEGER,
    Earliest_Day_Count INTEGER,
    Excluded_Days INTEGER,
    Note TEXT,
    TS_Contact TEXT NOT NULL
);
"""

# 2. ChildOrder テーブル (存在しない場合のみ作成)
create_childorder_table_sql = """
CREATE TABLE IF NOT EXISTS ChildOrder (
    ParentOrderId TEXT,
    ExecQty INTEGER,
    AvgPx REAL,
    VwapPx REAL,
    Date TEXT,
    Benchmark REAL
);
"""

# ▼▼▼ 3. 【追加】カレンダー予定テーブル (存在しない場合のみ作成) ▼▼▼
create_calendar_events_table_sql = """
CREATE TABLE IF NOT EXISTS calendar_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    start_date TEXT NOT NULL, -- ISO 8601 形式 (例: '2025-10-30T10:00:00.000Z')
    end_date TEXT NOT NULL,   -- ISO 8601 形式
    allDay INTEGER NOT NULL,  -- 0 (false) or 1 (true)
    color TEXT               -- オプションで色分け用
);
"""

conn = None
try:
    print(f"Connecting to database at: {db_path}")
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    print("Database connection successful.")

    # projects テーブル作成
    print("Executing CREATE TABLE for projects (IF NOT EXISTS)...")
    cursor.execute(create_projects_table_sql)
    
    # ChildOrder テーブル作成
    print("Executing CREATE TABLE for ChildOrder (IF NOT EXISTS)...")
    cursor.execute(create_childorder_table_sql)

    # ▼▼▼ 【追加】calendar_events テーブル作成 ▼▼▼
    print("Executing CREATE TABLE for calendar_events (IF NOT EXISTS)...")
    cursor.execute(create_calendar_events_table_sql)
    print("'calendar_events' table created successfully (or already exists).")
    # ▲▲▲ 追加ここまで ▲▲▲

    conn.commit()
    print("All tables checked/created. Changes committed.")

except sqlite3.Error as e:
    print(f"データベースエラーが発生しました: {e}")
except Exception as e:
    print(f"予期せぬエラーが発生しました: {e}")
finally:
    if conn:
        conn.close()
        print("Database connection closed.")