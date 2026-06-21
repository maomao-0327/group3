import sqlite3
def create_database():
    conn = sqlite3.connect("maomao.db")
    cur = conn.cursor()
    # users (学生情報)
    cur.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nickname TEXT UNIQUE NOT NULL
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
    # rooms (教室情報)
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
        room_name TEXT NOT NULL
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
    conn.commit()
    conn.close()
    print("Database tables created successfully with foreign key constraints.")
if __name__ == "__main__":
    create_database()

