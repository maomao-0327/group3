import sqlite3
import re
from db import get_connection
def parse_location_from_nickname(nickname):
    """
    ニックネームから開催場所を取得するヘルパー
    例: "Suzuki (@7A201) [COMM:...]" -> "7A201"
    """
    match = re.search(r'\(@([^)]+)\)', nickname)
    if match:
        return match.group(1).strip()
    return None
def parse_capacity_from_nickname(nickname):
    """
    ニックネームから募集定員を取得するヘルパー
    例: "Suzuki (@3A201) [CAPA:4]" -> 4
    """
    match = re.search(r'\[CAPA:(\d+)\]', nickname)
    if match:
        return int(match.group(1))
    return 2  # デフォルトは最少の2人
def execute_matching():
    conn = get_connection()
    cur = conn.cursor()
    
    try:
        # まだイベントが決まっていない（未マッチングの）ユーザー一覧を取得
        cur.execute("""
            SELECT u.id, u.nickname 
            FROM users u
            WHERE u.id NOT IN (
                SELECT user_id FROM event_members
            )
        """)
        active_users = cur.fetchall()
        
        hosts = []         # 部屋を立てたい人（ホスト）
        participants = []  # 部屋に入りたい人（参加者）
        
        # ニックネームに (@場所) が含まれているかどうかで役割を分類
        for uid, nickname in active_users:
            room_name = parse_location_from_nickname(nickname)
            if room_name:
                hosts.append({"id": uid, "nickname": nickname, "room_name": room_name})
            else:
                participants.append({"id": uid, "nickname": nickname})
                
        print(f"【マッチング開始】待機中の部屋（ホスト）: {len(hosts)}個, 部屋に入りたい人: {len(participants)}人")
        
        # 各ホスト（立てられた部屋）に対して、趣味と時間帯がマッチする参加者を割り当てる
        for host in hosts:
            host_id = host["id"]
            room_name = host["room_name"]
            host_nickname = host["nickname"]
            
            # ホストが設定した募集定員（ホスト自身を含む総人数）を取得
            capacity = parse_capacity_from_nickname(host_nickname)
            required_guests = capacity - 1  # 必要なゲスト参加者の人数
            
            # ホストの趣味リストを取得
            cur.execute("SELECT hobby FROM user_hobbies WHERE user_id = ?", (host_id,))
            host_hobbies = [r[0] for r in cur.fetchall()]
            
            # ホストの空きコマを取得
            cur.execute("SELECT day, period FROM user_free_times WHERE user_id = ?", (host_id,))
            host_slots = cur.fetchall()
            
            matched_participants = []
            matched_hobby = None
            matched_day = None
            matched_period = None
            
            # ホストの「趣味」と「空き時間」に合致する参加者を探索
            for hobby in host_hobbies:
                for day, period in host_slots:
                    current_matched = []
                    
                    # 待機中の参加者リストから条件が一致する人を抽出
                    for part in participants:
                        if part["id"] in [p["id"] for p in current_matched]:
                            continue
                            
                        # 参加者がその趣味を持っているかチェック
                        cur.execute("""
                            SELECT 1 FROM user_hobbies 
                            WHERE user_id = ? AND hobby = ?
                        """, (part["id"], hobby))
                        has_hobby = cur.fetchone() is not None
                        
                        # 参加者がその時間帯に空いているかチェック
                        cur.execute("""
                            SELECT 1 FROM user_free_times 
                            WHERE user_id = ? AND day = ? AND period = ?
                        """, (part["id"], day, period))
                        has_slot = cur.fetchone() is not None
                        
                        if has_hobby and has_slot:
                            current_matched.append({
                                "id": part["id"],
                                "nickname": part["nickname"]
                            })
                            
                    # 定員（募集人数 - ホスト）以上のゲストが集まったか判定
                    if len(current_matched) >= required_guests:
                        # 必要な定員分だけゲストをマッチング対象として決定
                        matched_participants = current_matched[:required_guests]
                        matched_hobby = hobby
                        matched_day = day
                        matched_period = period
                        break
                        
                if len(matched_participants) >= required_guests:
                    break
            
            # 必要な人数が全員揃っていれば、イベントを生成してマッチを成立させる
            if len(matched_participants) >= required_guests:
                cur.execute("""
                    INSERT INTO events (hobby, day, period, room_name)
                    VALUES (?, ?, ?, ?)
                """, (matched_hobby, matched_day, matched_period, room_name))
                event_id = cur.lastrowid
                
                # 1. 部屋を立てた人（ホスト）をイベントに登録
                cur.execute("""
                    INSERT INTO event_members (event_id, user_id)
                    VALUES (?, ?)
                """, (event_id, host_id))
                
                # 2. 部屋に入りたい人（参加者）をイベントに登録
                for part in matched_participants:
                    cur.execute("""
                        INSERT INTO event_members (event_id, user_id)
                        VALUES (?, ?)
                    """, (event_id, part["id"]))
                    
                    # マッチングした参加者を待機リストから除外（ダブルブッキング防止）
                    participants = [p for p in participants if p["id"] != part["id"]]
                    
                print(f"【マッチ成立】{matched_hobby}会 ({matched_day}{matched_period}) 場所: {room_name} / 参加人数: {capacity}人 (ホスト: {host_nickname})")
            else:
                print(f"【人数不足】ホスト {host_nickname} の部屋は定員 {capacity}人 に対して現在 {len(current_matched) + 1}人 のため、マッチングを見送りました。")
                
        conn.commit()
        print("すべてのマッチング処理が正常に完了しました。")
        
    except Exception as e:
        conn.rollback()
        print(f"マッチング中にエラーが発生しました: {e}")
        raise e
    finally:
        conn.close()
if __name__ == "__main__":
    execute_matching()

