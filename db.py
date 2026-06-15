import sqlite3

DB_NAME = "maomao.db"


def get_connection():
    return sqlite3.connect(DB_NAME)


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

    conn.commit()
    conn.close()


def get_user_id(nickname):
    conn = get_connection()
    cur = conn.cursor()

    cur.execute(
        "SELECT id FROM users WHERE nickname = ?",
        (nickname,)
    )

    row = cur.fetchone()

    conn.close()

    if row:
        return row[0]

    return None


def get_all_users():
    conn = get_connection()
    cur = conn.cursor()

    cur.execute(
        "SELECT * FROM users"
    )

    users = cur.fetchall()

    conn.close()

    return users


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


def get_user_hobbies(user_id):
    conn = get_connection()
    cur = conn.cursor()

    cur.execute(
        """
        SELECT hobby
        FROM user_hobbies
        WHERE user_id = ?
        """,
        (user_id,)
    )

    hobbies = cur.fetchall()

    conn.close()

    return hobbies


# ------------------
# Free Times
# ------------------

def add_free_time(user_id, day, period):
    conn = get_connection()
    cur = conn.cursor()

    cur.execute(
        """
        INSERT INTO user_free_times
        (user_id, day, period)
        VALUES (?, ?, ?)
        """,
        (user_id, day, period)
    )

    conn.commit()
    conn.close()


def get_user_free_times(user_id):
    conn = get_connection()
    cur = conn.cursor()

    cur.execute(
        """
        SELECT day, period
        FROM user_free_times
        WHERE user_id = ?
        """,
        (user_id,)
    )

    free_times = cur.fetchall()

    conn.close()

    return free_times


# ------------------
# Rooms
# ------------------

def get_rooms():
    conn = get_connection()
    cur = conn.cursor()

    cur.execute(
        "SELECT * FROM rooms"
    )

    rooms = cur.fetchall()

    conn.close()

    return rooms


# ------------------
# Events
# ------------------

def create_event(hobby, day, period, room_name):
    conn = get_connection()
    cur = conn.cursor()

    cur.execute(
        """
        INSERT INTO events
        (hobby, day, period, room_name)
        VALUES (?, ?, ?, ?)
        """,
        (hobby, day, period, room_name)
    )

    event_id = cur.lastrowid

    conn.commit()
    conn.close()

    return event_id


def get_events():
    conn = get_connection()
    cur = conn.cursor()

    cur.execute(
        "SELECT * FROM events"
    )

    events = cur.fetchall()

    conn.close()

    return events


# ------------------
# Event Members
# ------------------

def add_event_member(event_id, user_id):
    conn = get_connection()
    cur = conn.cursor()

    cur.execute(
        """
        INSERT INTO event_members
        (event_id, user_id)
        VALUES (?, ?)
        """,
        (event_id, user_id)
    )

    conn.commit()
    conn.close()


def get_event_members(event_id):
    conn = get_connection()
    cur = conn.cursor()

    cur.execute(
        """
        SELECT user_id
        FROM event_members
        WHERE event_id = ?
        """,
        (event_id,)
    )

    members = cur.fetchall()

    conn.close()

    return members


def get_event_members_with_name(event_id):
    conn = get_connection()
    cur = conn.cursor()

    cur.execute(
        """
        SELECT users.nickname
        FROM event_members
        JOIN users
        ON event_members.user_id = users.id
        WHERE event_members.event_id = ?
        """,
        (event_id,)
    )

    members = cur.fetchall()

    conn.close()

    return members

# db.py の末尾に追加 sihmu
def reset_all_data():
    """仕様書『8. データ管理』に基づく、全データの一括リセット（履歴保存なし）"""
    conn = get_connection()
    cur = conn.cursor()
    
    tables = ["users", "user_hobbies", "user_free_times", "events", "event_members"]
    for table in tables:
        cur.execute(f"DELETE FROM {table}")
        # ついでに自動連番(AUTOINCREMENT)のカウンターもリセット
        cur.execute(f"DELETE FROM sqlite_sequence WHERE name='{table}'")
        
    conn.commit()
    conn.close()