import sqlite3
import db

def create_database():
    conn = sqlite3.connect(db.DB_NAME)
    cur = conn.cursor()
    
    # users (学生情報 - プレーンなニックネームと追加列を整理)
    cur.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nickname TEXT NOT NULL,      -- プレーンなニックネーム（一意制約は解除）
        room_name TEXT,                     -- ホストが選んだ教室名（ゲスト登録時は NULL）
        match_type TEXT,                    -- マッチ時間タイプ ("immediate" または "tomorrow")
        capacity INTEGER DEFAULT 4,         -- 募集定員数
        comment TEXT,                       -- 一言コメント
        sns_contact TEXT,                   -- 連絡用SNS
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        expire_at DATETIME NOT NULL         -- 有効期限 (タイムスタンプ)
    )
    """)
    
    # user_hobbies (趣味タグ)
    cur.execute("""
    CREATE TABLE IF NOT EXISTS user_hobbies (
        user_id INTEGER NOT NULL,
        hobby TEXT NOT NULL,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )
    """)
    
    # user_free_times (空きコマ)
    cur.execute("""
    CREATE TABLE IF NOT EXISTS user_free_times (
        user_id INTEGER NOT NULL,
        day TEXT NOT NULL,
        period INTEGER NOT NULL,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )
    """)
    
    # rooms (予備用教室マスタ)
    cur.execute("""
    CREATE TABLE IF NOT EXISTS rooms (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        room_name TEXT NOT NULL,
        day TEXT NOT NULL,
        period INTEGER NOT NULL
    )
    """)
    
    # events (イベント情報)
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
    
    # event_members (イベント参加者)
    cur.execute("""
    CREATE TABLE IF NOT EXISTS event_members (
        event_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        PRIMARY KEY (event_id, user_id),
        FOREIGN KEY(event_id) REFERENCES events(id) ON DELETE CASCADE,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )
    """)
    
    # chat_messages (イベントごとの伝言板メッセージ)
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
    
    conn.commit()
    conn.close()
    print("Database tables created successfully with matching expiration, room, and chat support.")

if __name__ == "__main__":
    create_database()