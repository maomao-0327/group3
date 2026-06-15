# matching.py
import sqlite3
from db import get_connection
def execute_matching():
    conn = get_connection()
    cur = conn.cursor()
    
    try:
        # 1. イベント候補を取得（人数の多い趣味グループから優先して処理）
        cur.execute("""
            SELECT h.hobby, f.day, f.period, COUNT(h.user_id) as member_count
            FROM user_hobbies h
            JOIN user_free_times f ON h.user_id = f.user_id
            GROUP BY h.hobby, f.day, f.period
            HAVING member_count >= 3
            ORDER BY member_count DESC
        """)
        candidates = cur.fetchall()
        
        for hobby, day, period, _ in candidates:
            
            # 【重要】ダブルブッキング防止：
            # この時間帯(day, period)に、まだ他のイベントに割り当てられていないユーザーのみを抽出
            cur.execute("""
                SELECT h.user_id 
                FROM user_hobbies h
                JOIN user_free_times f ON h.user_id = f.user_id
                WHERE h.hobby = ? AND f.day = ? AND f.period = ?
                  AND h.user_id NOT IN (
                      SELECT em.user_id 
                      FROM event_members em
                      JOIN events e ON em.event_id = e.id
                      WHERE e.day = ? AND e.period = ?
                  )
            """, (hobby, day, period, day, period))
            
            available_users = cur.fetchall()
            
            # 残ったメンバーが3人未満になった場合は、このイベント作成をスキップ
            if len(available_users) < 3:
                print(f"【人数不足】{day}{period} の {hobby} は他イベントとの重複によるメンバー減少のためスキップされました。")
                continue
            
            # 2. 教室割り当て
            cur.execute("""
                SELECT room_name FROM rooms
                WHERE day = ? AND period = ?
                AND room_name NOT IN (
                    SELECT room_name FROM events WHERE day = ? AND period = ?
                )
                LIMIT 1
            """, (day, period, day, period))
            
            room_row = cur.fetchone()
            
            if not room_row:
                print(f"【教室不足】{day}{period} の {hobby} は教室がないためスキップされました。")
                continue
                
            room_name = room_row[0]
            
            # 3. イベント生成 (このトランザクション内でインサート)
            cur.execute("""
                INSERT INTO events (hobby, day, period, room_name)
                VALUES (?, ?, ?, ?)
            """, (hobby, day, period, room_name))
            event_id = cur.lastrowid
            
            # 4. 参加者の割り当て (このトランザクション内でインサート)
            for (user_id,) in available_users:
                cur.execute("""
                    INSERT INTO event_members (event_id, user_id)
                    VALUES (?, ?)
                """, (event_id, user_id))
                
            print(f"【イベント生成】{hobby}会 ({day}{period}) 場所: {room_name} / 参加人数: {len(available_users)}人")
            
        conn.commit()  # すべての処理が成功したら一括コミット
        print("すべてのマッチング処理が正常に完了しました。")
        
    except Exception as e:
        conn.rollback()  # エラー時はロールバックしてデータの一貫性を保つ
        print(f"マッチング中にエラーが発生しました: {e}")
        raise e
    finally:
        conn.close()
if __name__ == "__main__":
    execute_matching()