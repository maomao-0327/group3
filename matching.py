import random
from db import (
    get_all_users,
    get_user_hobbies,
    get_user_free_times,
    get_rooms,
    create_event,
    add_event_member,
)
 
 
def run_matching():
    """
    マッチング処理のメイン関数。
    管理者が実行することを想定。
    """
 
    # ----------------------------------------
    # Step 1: 全ユーザーの趣味×空きコマを収集
    # ----------------------------------------
    # group_map[(hobby, day, period)] = [user_id, ...]
    group_map = {}
 
    users = get_all_users()  # [(id, nickname), ...]
 
    for user in users:
        user_id = user[0]
 
        hobbies = get_user_hobbies(user_id)       # [(hobby,), ...]
        free_times = get_user_free_times(user_id)  # [(day, period), ...]
 
        for (hobby,) in hobbies:
            for (day, period) in free_times:
                key = (hobby, day, period)
                if key not in group_map:
                    group_map[key] = []
                group_map[key].append(user_id)
 
    # ----------------------------------------
    # Step 2: 3人以上のグループのみ残す
    # ----------------------------------------
    candidates = [
        (key, user_ids)
        for key, user_ids in group_map.items()
        if len(user_ids) >= 3
    ]
 
    # ----------------------------------------
    # Step 3: グループをシャッフル（ランダム優先のため）
    # ----------------------------------------
    random.shuffle(candidates)
 
    # ----------------------------------------
    # Step 4: 同じ時間帯に複数グループにいるユーザーを1つに確定
    # ----------------------------------------
    # assigned[(user_id, day, period)] = True ならそのコマは確定済み
    assigned = {}
 
    final_groups = []
 
    for (hobby, day, period), user_ids in candidates:
        # そのコマがまだ未確定のユーザーだけ残す
        available = [
            uid for uid in user_ids
            if (uid, day, period) not in assigned
        ]
 
        # 絞り込み後も3人以上いればイベント確定
        if len(available) >= 3:
            final_groups.append((hobby, day, period, available))
 
            # 参加ユーザーのそのコマを確定済みにする
            for uid in available:
                assigned[(uid, day, period)] = True
 
    # ----------------------------------------
    # Step 5: 教室割り当て＆イベント生成
    # ----------------------------------------
    # 空き教室を (day, period) ごとに管理
    # used_rooms[(day, period)] = {room_name, ...}
    rooms = get_rooms()  # [(id, room_name, day, period), ...]
 
    room_map = {}  # room_map[(day, period)] = [room_name, ...]
    for (_, room_name, day, period) in rooms:
        key = (day, period)
        if key not in room_map:
            room_map[key] = []
        room_map[key].append(room_name)
 
    used_rooms = {}  # used_rooms[(day, period)] = {room_name, ...}
 
    created_events = []  # 結果確認用
 
    for hobby, day, period, user_ids in final_groups:
        key = (day, period)
 
        # その曜日・時限の空き教室を探す
        available_rooms = [
            r for r in room_map.get(key, [])
            if r not in used_rooms.get(key, set())
        ]
 
        if not available_rooms:
            # 空き教室なし → このイベントはスキップ
            print(f"[SKIP] 教室不足: {hobby} {day}{period}")
            continue
 
        # 先頭の教室を割り当て
        room_name = available_rooms[0]
 
        # 使用済みに追加
        if key not in used_rooms:
            used_rooms[key] = set()
        used_rooms[key].add(room_name)
 
        # DBにイベントを登録
        event_id = create_event(hobby, day, period, room_name)
 
        # DBに参加者を登録
        for uid in user_ids:
            add_event_member(event_id, uid)
 
        created_events.append({
            "event_id": event_id,
            "hobby": hobby,
            "day": day,
            "period": period,
            "room": room_name,
            "members": user_ids,
        })
 
        print(f"[OK] イベント生成: {hobby} {day}{period} @ {room_name} 参加者: {user_ids}")
 
    print(f"\nマッチング完了: {len(created_events)} 件のイベントを生成しました")
    return created_events
 
 
# スクリプトとして直接実行した場合
if __name__ == "__main__":
    run_matching()