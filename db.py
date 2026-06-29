import sqlite3
from datetime import datetime

# ※さくらサーバーでの動作時は maomao.db への絶対パス等に必要に応じて書き換えてください。
DB_NAME = "maomao.db"

def check_and_migrate_db():
    conn = sqlite3.connect(DB_NAME)
    cur = conn.cursor()
    
    # --- 全テーブルの新規自動作成（テーブルがない新規環境対策） ---
    cur.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nickname TEXT NOT NULL,
        room_name TEXT,
        match_type TEXT,
        capacity INTEGER DEFAULT 4,
        comment TEXT,
        sns_contact TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        expire_at DATETIME NOT NULL
    )
    """)
    
    cur.execute("""
    CREATE TABLE IF NOT EXISTS user_hobbies (
        user_id INTEGER NOT NULL,
        hobby TEXT NOT NULL,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )
    """)
    
    cur.execute("""
    CREATE TABLE IF NOT EXISTS user_free_times (
        user_id INTEGER NOT NULL,
        day TEXT NOT NULL,
        period INTEGER NOT NULL,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )
    """)
    
    cur.execute("""
    CREATE TABLE IF NOT EXISTS rooms (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        room_name TEXT NOT NULL,
        day TEXT NOT NULL,
        period INTEGER NOT NULL
    )
    """)
    
    cur.execute("""
    CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        hobby TEXT NOT NULL,
        day TEXT NOT NULL,
        period INTEGER NOT NULL,
        room_name TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        custom_time TEXT
    )
    """)
    
    cur.execute("""
    CREATE TABLE IF NOT EXISTS event_members (
        event_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        PRIMARY KEY (event_id, user_id),
        FOREIGN KEY(event_id) REFERENCES events(id) ON DELETE CASCADE,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )
    """)
    
    cur.execute("""
    CREATE TABLE IF NOT EXISTS chat_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id INTEGER NOT NULL,
        sender_name TEXT NOT NULL,
        message TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(event_id) REFERENCES events(id) ON DELETE CASCADE
    )
    """)
    
    # 1. users テーブルの UNIQUE 制約を外すための再構築、およびカラム追加
    try:
        cur.execute("PRAGMA table_info(users)")
        columns = [row[1] for row in cur.fetchall()]
        
        if columns:
            # UNIQUE 制約があるか調べる (sqlite_master の sql 文に UNIQUE が含まれるか簡易判定)
            cur.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'")
            sql_row = cur.fetchone()
            
            # UNIQUE 制約が含まれている場合、または必要なカラムが1つでも不足している場合に再構築
            needs_rebuild = sql_row and "UNIQUE" in sql_row[0]
            needs_migrate = "capacity" not in columns or "comment" not in columns or "sns_contact" not in columns
            
            if needs_rebuild or needs_migrate:
                print("【DBマイグレーション】usersテーブルのスキーマアップデートを実行します。")
                cur.execute("PRAGMA foreign_keys = OFF;")
                cur.execute("BEGIN TRANSACTION;")
                
                # 新しいテーブルの作成 (UNIQUE を外す)
                cur.execute("""
                CREATE TABLE IF NOT EXISTS users_new (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    nickname TEXT NOT NULL,
                    room_name TEXT,
                    match_type TEXT,
                    capacity INTEGER DEFAULT 4,
                    comment TEXT,
                    sns_contact TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    expire_at DATETIME NOT NULL
                )
                """)
                
                # 既存のカラム一覧に基づいて移行クエリを組み立て
                col_str = "id, nickname, room_name, match_type, created_at, expire_at"
                val_str = "id, nickname, room_name, match_type, created_at, expire_at"
                
                if "capacity" in columns:
                    col_str += ", capacity"
                    val_str += ", capacity"
                if "comment" in columns:
                    col_str += ", comment"
                    val_str += ", comment"
                if "sns_contact" in columns:
                    col_str += ", sns_contact"
                    val_str += ", sns_contact"
                    
                cur.execute(f"INSERT INTO users_new ({col_str}) SELECT {val_str} FROM users")
                
                # 古いテーブルを削除して名前変更
                cur.execute("DROP TABLE users;")
                cur.execute("ALTER TABLE users_new RENAME TO users;")
                
                cur.execute("COMMIT;")
                cur.execute("PRAGMA foreign_keys = ON;")
                print("【DBマイグレーション】usersテーブルのスキーマアップデートが完了しました。")
    except Exception as e:
        print(f"【DBマイグレーション警告】usersテーブルの再構築に失敗しました: {e}")
        try:
            cur.execute("ROLLBACK;")
        except:
            pass
            
    # events テーブルのマイグレーション（created_at と custom_time カラムの追加）
    try:
        cur.execute("PRAGMA table_info(events)")
        columns = [row[1] for row in cur.fetchall()]
        if columns:
            if "created_at" not in columns:
                print("【DBマイグレーション】eventsテーブルにcreated_atカラムを追加します。")
                cur.execute("ALTER TABLE events ADD COLUMN created_at DATETIME")
                print("【DBマイグレーション】eventsテーブルのcreated_atカラム追加が完了しました。")
            if "custom_time" not in columns:
                print("【DBマイグレーション】eventsテーブルにcustom_timeカラムを追加します。")
                cur.execute("ALTER TABLE events ADD COLUMN custom_time TEXT")
                print("【DBマイグレーション】eventsテーブルのcustom_timeカラム追加が完了しました。")
    except Exception as e:
        print(f"【DBマイグレーション警告】eventsテーブルへのカラム追加に失敗しました: {e}")
        
    conn.commit()
    conn.close()

# モジュールインポート時に自動実行
check_and_migrate_db()

def get_connection():
    conn = sqlite3.connect(DB_NAME)
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn

# ------------------
# Users
# ------------------
def add_user(nickname, room_name=None, match_type='immediate', expire_at=None, capacity=4, comment=None, sns_contact=None):
    """ユーザー登録（プレーンなニックネームと追加カラムを格納）"""
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO users (nickname, room_name, match_type, expire_at, capacity, comment, sns_contact) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (nickname, room_name, match_type, expire_at, capacity, comment, sns_contact)
    )
    user_id = cur.lastrowid
    conn.commit()
    conn.close()
    return user_id

def is_nickname_exists(nickname):
    conn = get_connection()
    cur = conn.cursor()
    # 重複チェックの対象を「ロビーに表示されている未マッチのホスト」および「まだ定員に達していないアクティブなイベントのメンバー」に限定
    cur.execute("""
        SELECT 1 FROM users u
        WHERE u.nickname = ?
          AND (
            -- 1. ホストであり、まだ満員になっていない
            (u.room_name IS NOT NULL AND (
                NOT EXISTS (SELECT 1 FROM event_members em WHERE em.user_id = u.id)
                OR
                (SELECT COUNT(*) FROM event_members em2 WHERE em2.event_id = (
                    SELECT em_inner.event_id FROM event_members em_inner WHERE em_inner.user_id = u.id LIMIT 1
                )) < u.capacity
            ))
            OR
            -- 2. ゲストであり、所属しているイベントがまだ満員になっていない
            (u.room_name IS NULL AND EXISTS (
                SELECT 1 FROM event_members em_guest
                JOIN events e ON em_guest.event_id = e.id
                JOIN event_members em_host ON e.id = em_host.event_id
                JOIN users host_u ON em_host.user_id = host_u.id
                WHERE em_guest.user_id = u.id
                  AND host_u.room_name IS NOT NULL
                  AND (
                      SELECT COUNT(*) FROM event_members em_count WHERE em_count.event_id = e.id
                  ) < host_u.capacity
            ))
          )
    """, (nickname,))
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
# Hobbies & Free Times
# ------------------
def add_hobby(user_id, hobby):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("INSERT INTO user_hobbies (user_id, hobby) VALUES (?, ?)", (user_id, hobby))
    conn.commit()
    conn.close()

def add_free_time(user_id, day, period):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("INSERT INTO user_free_times (user_id, day, period) VALUES (?, ?, ?)", (user_id, day, period))
    conn.commit()
    conn.close()

# ------------------
# 重複教室チェック
# ------------------
def check_classroom_booking(room_name, day, period):
    """
    指定された曜日・時限で、選んだ教室がすでに使用中か判定する
    1. すでにマッチが成立したイベントで使用されているか
    2. まだマッチしていない有効期限内の他のホストがすでに登録しているか
    """
    conn = get_connection()
    cur = conn.cursor()
    now_str = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    
    # 1. マッチ成立イベントのチェック
    cur.execute("""
        SELECT 1 FROM events 
        WHERE room_name = ? AND day = ? AND period = ?
    """, (room_name, day, period))
    if cur.fetchone():
        conn.close()
        return True
        
    # 2. 待機中ホスト（期限内の部屋）のチェック
    cur.execute("""
        SELECT 1 FROM users u
        JOIN user_free_times f ON u.id = f.user_id
        WHERE u.room_name = ? AND f.day = ? AND f.period = ? AND u.expire_at > ?
    """, (room_name, day, period, now_str))
    is_booked = cur.fetchone() is not None
    conn.close()
    return is_booked

# ------------------
# UI用一括取得関数群
# ------------------
def get_all_users_details():
    conn = get_connection()
    cur = conn.cursor()
    
    # 待機中ホスト（部屋）の表示条件：
    # ホスト（room_name IS NOT NULL）であり、まだイベントに所属していない、
    # または所属しているイベントの現在のメンバー数が定員（capacity）未満である部屋のみを表示
    cur.execute("""
        SELECT id, nickname, room_name, expire_at, capacity, comment, sns_contact 
        FROM users u
        WHERE u.room_name IS NOT NULL
          AND (
            NOT EXISTS (
                SELECT 1 FROM event_members em WHERE em.user_id = u.id
            )
            OR
            (
                SELECT COUNT(*) FROM event_members em2 
                WHERE em2.event_id = (
                    SELECT em_inner.event_id FROM event_members em_inner 
                    WHERE em_inner.user_id = u.id 
                    LIMIT 1
                )
            ) < u.capacity
          )
    """)
    users_rows = cur.fetchall()
    
    users_list = []
    for uid, nickname, room_name, expire_at, capacity, comment, sns_contact in users_rows:
        cur.execute("SELECT hobby FROM user_hobbies WHERE user_id = ?", (uid,))
        games = [row[0] for row in cur.fetchall()]
        
        cur.execute("SELECT day, period FROM user_free_times WHERE user_id = ?", (uid,))
        free_times_rows = cur.fetchall()
        
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
            "id": str(uid),
            "nickname": nickname,
            "room_name": room_name,
            "expire_at": expire_at,
            "capacity": capacity,
            "comment": comment,
            "sns_contact": sns_contact,
            "games": games,
            "availability": availability
        })
        
    conn.close()
    return users_list

def get_all_matches_details():
    conn = get_connection()
    cur = conn.cursor()
    
    cur.execute("SELECT id, hobby, room_name FROM events")
    event_rows = cur.fetchall()
    
    matches_list = []
    for eid, hobby, room_name in event_rows:
        # ホスト判定のために、u.room_name カラムも取得
        cur.execute("""
            SELECT u.id, u.nickname, u.sns_contact, u.comment, u.room_name
            FROM event_members em
            JOIN users u ON em.user_id = u.id
            WHERE em.event_id = ?
        """, (eid,))
        members_data = cur.fetchall()
        
        if len(members_data) > 0:
            # room_name がある人を「ホスト(student)」、ない人を「ゲスト(professor)」に分ける
            hosts = [m[1] for m in members_data if m[4] is not None]
            guests = [m[1] for m in members_data if m[4] is None]
            
            host_name = hosts[0] if hosts else members_data[0][1]
            guest_names = ", ".join(guests) if guests else "無し"
            
            matches_list.append({
                "id": str(eid),
                "student": {"nickname": host_name},
                "professor": {"nickname": guest_names},
                "room": {"name": room_name},
                "matchedGame": hobby,
                "members": [{"id": str(m[0]), "nickname": m[1], "sns_contact": m[2], "comment": m[3]} for m in members_data]
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

def get_event_members_with_details(event_id):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("""
        SELECT u.id, u.nickname, u.sns_contact, u.comment, u.room_name
        FROM event_members em
        JOIN users u ON em.user_id = u.id
        WHERE em.event_id = ?
    """, (event_id,))
    rows = cur.fetchall()
    conn.close()
    return [{"id": str(r[0]), "nickname": r[1], "sns_contact": r[2], "comment": r[3], "room_name": r[4]} for r in rows]

def reset_all_data():
    conn = get_connection()
    cur = conn.cursor()
    tables = ["users", "user_hobbies", "user_free_times", "events", "event_members", "chat_messages"]
    for table in tables:
        try:
            cur.execute(f"DELETE FROM {table}")
            cur.execute(f"DELETE FROM sqlite_sequence WHERE name='{table}'")
        except sqlite3.OperationalError:
            pass
    conn.commit()
    conn.close()

# ------------------
# Chat Messages (伝言板用)
# ------------------
def add_chat_message(event_id, sender_name, message):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO chat_messages (event_id, sender_name, message) VALUES (?, ?, ?)",
        (event_id, sender_name, message)
    )
    conn.commit()
    conn.close()
def get_chat_messages(event_id):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        "SELECT id, sender_name, message, created_at FROM chat_messages WHERE event_id = ? ORDER BY id ASC",
        (event_id,)
    )
    rows = cur.fetchall()
    conn.close()
    
    messages = []
    for r in rows:
        try:
            # CURRENT_TIMESTAMP は UTC 基準なので、時分の簡易抽出
            dt = datetime.strptime(r[3], '%Y-%m-%d %H:%M:%S')
            time_str = dt.strftime('%H:%M')
        except:
            time_str = "00:00"
            
        messages.append({
            "id": r[0],
            "sender": r[1],
            "text": r[2],
            "time": time_str
        })
    return messages