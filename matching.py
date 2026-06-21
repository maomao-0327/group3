import sqlite3
import re
from datetime import datetime
from db import get_connection
def parse_location_from_nickname(nickname):
    """ニックネームから開催場所を取得するヘルパー"""
    match = re.search(r'\(@([^)]+)\)', nickname)
    if match:
        return match.group(1).strip()
    return None
def parse_capacity_from_nickname(nickname):
    """ニックネームから募集人数を取得するヘルパー"""
    match = re.search(r'\[CAPA:(\d+)\]', nickname)
    if match:
        return int(match.group(1))
    return 2  # デフォルトは最少の2人
def execute_matching():
    conn = get_connection()
    cur = conn.cursor()
    now_str = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    
    try:
        # 1. 期限切れデータを自動クリーンアップ
        cur.execute("SELECT id FROM users WHERE expire_at < ?", (now_str,))
        expired_ids = [row[0] for row in cur.fetchall()]
        if expired_ids:
            placeholders = ','.join('?' for _ in expired_ids)
            cur.execute(f"DELETE FROM user_hobbies WHERE user_id IN ({placeholders})", expired_ids)
            cur.execute(f"DELETE FROM user_free_times WHERE user_id IN ({placeholders})", expired_ids)
            cur.execute(f"DELETE FROM users WHERE id IN ({placeholders})", expired_ids)
            conn.commit()
            print(f"【クリーンアップ】期限切れの待機データ {len(expired_ids)}件 を自動削除しました。")
        # 2. 未マッチングかつ有効期限内のユーザー一覧を取得
        cur.execute("""
            SELECT u.id, u.nickname, u.room_name 
            FROM users u
            WHERE u.id NOT IN (
                SELECT user_id FROM event_members
            ) AND u.expire_at >= ?
        """, (now_str,))
        active_users = cur.fetchall()
        
        hosts = []         # 部屋を立てたい人（ホスト）
        participants = []  # 部屋に入りたい人（参加者）
        
        for uid, nickname, room_name in active_users:
            if room_name:
                hosts.append({"id": uid, "nickname": nickname, "room_name": room_name})
            else:
                participants.append({"id": uid, "nickname": nickname})
                
        print(f"【マッチング開始】待機中の部屋（ホスト）: {len(hosts)}個, 部屋に入りたい人: {len(participants)}人")
        
        # 各ホストに対して、趣味と時間帯がマッチする参加者を割り当てる
        for host in hosts:
            host_id = host["id"]
            room_name = host["room_name"]
            host_nickname = host["nickname"]
            
            # 定員数を取得し、必要なゲスト数を算出
            capacity = parse_capacity_from_nickname(host_nickname)
            required_guests = capacity - 1
            
            # ホストの趣味・空きコマを取得
            cur.execute("SELECT hobby FROM user_hobbies WHERE user_id = ?", (host_id,))
            host_hobbies = [r[0] for r in cur.fetchall()]
            
            cur.execute("SELECT day, period FROM user_free_times WHERE user_id = ?", (host_id,))
            host_slots = cur.fetchall()
            
            matched_participants = []
            matched_hobby = None
            matched_day = None
            matched_period = None
            
            # 条件に合致する参加者を探索
            for hobby in host_hobbies:
                for day, period in host_slots:
                    current_matched = []
                    
                    for part in participants:
                        if part["id"] in [p["id"] for p in current_matched]:
                            continue
                            
                        # 趣味チェック
                        cur.execute("SELECT 1 FROM user_hobbies WHERE user_id = ? AND hobby = ?", (part["id"], hobby))
                        has_hobby = cur.fetchone() is not None
                        
                        # 空きコマチェック
                        cur.execute("SELECT 1 FROM user_free_times WHERE user_id = ? AND day = ? AND period = ?", (part["id"], day, period))
                        has_slot = cur.fetchone() is not None
                        
                        if has_hobby and has_slot:
                            current_matched.append({
                                "id": part["id"],
                                "nickname": part["nickname"]
                            })
                            
                    # 定員分の人数が集まった場合
                    if len(current_matched) >= required_guests:
                        matched_participants = current_matched[:required_guests]
                        matched_hobby = hobby
                        matched_day = day
                        matched_period = period
                        break
                        
                if len(matched_participants) >= required_guests:
                    break
            
            # 定員が満たされたらマッチを確定し、イベントを生成
            if len(matched_participants) >= required_guests:
                cur.execute("""
                    INSERT INTO events (hobby, day, period, room_name)
                    VALUES (?, ?, ?, ?)
                """, (matched_hobby, matched_day, matched_period, room_name))
                event_id = cur.lastrowid
                
                # ホストのイベント登録
                cur.execute("INSERT INTO event_members (event_id, user_id) VALUES (?, ?)", (event_id, host_id))
                
                # ゲストのイベント登録
                for part in matched_participants:
                    cur.execute("INSERT INTO event_members (event_id, user_id) VALUES (?, ?)", (event_id, part["id"]))
                    # 待機リストから除外
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