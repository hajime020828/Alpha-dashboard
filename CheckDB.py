import sqlite3

# データベースファイル名
db_name = 'C:\Alpha-Dash-main\VWAP_Alpha.db'

def view_all_tables_and_contents(database_filename):
    """
    指定されたSQLiteデータベース内のすべてのテーブル名とその内容を表示します。
    """
    conn = None
    try:
        conn = sqlite3.connect(database_filename)
        cursor = conn.cursor()

        cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = cursor.fetchall()

        if not tables:
            print(f"データベース '{database_filename}' にテーブルが見つかりません。")
            return

        print(f"データベース '{database_filename}' の内容:")
        print("=" * 40)

        for table_info in tables:
            table_name = table_info[0]
            # テーブル名を ChildOrder に変更 (直接書き換えるか、動的に扱う)
            # if table_name == 'stock_records':
            #     table_name = 'ChildOrder' # もし古い名前で残っていた場合

            print(f"\nテーブル名: {table_name}")
            print("-" * (len(table_name) + 14))

            try:
                cursor.execute(f"SELECT * FROM [{table_name}]")

                column_names = [description[0] for description in cursor.description]
                if column_names:
                    print(" | ".join(column_names))
                    print("-" * (sum(len(col) for col in column_names) + (len(column_names) -1) * 3 + 4 ))

                rows = cursor.fetchall()

                if not rows:
                    print("このテーブルにデータはありません。")
                else:
                    for row in rows:
                        print(" | ".join(map(str, row)))
            except sqlite3.Error as e:
                print(f"テーブル '{table_name}' の読み取り中にエラーが発生しました: {e}")
            print("-" * (len(table_name) + 14))

        print("=" * 40)

    except sqlite3.Error as e:
        print(f"データベースエラーが発生しました: {e}")
    except FileNotFoundError:
        print(f"データベースファイル '{database_filename}' が見つかりません。")
    finally:
        if conn:
            conn.close()
            print("\nデータベース接続を閉じました。")

if __name__ == "__main__":
    view_all_tables_and_contents(db_name)