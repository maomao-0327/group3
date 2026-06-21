import sqlite3
from db import add_user, add_hobby, add_free_time, reset_all_data
# 一度既存データをクリア
reset_all_data()
# ------------------
# テストデータのシード登録
# ------------------
# 1. 部屋を立てたい人 (ホスト: ニックネームに (@場所) を含む)
suzuki_id = add_user("Suzuki (@3A201) [COMM:ポケモンカードで対戦しましょう！] [SNS:suzuki_discord]")
# 2. 部屋に入りたい人 (参加者: ニックネームに (@場所) を含まない)
tanaka_id = add_user("Tanaka [COMM:初心者ですがよろしくお願いします！] [SNS:tanaka_x]")
# 3. 別の部屋を立てる人 (ホスト)
sato_id = add_user("Sato (@3A202) [COMM:麻雀しましょう！面子募集]")
# 4. 部屋に入りたい人 (参加者)
yamada_id = add_user("Yamada [COMM:麻雀の面子に参加したいです！]")
# 趣味の登録
add_hobby(suzuki_id, "ポケモン")
add_hobby(tanaka_id, "ポケモン")
add_hobby(sato_id, "麻雀")
add_hobby(yamada_id, "麻雀")
# 空きコマの登録 (Mon 3限 = 3)
add_free_time(suzuki_id, "Mon", 3)
add_free_time(tanaka_id, "Mon", 3)
add_free_time(sato_id, "Mon", 3)
add_free_time(yamada_id, "Mon", 3)
# 予備の空き教室も登録しておく (roomsテーブル - ホストが場所指定しなかった場合のフォールバック用)
def add_room(room_name, day, period):
    conn = sqlite3.connect("maomao.db")
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO rooms (room_name, day, period) VALUES (?, ?, ?)",
        (room_name, day, period)
    )
    conn.commit()
    conn.close()
add_room("3A203", "Mon", 3)
print("ホスト・ゲスト構成のサンプルデータ作成が完了しました。")
print("Suzuki (ホスト: ポケモン) ⇄ Tanaka (ゲスト: ポケモン) でマッチングが成立します。")
print("Sato (ホスト: 麻雀) ⇄ Yamada (ゲスト: 麻雀) でマッチングが成立します。")
