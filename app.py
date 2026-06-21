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
    now_str = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    
    # 期限切れユーザーのIDを抽出
    cur.execute("SELECT id FROM users WHERE expire_at < ?", (now_str,))
    expired_ids = [row[0] for row in cur.fetchall()]
    
    if expired_ids:
        placeholders = ','.join('?' for _ in expired_ids)
        # 関連テーブルを手動で削除
        cur.execute(f"DELETE FROM user_hobbies WHERE user_id IN ({placeholders})", expired_ids)
        cur.execute(f"DELETE FROM user_free_times WHERE user_id IN ({placeholders})", expired_ids)
        cur.execute(f"DELETE FROM users WHERE id IN ({placeholders})", expired_ids)
        conn.commit()
    conn.close()

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
        return jsonify({"is_matched": False})
        
    cleanup_expired_data()
    event_id = db.get_user_event(user_id)
    
    if event_id:
        event = db.get_event_by_id(event_id)  # hobby, day, period, room_name
        members = db.get_event_members_with_details(event_id)
        
        return jsonify({
            "is_matched": True, 
            "event_id": event_id,
            "matched_game": event[0],
            "day": event[1],
            "period": event[2],
            "room_name": event[3],
            "members": members
        })
        
    return jsonify({"is_matched": False})

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
        # ゲストユーザーを追加 (sns_contact は不要なため None)
        guest_user_id = db.add_user(
            nickname,
            room_name=None,
            match_type='immediate',
            expire_at=expire_at_str,
            capacity=4,
            comment=comment,
            sns_contact=None
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
        
        # すでにホストが属しているイベントがあるか確認
        cur.execute("""
            SELECT e.id FROM events e
            JOIN event_members em ON e.id = em.event_id
            WHERE em.user_id = ? AND e.hobby = ? AND e.day = ? AND e.period = ?
        """, (host_user_id, game, day, period))
        event_row = cur.fetchone()
        
        if event_row:
            event_id = event_row[0]
        else:
            # 新規にイベントを生成
            cur.execute("""
                INSERT INTO events (hobby, day, period, room_name)
                VALUES (?, ?, ?, ?)
            """, (game, day, period, room_name))
            event_id = cur.lastrowid
            
            # ホストをイベントメンバーに追加
            cur.execute("INSERT OR IGNORE INTO event_members (event_id, user_id) VALUES (?, ?)", (event_id, host_user_id))
            
        # ゲストをイベントメンバーに追加
        cur.execute("INSERT OR IGNORE INTO event_members (event_id, user_id) VALUES (?, ?)", (event_id, guest_user_id))
        
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
            "members": members
        }), 200
        
    except Exception as e:
        return jsonify({"error": f"システムエラーが発生しました: {e}"}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)