import sqlite3
from datetime import datetime, timedelta
import db

def create_sample_data():
    print("--- 既存データのクリア ---")
    db.reset_all_data()

    # 有効期限を1時間後に設定
    expire_at = (datetime.now() + timedelta(hours=1)).strftime('%Y-%m-%d %H:%M:%S')
    now_str = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

    # コネクション取得 (すべてこの1つのコネクションとトランザクションで完結させる)
    conn = db.get_connection()
    cur = conn.cursor()

    try:
        # ------------------
        # 部屋 1: 2人募集（定員2）、ホストのみ（あと1人でマッチ成立）
        # ------------------
        print("1. 2人募集の部屋を作成中...")
        cur.execute("""
            INSERT INTO users (nickname, room_name, match_type, expire_at, capacity, comment, sns_contact)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, ("ホストA(2人募集)", "7A101", "immediate", expire_at, 2, "スマブラ対戦しましょう！初心者歓迎です", "discord_host_A"))
        host2_id = cur.lastrowid

        cur.execute("INSERT INTO user_hobbies (user_id, hobby) VALUES (?, ?)", (host2_id, "スマブラ"))
        cur.execute("INSERT INTO user_free_times (user_id, day, period) VALUES (?, ?, ?)", (host2_id, "Mon", 3))

        # イベント生成
        cur.execute("""
            INSERT INTO events (hobby, day, period, room_name, created_at)
            VALUES (?, ?, ?, ?, ?)
        """, ("スマブラ", "Mon", 3, "7A101", now_str))
        event2_id = cur.lastrowid
        
        # メンバー紐付け（ホスト追加）
        cur.execute("INSERT INTO event_members (event_id, user_id) VALUES (?, ?)", (event2_id, host2_id))


        # ------------------
        # 部屋 2: 3人募集（定員3）、ホスト1名＋ゲスト1名（あと1人でマッチ成立）
        # ------------------
        print("2. 3人募集の部屋（途中合流あり）を作成中...")
        cur.execute("""
            INSERT INTO users (nickname, room_name, match_type, expire_at, capacity, comment, sns_contact)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, ("ホストB(3人募集)", "7A102", "immediate", expire_at, 3, "ボードゲーム（カタン）やりましょう！", "discord_host_B"))
        host3_id = cur.lastrowid

        cur.execute("INSERT INTO user_hobbies (user_id, hobby) VALUES (?, ?)", (host3_id, "ボードゲーム"))
        cur.execute("INSERT INTO user_free_times (user_id, day, period) VALUES (?, ?, ?)", (host3_id, "Mon", 3))

        cur.execute("""
            INSERT INTO users (nickname, room_name, match_type, expire_at, capacity, comment, sns_contact)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, ("ゲストX", None, "immediate", expire_at, 4, "カタンやりたいです、ルール知ってます", "x_guest_X"))
        guest3_id = cur.lastrowid

        cur.execute("INSERT INTO user_hobbies (user_id, hobby) VALUES (?, ?)", (guest3_id, "ボードゲーム"))
        cur.execute("INSERT INTO user_free_times (user_id, day, period) VALUES (?, ?, ?)", (guest3_id, "Mon", 3))

        # イベント生成
        cur.execute("""
            INSERT INTO events (hobby, day, period, room_name, created_at)
            VALUES (?, ?, ?, ?, ?)
        """, ("ボードゲーム", "Mon", 3, "7A102", now_str))
        event3_id = cur.lastrowid
        
        # メンバー紐付け（ホスト＆ゲスト追加）
        cur.execute("INSERT INTO event_members (event_id, user_id) VALUES (?, ?)", (event3_id, host3_id))
        cur.execute("INSERT INTO event_members (event_id, user_id) VALUES (?, ?)", (event3_id, guest3_id))


        # ------------------
        # 部屋 3: 4人募集（定員4）、ホスト1名＋ゲスト2名（あと1人でマッチ成立）
        # ------------------
        print("3. 4人募集の部屋（途中合流あり）を作成中...")
        cur.execute("""
            INSERT INTO users (nickname, room_name, match_type, expire_at, capacity, comment, sns_contact)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, ("ホストC(4人募集)", "7A103", "immediate", expire_at, 4, "三人麻雀または四人麻雀（メンツ募集）", "discord_host_C"))
        host4_id = cur.lastrowid

        cur.execute("INSERT INTO user_hobbies (user_id, hobby) VALUES (?, ?)", (host4_id, "麻雀"))
        cur.execute("INSERT INTO user_free_times (user_id, day, period) VALUES (?, ?, ?)", (host4_id, "Mon", 3))

        cur.execute("""
            INSERT INTO users (nickname, room_name, match_type, expire_at, capacity, comment, sns_contact)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, ("ゲストY", None, "immediate", expire_at, 4, "麻雀打ちたいです！", "x_guest_Y"))
        guest4_1_id = cur.lastrowid

        cur.execute("INSERT INTO user_hobbies (user_id, hobby) VALUES (?, ?)", (guest4_1_id, "麻雀"))
        cur.execute("INSERT INTO user_free_times (user_id, day, period) VALUES (?, ?, ?)", (guest4_1_id, "Mon", 3))

        cur.execute("""
            INSERT INTO users (nickname, room_name, match_type, expire_at, capacity, comment, sns_contact)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, ("ゲストZ", None, "immediate", expire_at, 4, "初心者ですが混ぜてください", "discord_guest_Z"))
        guest4_2_id = cur.lastrowid

        cur.execute("INSERT INTO user_hobbies (user_id, hobby) VALUES (?, ?)", (guest4_2_id, "麻雀"))
        cur.execute("INSERT INTO user_free_times (user_id, day, period) VALUES (?, ?, ?)", (guest4_2_id, "Mon", 3))

        # イベント生成
        cur.execute("""
            INSERT INTO events (hobby, day, period, room_name, created_at)
            VALUES (?, ?, ?, ?, ?)
        """, ("麻雀", "Mon", 3, "7A103", now_str))
        event4_id = cur.lastrowid
        
        # メンバー紐付け（ホスト＆ゲスト2名追加）
        cur.execute("INSERT INTO event_members (event_id, user_id) VALUES (?, ?)", (event4_id, host4_id))
        cur.execute("INSERT INTO event_members (event_id, user_id) VALUES (?, ?)", (event4_id, guest4_1_id))
        cur.execute("INSERT INTO event_members (event_id, user_id) VALUES (?, ?)", (event4_id, guest4_2_id))

        # ------------------
        # 部屋 4: 4人募集（定員4）、ホストのみ（現在 1/4 名、複数タイトル: ぷよぷよ, スマブラ）
        # ------------------
        print("4. 4人募集の部屋（定員未達テスト用・複数タグ）を作成中...")
        cur.execute("""
            INSERT INTO users (nickname, room_name, match_type, expire_at, capacity, comment, sns_contact)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, ("ホストD(4人募集-未達テスト)", "7A104", "immediate", expire_at, 4, "ぷよぷよかスマブラやりましょう！", "discord_host_D"))
        host_d_id = cur.lastrowid

        cur.execute("INSERT INTO user_hobbies (user_id, hobby) VALUES (?, ?)", (host_d_id, "ぷよぷよ"))
        cur.execute("INSERT INTO user_hobbies (user_id, hobby) VALUES (?, ?)", (host_d_id, "スマブラ"))
        cur.execute("INSERT INTO user_free_times (user_id, day, period) VALUES (?, ?, ?)", (host_d_id, "Mon", 3))

        # イベント生成 (カンマ区切りで hobby を登録)
        cur.execute("""
            INSERT INTO events (hobby, day, period, room_name, created_at)
            VALUES (?, ?, ?, ?, ?)
        """, ("ぷよぷよ, スマブラ", "Mon", 3, "7A104", now_str))
        event5_id = cur.lastrowid
        
        # メンバー紐付け（ホストのみ追加）
        cur.execute("INSERT INTO event_members (event_id, user_id) VALUES (?, ?)", (event5_id, host_d_id))

        conn.commit()
        print("\n🎉 サンプルデータの作成が完了しました！")
        print("--------------------------------------------------")
        print("■ ロビーに表示される部屋の一覧:")
        print("1. [2人募集] ホストA(2人募集) @ 7A101 | 種目: スマブラ (現在 1/2 名)")
        print("2. [3人募集] ホストB(3人募集) @ 7A102 | 種目: ボードゲーム (現在 2/3 名)")
        print("3. [4人募集] ホストC(4人募集) @ 7A103 | 種目: 麻雀 (現在 3/4 名)")
        print("4. [4人募集] ホストD(4人募集-未達テスト) @ 7A104 | 種目: ぷよぷよ, スマブラ (現在 1/4 名)")
        print("--------------------------------------------------")
        print("※ 部屋4は、自分が合流しても 2/4名 となり、定員に達しない（募集中 UI のまま）状態をテストできます。")
        
    except Exception as e:
        conn.rollback()
        print(f"エラーが発生したためロールバックしました: {e}")
    finally:
        conn.close()

if __name__ == '__main__':
    create_sample_data()
