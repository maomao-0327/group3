import sqlite3
# 同一ディレクトリの maomao.db を使用
DB_NAME = "maomao.db"
def get_connection():
    conn = sqlite3.connect(DB_NAME)
    # SQLiteで外部キー制約を有効化
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn
# ------------------
# Users
# ------------------
def add_user(nickname):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO users (nickname) VALUES (?)",
        (nickname,)
    )
    user_id = cur.lastrowid
    conn.commit()
    conn.close()
    return user_id
def is_nickname_exists(nickname):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT id FROM users WHERE nickname = ?", (nickname,))
    row = cur.fetchone()
    conn.close()
    return row is not None
def get_user_id(nickname):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT id FROM users WHERE nickname = ?", (nickname,))
    row = cur.fetchone()
    conn.close()
    return row[0] if row else None
# ------------------
# Hobbies
# ------------------
def add_hobby(user_id, hobby):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO user_hobbies (user_id, hobby) VALUES (?, ?)",
        (user_id, hobby)
    )
    conn.commit()
    conn.close()
# ------------------
# Free Times
# ------------------
def add_free_time(user_id, day, period):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO user_free_times (user_id, day, period) VALUES (?, ?, ?)",
        (user_id, day, period)
    )
    conn.commit()
    conn.close()
# ------------------
# UI用一括取得関数群 (Reactの型に合わせた変換)
# ------------------
def get_all_users_details():
    """React UIの LOBBY BOARD 表示用に、全ユーザーの趣味と空き時間を一括取得して整形"""
    conn = get_connection()
    cur = conn.cursor()
    
    cur.execute("SELECT id, nickname FROM users")
    users_rows = cur.fetchall()
    
    users_list = []
    for uid, nickname in users_rows:
        # 趣味（games）
        cur.execute("SELECT hobby FROM user_hobbies WHERE user_id = ?", (uid,))
        games = [row[0] for row in cur.fetchall()]
        
        # 空き時間（availability）
        cur.execute("SELECT day, period FROM user_free_times WHERE user_id = ?", (uid,))
        free_times_rows = cur.fetchall()
        
        # DBの時限(1-7)から、フロントの時間帯文字列への逆変換マッピング
        PERIOD_TO_TIME = {
            1: {"start": "08:40", "end": "09:55"},
            2: {"start": "10:10", "end": "11:25"},
            3: {"start": "12:15", "end": "13:30"},
            4: {"start": "13:45", "end": "15:00"},
            5: {"start": "15:15", "end": "16:30"},
            6: {"start": "16:45", "end": "18:00"},
            7: {"start": "18:30", "end": "ANYTIME"}
        }
        
        availability = []
        for day, period in free_times_rows:
            time_info = PERIOD_TO_TIME.get(period, {"start": "12:15", "end": "13:30"})
            availability.append({
                "day": day,
                "start": time_info["start"],
                "end": time_info["end"]
            })
            
        users_list.append({
            "id": str(uid),  # フロント側が string ID を期待している可能性があるため文字列化
            "nickname": nickname,
            "games": games,
            "availability": availability
        })
        
    conn.close()
    return users_list
def get_all_matches_details():
    """React UIの履歴表示用に、マッチしたイベントと参加者情報を整形して取得"""
    conn = get_connection()
    cur = conn.cursor()
    
    cur.execute("SELECT id, hobby, room_name FROM events")
    event_rows = cur.fetchall()
    
    matches_list = []
    for eid, hobby, room_name in event_rows:
        # 参加者のニックネーム一覧を取得
        cur.execute("""
            SELECT u.nickname 
            FROM event_members em
            JOIN users u ON em.user_id = u.id
            WHERE em.event_id = ?
        """, (eid,))
        member_nicknames = [row[0] for row in cur.fetchall()]
        
        if len(member_nicknames) > 0:
            # 2人以上の対戦履歴を表示するためのマッピング
            # React UIが m.student.nickname と m.professor.nickname を参照するため
            student_name = member_nicknames[0]
            professor_name = member_nicknames[1] if len(member_nicknames) > 1 else "無し"
            
            matches_list.append({
                "id": str(eid),
                "student": {"nickname": student_name},
                "professor": {"nickname": professor_name},
                "room": {"name": room_name},
                "matchedGame": hobby
            })
            
    conn.close()
    return matches_list
def get_user_event(user_id):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT event_id FROM event_members WHERE user_id = ?", (user_id,))
    row = cur.fetchone()
    conn.close()
    return row[0] if row else None
def get_event_by_id(event_id):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT hobby, day, period, room_name FROM events WHERE id = ?", (event_id,))
    event = cur.fetchone()
    conn.close()
    return event
def get_event_members_with_name(event_id):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("""
        SELECT u.nickname
        FROM event_members em
        JOIN users u ON em.user_id = u.id
        WHERE em.event_id = ?
    """, (event_id,))
    members = cur.fetchall()
    conn.close()
    return members
# ------------------
# Reset Data
# ------------------
def reset_all_data():
    conn = get_connection()
    cur = conn.cursor()
    tables = ["users", "user_hobbies", "user_free_times", "events", "event_members"]
    for table in tables:
        cur.execute(f"DELETE FROM {table}")
        try:
            cur.execute(f"DELETE FROM sqlite_sequence WHERE name='{table}'")
        except sqlite3.OperationalError:
            pass
    conn.commit()
    conn.close()
