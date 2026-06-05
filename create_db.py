import sqlite3

conn = sqlite3.connect("maomao.db")
cur = conn.cursor()

# users
cur.execute("""
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nickname TEXT UNIQUE NOT NULL
)
""")

# user_hobbies
cur.execute("""
CREATE TABLE IF NOT EXISTS user_hobbies (
    user_id INTEGER NOT NULL,
    hobby TEXT NOT NULL
)
""")

# user_free_times
cur.execute("""
CREATE TABLE IF NOT EXISTS user_free_times (
    user_id INTEGER NOT NULL,
    day TEXT NOT NULL,
    period INTEGER NOT NULL
)
""")

# rooms
cur.execute("""
CREATE TABLE IF NOT EXISTS rooms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_name TEXT NOT NULL,
    day TEXT NOT NULL,
    period INTEGER NOT NULL
)
""")

# events
cur.execute("""
CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    hobby TEXT NOT NULL,
    day TEXT NOT NULL,
    period INTEGER NOT NULL,
    room_name TEXT NOT NULL
)
""")

# event_members
cur.execute("""
CREATE TABLE IF NOT EXISTS event_members (
    event_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    PRIMARY KEY (event_id, user_id)
)
""")

conn.commit()
conn.close()
