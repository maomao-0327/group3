from flask import Flask, render_template, request, jsonify
import db
import matching
from datetime import datetime, timedelta
import re

app = Flask(__name__)

# CORS対応を全ルートに適用するミドルウェア (React SPAとの接続用)
@app.after_request
def after_request(response):
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
    return response

# フロントの時間割開始時刻 -> DBの時限(1~7)のマッピング
START_TIME_TO_PERIOD = {
    "08:40": 1,
    "10:10": 2,
    "12:15": 3,
    "13:45": 4,
    "15:15": 5,
    "16:45": 6,
    "18:30": 7
}

# 期限切れデータをデータベースから一括削除するヘルパー関数
def cleanup_expired_data():
    conn = db.get_connection()
    cur = conn.cursor()
    now = datetime.now()
    now_str = now.strftime('%Y-%m-%d %H:%M:%S')
    
    # 1. 期限切れユーザーのクリーンアップ (ただし満員のマッチ成立イベントに所属しているメンバーは除外)
    try:
        cur.execute("""
            SELECT id FROM users 
            WHERE expire_at < ?
              AND id NOT IN (
                  SELECT user_id FROM event_members
                  WHERE event_id IN (
                      SELECT em.event_id FROM event_members em
                      JOIN events e ON em.event_id = e.id
                      JOIN event_members em_host ON e.id = em_host.event_id
                      JOIN users host_u ON em_host.user_id = host_u.id
                      WHERE host_u.room_name IS NOT NULL
                      GROUP BY em.event_id
                      HAVING COUNT(em.user_id) >= host_u.capacity
                  )
              )
        """, (now_str,))
        expired_ids = [row[0] for row in cur.fetchall()]
        
        if expired_ids:
            placeholders = ','.join('?' for _ in expired_ids)
            # 関連テーブルを手動で削除
            cur.execute(f"DELETE FROM user_hobbies WHERE user_id IN ({placeholders})", expired_ids)
            cur.execute(f"DELETE FROM user_free_times WHERE user_id IN ({placeholders})", expired_ids)
            cur.execute(f"DELETE FROM users WHERE id IN ({placeholders})", expired_ids)
            conn.commit()
    except Exception as e:
        print(f"【クリーンアップエラー】期限切れユーザーのクリーンアップに失敗: {e}")

    # 2. 遊び終わったイベント（およびその参加メンバー）のクリーンアップ
    try:
        # created_at と custom_time も取得して期限計算を行う
        cur.execute("SELECT id, day, period, created_at, custom_time FROM events")
        events_list = cur.fetchall()
        
        expired_event_ids = []
        weekday_map = {"Mon": 0, "Tue": 1, "Wed": 2, "Thu": 3, "Fri": 4, "Sat": 5, "Sun": 6}
        # 各コマの終了時刻 (5分後に削除される)
        period_end_map = {
            1: "09:55",
            2: "11:25",
            3: "13:30",
            4: "15:00",
            5: "16:30",
            6: "18:00",
            7: "21:00"  # 放課後(7限)は21:00を想定終了時間とする
        }
        
        for eid, day_str, period, created_at_str, custom_time in events_list:
            if not created_at_str:
                # 移行用にNULLの場合は現在時刻を基準にする
                created_at_str = now_str
                
            try:
                target_weekday = weekday_map.get(day_str, 0)
                
                # デフォルトの終了時間
                end_time_str = period_end_map.get(period, "21:00")
                
                # custom_time がある場合、パースして終了時間を取り出す
                if custom_time:
                    # "18:00-19:00" や "18:00~19:00" などから時刻パターン HH:MM を抽出
                    time_matches = re.findall(r'(\d{1,2}):(\d{2})', custom_time)
                    if time_matches:
                        # 最後のマッチ（終了時間）を使用
                        last_match = time_matches[-1]
                        hour = int(last_match[0])
                        minute = int(last_match[1])
                        end_time_str = f"{hour:02d}:{minute:02d}"
                
                created_at = datetime.strptime(created_at_str, "%Y-%m-%d %H:%M:%S")
                created_weekday = created_at.weekday()
                
                # イベント作成週の指定曜日の日付を計算
                days_diff = target_weekday - created_weekday
                target_date = created_at.date() + timedelta(days=days_diff)
                
                end_datetime = datetime.strptime(f"{target_date.strftime('%Y-%m-%d')} {end_time_str}:00", "%Y-%m-%d %H:%M:%S")
                expire_time = end_datetime + timedelta(minutes=5)
                
                # 作成日時より過去になっている場合の未来補正（週跨ぎ対応）
                if expire_time < created_at:
                    expire_time += timedelta(days=7)
                    
                if now > expire_time:
                    expired_event_ids.append(eid)
            except Exception as ex:
                print(f"【クリーンアップ警告】イベント(ID: {eid})の期限計算に失敗: {ex}")
                
        if expired_event_ids:
            placeholders = ','.join('?' for _ in expired_event_ids)
            
            # イベントに参加していたユーザーのIDを特定
            cur.execute(f"SELECT user_id FROM event_members WHERE event_id IN ({placeholders})", expired_event_ids)
            member_ids = [row[0] for row in cur.fetchall()]
            
            # イベントを物理削除 (ON DELETE CASCADEによりchat_messagesやevent_membersも連動削除される)
            cur.execute(f"DELETE FROM events WHERE id IN ({placeholders})", expired_event_ids)
            
            # 参加メンバーのユーザー情報および関連データを削除
            if member_ids:
                user_placeholders = ','.join('?' for _ in member_ids)
                cur.execute(f"DELETE FROM user_hobbies WHERE user_id IN ({user_placeholders})", member_ids)
                cur.execute(f"DELETE FROM user_free_times WHERE user_id IN ({user_placeholders})", member_ids)
                cur.execute(f"DELETE FROM users WHERE id IN ({user_placeholders})", member_ids)
                
            conn.commit()
    except Exception as e:
        print(f"【クリーンアップエラー】遊び終わったイベントのクリーンアップ中にエラーが発生しました: {e}")

    # 3. ホストが消滅した（マッチ不成立のまま期限切れになった）イベントのクリーンアップ
    try:
        cur.execute("""
            SELECT e.id FROM events e
            WHERE NOT EXISTS (
                SELECT 1 FROM event_members em
                JOIN users u ON em.user_id = u.id
                WHERE em.event_id = e.id AND u.room_name IS NOT NULL
            )
        """)
        dead_event_ids = [row[0] for row in cur.fetchall()]
        
        if dead_event_ids:
            placeholders = ','.join('?' for _ in dead_event_ids)
            cur.execute(f"DELETE FROM events WHERE id IN ({placeholders})", dead_event_ids)
            conn.commit()
    except Exception as e:
        print(f"【クリーンアップエラー】不成立イベントのクリーンアップ中にエラーが発生しました: {e}")

# ------------------
# 1. ユーザー一覧取得 API (ロビー表示)
# ------------------
@app.route('/api/users', methods=['GET'])
def api_get_users():
    cleanup_expired_data()
    users = db.get_all_users_details()
    return jsonify(users)

# ------------------
# 2. マッチ履歴取得 API
# ------------------
@app.route('/api/matches', methods=['GET'])
def api_get_matches():
    cleanup_expired_data()
    matches = db.get_all_matches_details()
    return jsonify(matches)

# ------------------
# 3. ユーザー登録処理 (名前かぶり無し・CGI/API兼用)
# ------------------
@app.route('/register', methods=['POST', 'OPTIONS'])
@app.route('/api/register', methods=['POST', 'OPTIONS'])
def register():
    if request.method == 'OPTIONS':
        return '', 200
    cleanup_expired_data()
    
    if request.is_json:
        data = request.get_json()
        nickname = data.get('nickname', '').strip()
        games = data.get('games', [])  # 趣味タグ
        availability = data.get('availability', [])  # 空きコマ
        match_time_type = data.get('match_time_type', 'immediate')  # 期限タイプ ("immediate" または "tomorrow")
        role = data.get('role', 'student')  # 'student' (guest) または 'professor' (host)
        
        room_name = data.get('room_name') if role == 'professor' else None
        capacity = int(data.get('capacity', 4))
        comment = data.get('comment', '').strip()
        sns_contact = data.get('sns_contact', '').strip()
        
        if not nickname:
            return jsonify({"error": "ニックネームを入力してください"}), 400
        
        # 1. プレーンな名前での重複チェック
        if db.is_nickname_exists(nickname):
            return jsonify({"error": "すでに使用されている名前です"}), 400
        
        # 2. 重複教室のバリデーション (ホスト登録時のみ)
        if role == 'professor' and room_name:
            for av in availability:
                day = av.get('day')
                start_time = av.get('start')
                period = START_TIME_TO_PERIOD.get(start_time, 3)
                # 重複判定を実行
                if db.check_classroom_booking(room_name, day, period):
                    return jsonify({"error": f"選択した教室「{room_name}」は、指定の時間帯にすでに他の募集またはイベントで使用されています。"}), 400
                    
        # 3. マッチ有効期限の計算
        now = datetime.now()
        if match_time_type == "immediate":
            expire_at = now + timedelta(hours=1)
        else:
            expire_at = now.replace(hour=23, minute=59, second=59, microsecond=0)
            
        expire_at_str = expire_at.strftime('%Y-%m-%d %H:%M:%S')
        try:
            # ユーザー登録（プレーンなパラメーターを格納）
            user_id = db.add_user(
                nickname, 
                room_name=room_name, 
                match_type=match_time_type, 
                expire_at=expire_at_str,
                capacity=capacity,
                comment=comment,
                sns_contact=sns_contact
            )
            
            for hobby in games:
                db.add_hobby(user_id, hobby)
                
            for av in availability:
                day = av.get('day')
                start_time = av.get('start')
                period = START_TIME_TO_PERIOD.get(start_time, 3)
                db.add_free_time(user_id, day, period)
                
            # ホスト（部屋を立てた人）の場合、最初のタイトルと空きコマでイベントを仮生成しておく
            # これにより、人数が揃う前でもホストが部屋に入ってチャットできるようになる
            if role == 'professor' and games and availability:
                # 複数ゲームタイトルをカンマ区切りで連結して保存
                hobby_str = ", ".join(games)
                first_av = availability[0]
                first_day = first_av.get('day')
                first_start = first_av.get('start')
                first_period = START_TIME_TO_PERIOD.get(first_start, 3)
                
                # カスタム時間か判定 (START_TIME_TO_PERIOD に含まれていなければカスタム時間)
                custom_time = first_start if first_start not in START_TIME_TO_PERIOD else None
                
                conn = db.get_connection()
                cur = conn.cursor()
                cur.execute("""
                    INSERT INTO events (hobby, day, period, room_name, created_at, custom_time)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, (hobby_str, first_day, first_period, room_name, datetime.now().strftime('%Y-%m-%d %H:%M:%S'), custom_time))
                event_id = cur.lastrowid
                cur.execute("INSERT OR IGNORE INTO event_members (event_id, user_id) VALUES (?, ?)", (event_id, user_id))
                conn.commit()
                conn.close()
                
            return jsonify({"success": True, "user_id": user_id}), 200
            
        except Exception as e:
            return jsonify({"error": f"システムエラーが発生しました: {e}"}), 500
    else:
        return "JSON API経由での登録を推奨します。", 400

# ------------------
# 4. マッチング状況チェック API
# ------------------
@app.route('/api/check_status', methods=['GET'])
def check_status():
    user_id = request.args.get('user_id')
    if not user_id:
        return jsonify({"is_matched": False, "exists": False})
        
    cleanup_expired_data()
    
    # ユーザーが存在するか確認
    conn = db.get_connection()
    cur = conn.cursor()
    cur.execute("SELECT 1 FROM users WHERE id = ?", (user_id,))
    user_exists = cur.fetchone() is not None
    
    if not user_exists:
        conn.close()
        return jsonify({"is_matched": False, "exists": False})
        
    event_id = db.get_user_event(user_id)
    
    if event_id:
        event = db.get_event_by_id(event_id)  # hobby, day, period, room_name
        members = db.get_event_members_with_details(event_id)
        
        # ホストユーザーを特定してその定員(capacity)を取得する
        cur.execute("""
            SELECT u.capacity FROM event_members em
            JOIN users u ON em.user_id = u.id
            WHERE em.event_id = ? AND u.room_name IS NOT NULL
        """, (event_id,))
        row = cur.fetchone()
        capacity = row[0] if row else 4
        conn.close()
        
        return jsonify({
            "is_matched": True, 
            "exists": True,
            "event_id": event_id,
            "matched_game": event[0],
            "day": event[1],
            "period": event[2],
            "room_name": event[3],
            "members": members,
            "capacity": capacity
        })
        
    conn.close()
    return jsonify({"is_matched": False, "exists": True})

# ------------------
# 5. 管理者用：マッチング手動実行
# ------------------
@app.route('/admin/match', methods=['POST', 'OPTIONS'])
@app.route('/api/match', methods=['POST', 'OPTIONS'])
def admin_match():
    if request.method == 'OPTIONS':
        return '', 200
    try:
        matching.execute_matching()
        return jsonify({"success": True, "message": "マッチングを完了しました。"})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

# ------------------
# 6. 管理者用：データリセット
# ------------------
@app.route('/admin/reset', methods=['POST', 'OPTIONS'])
@app.route('/api/reset', methods=['POST', 'OPTIONS'])
def admin_reset():
    if request.method == 'OPTIONS':
        return '', 200
    try:
        db.reset_all_data()
        return jsonify({"success": True, "message": "すべてのデータをリセットしました。"})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500
# ------------------
# 7. トップページ (HTML表示)
# ------------------
@app.route('/')
def index():
    return render_template('index.html')
# ------------------
# 8. 伝言板（チャット機能） API
# ------------------
@app.route('/api/events/<int:event_id>/chat', methods=['POST', 'OPTIONS'])
def send_chat(event_id):
    if request.method == 'OPTIONS':
        return '', 200
    data = request.get_json()
    sender = data.get('sender', '').strip()
    message = data.get('message', '').strip()
    
    if not sender or not message:
        return jsonify({"error": "送信データが不足しています"}), 400
        
    db.add_chat_message(event_id, sender, message)
    return jsonify({"success": True})
@app.route('/api/events/<int:event_id>/chat', methods=['GET'])
def get_chat(event_id):
    messages = db.get_chat_messages(event_id)
    return jsonify(messages)

# ------------------
# 9. ゲストの手動合流 API
# ------------------
@app.route('/api/join_event', methods=['POST', 'OPTIONS'])
def api_join_event():
    if request.method == 'OPTIONS':
        return '', 200
        
    cleanup_expired_data()
    data = request.get_json()
    
    host_user_id = data.get('host_user_id')
    nickname = data.get('nickname', '').strip()
    comment = data.get('comment', '').strip()
    game = data.get('game', '').strip()
    day = data.get('day', '').strip()
    start_time = data.get('start', '').strip()
    
    sns_contact = data.get('sns_contact', '').strip()
    
    if not host_user_id or not nickname or not game or not day or not start_time:
        return jsonify({"error": "入力データが不足しています"}), 400
        
    # 1. ニックネームの重複チェック
    if db.is_nickname_exists(nickname):
        return jsonify({"error": "すでに使用されている名前です"}), 400
        
    # periodに変換
    period = START_TIME_TO_PERIOD.get(start_time, 3)
    
    # 2. ゲスト登録
    now = datetime.now()
    expire_at = now + timedelta(hours=1) # 1時間有効
    expire_at_str = expire_at.strftime('%Y-%m-%d %H:%M:%S')
    
    try:
        # ゲストユーザーを追加 (sns_contact を受け取って登録)
        guest_user_id = db.add_user(
            nickname,
            room_name=None,
            match_type='immediate',
            expire_at=expire_at_str,
            capacity=4,
            comment=comment,
            sns_contact=sns_contact if sns_contact else None
        )
        
        # ゲストの趣味と空き時間を登録
        db.add_hobby(guest_user_id, game)
        db.add_free_time(guest_user_id, day, period)
        
        # 3. イベント生成およびメンバー紐付け
        conn = db.get_connection()
        cur = conn.cursor()
        
        # ホスト情報を取得して room_name を特定
        cur.execute("SELECT room_name FROM users WHERE id = ?", (host_user_id,))
        host_row = cur.fetchone()
        if not host_row:
            conn.close()
            return jsonify({"error": "指定されたホストの部屋が見つかりません"}), 400
        room_name = host_row[0]
        
        # ホストがその曜日・時間帯にすでに作成しているイベントがあるか確認 (ゲームタイトルは問わない)
        cur.execute("""
            SELECT e.id FROM events e
            JOIN event_members em ON e.id = em.event_id
            WHERE em.user_id = ? AND e.day = ? AND e.period = ?
        """, (host_user_id, day, period))
        event_row = cur.fetchone()
        
        if event_row:
            event_id = event_row[0]
        else:
            # カスタム時間か判定
            custom_time = start_time if start_time not in START_TIME_TO_PERIOD else None
            
            # ホストが登録した全希望タイトルを取得してカンマ連結
            cur.execute("SELECT hobby FROM user_hobbies WHERE user_id = ?", (host_user_id,))
            host_games = [row[0] for row in cur.fetchall()]
            hobby_str = ", ".join(host_games) if host_games else game
            
            # 新規にイベントを生成
            cur.execute("""
                INSERT INTO events (hobby, day, period, room_name, created_at, custom_time)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (hobby_str, day, period, room_name, datetime.now().strftime('%Y-%m-%d %H:%M:%S'), custom_time))
            event_id = cur.lastrowid
            
            # ホストをイベントメンバーに追加
            cur.execute("INSERT OR IGNORE INTO event_members (event_id, user_id) VALUES (?, ?)", (event_id, host_user_id))
            
        # ゲストをイベントメンバーに追加
        cur.execute("INSERT OR IGNORE INTO event_members (event_id, user_id) VALUES (?, ?)", (event_id, guest_user_id))
        
        # ホスト情報を取得して capacity を特定
        cur.execute("SELECT capacity FROM users WHERE id = ?", (host_user_id,))
        host_capacity_row = cur.fetchone()
        capacity = host_capacity_row[0] if host_capacity_row else 4
        
        conn.commit()
        conn.close()
        
        # メンバーリストを取得
        members = db.get_event_members_with_details(event_id)
        
        return jsonify({
            "success": True,
            "user_id": guest_user_id,
            "event_id": event_id,
            "room_name": room_name,
            "matched_game": game,
            "day": day,
            "period": period,
            "members": members,
            "capacity": capacity
        }), 200
        
    except Exception as e:
        try:
            conn.rollback()
        except:
            pass
        try:
            conn.close()
        except:
            pass
        return jsonify({"error": f"システムエラーが発生しました: {e}"}), 500

# ------------------
# 10. ユーザーの削除/退出 API
# ------------------
@app.route('/api/users/<int:user_id>', methods=['DELETE', 'OPTIONS'])
def api_delete_user(user_id):
    if request.method == 'OPTIONS':
        return '', 200
    try:
        conn = db.get_connection()
        cur = conn.cursor()
        
        # ユーザーがホストかどうか確認 (room_name があるか)
        cur.execute("SELECT room_name FROM users WHERE id = ?", (user_id,))
        user_row = cur.fetchone()
        if not user_row:
            conn.close()
            return jsonify({"success": True, "message": "ユーザーはすでに存在しません。"})
        
        room_name = user_row[0]
        is_host = room_name is not None
        
        # ユーザーが所属しているイベントIDを取得
        cur.execute("SELECT event_id FROM event_members WHERE user_id = ?", (user_id,))
        event_row = cur.fetchone()
        event_id = event_row[0] if event_row else None
        
        if event_id:
            if is_host:
                # ホストが退出する場合：イベント自体を削除（cascadeでevent_membersやメッセージも消える）
                cur.execute("DELETE FROM events WHERE id = ?", (event_id,))
            else:
                # ゲストが退出する場合：event_membersから削除するのみ
                cur.execute("DELETE FROM event_members WHERE event_id = ? AND user_id = ?", (event_id, user_id))
        
        # ユーザーの個別データを削除
        cur.execute("DELETE FROM user_hobbies WHERE user_id = ?", (user_id,))
        cur.execute("DELETE FROM user_free_times WHERE user_id = ?", (user_id,))
        cur.execute("DELETE FROM users WHERE id = ?", (user_id,))
        
        conn.commit()
        conn.close()
        return jsonify({"success": True, "message": "退出/削除処理が完了しました。"})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)