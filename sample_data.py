from db import *

add_user("Suzuki")
add_user("Tanaka")
add_user("Sato")
add_user("Yamada")

add_hobby(1, "Movie")
add_hobby(1, "Music")

add_hobby(2, "Movie")
add_hobby(3, "Movie")
add_hobby(4, "Reading")

add_free_time(1, "Mon", 3)
add_free_time(2, "Mon", 3)
add_free_time(3, "Mon", 3)
add_free_time(4, "Tue", 2)

print("Sample data inserted")

# sample_data.py の末尾に追記（テスト用の仮データ）shimu
def add_room(room_name, day, period):
    conn = sqlite3.connect("maomao.db") # db.pyからインポートしてもOK
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO rooms (room_name, day, period) VALUES (?, ?, ?)",
        (room_name, day, period)
    )
    conn.commit()
    conn.close()

# 現在のサンプルデータ（Suzukiさんたち）が「Mon 3」なので、そこだけ仮登録
add_room("3A201", "Mon", 3)