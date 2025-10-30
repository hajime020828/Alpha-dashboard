import sqlite3
import os

# データベースファイルの絶対パス
db_path = r'C:\Alpha-Dash-main\VWAP_Alpha.db'

# 削除するテーブル名 (単数形)
table_to_drop = "ChildOrder"
# リネーム元のテーブル名 (複数形)
table_to_rename_from = "ChildOrders"
# リネーム先のテーブル名 (単数形)
table_to_rename_to = "ChildOrder"

conn = None
try:
    # データベースに接続
    print(f"Connecting to database at: {db_path}")
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    print("Database connection successful.")

    # 1. 既存の 'ChildOrder' テーブルを削除 (存在する場合)
    try:
        print(f"Attempting to drop existing table '{table_to_drop}'...")
        # IF EXISTS を付けて、存在しない場合にエラーにならないようにする
        cursor.execute(f"DROP TABLE IF EXISTS {table_to_drop};")
        print(f"Table '{table_to_drop}' dropped successfully (or did not exist).")
    except sqlite3.Error as e:
        print(f"Error dropping table '{table_to_drop}': {e}")
        # 問題が発生した場合はここで処理を中断するかどうか検討
        # raise e # エラーを再発生させて中断する場合

    # 2. 'ChildOrders' テーブルを 'ChildOrder' にリネーム (存在する場合)
    try:
        print(f"Attempting to rename table '{table_to_rename_from}' to '{table_to_rename_to}'...")
        cursor.execute(f"ALTER TABLE {table_to_rename_from} RENAME TO {table_to_rename_to};")
        print(f"Table '{table_to_rename_from}' renamed successfully to '{table_to_rename_to}'.")
    except sqlite3.Error as e:
        # エラーハンドリング: 'ChildOrders' が存在しない場合など
        if f"no such table: {table_to_rename_from}" in str(e):
             print(f"Table '{table_to_rename_from}' not found. Cannot rename.")
        elif f"table {table_to_rename_to} already exists" in str(e):
             # DROPが成功していればここには来ないはずだが念のため
             print(f"Table '{table_to_rename_to}' still exists after drop attempt. Rename failed.")
        else:
            print(f"Error renaming table '{table_to_rename_from}': {e}")
            # raise e # エラーを再発生させて中断する場合

    # 変更をコミット
    conn.commit()
    print("Changes committed.")

except sqlite3.Error as e:
    print(f"データベース接続またはコミット中にエラーが発生しました: {e}")
except Exception as e:
    print(f"予期せぬエラーが発生しました: {e}")
finally:
    # 接続を閉じる
    if conn:
        conn.close()
        print("Database connection closed.")