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
        # 外部キー制約が無い環境にも対応するため、手動で関連テーブルを全削除
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
    # 取得前に期限切れデータを自動削除
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
# 3. ユーザー登録処理 (教室重複チェックとマッチ期限設定を追加)
# ------------------
@app.route('/register', methods=['POST', 'OPTIONS'])
@app.route('/api/register', methods=['POST', 'OPTIONS'])
def register():
    if request.method == 'OPTIONS':
        return '', 200
    cleanup_expired_data()
    # JSONリクエスト（Reactフロントエンド）の場合
    if request.is_json:
        data = request.get_json()
        nickname = data.get('nickname')
        games = data.get('games', [])  # 趣味タグ
        availability = data.get('availability', [])  # 空きコマ
        match_time_type = data.get('match_time_type', 'immediate')  # 期限タイプ ("immediate" または "tomorrow")
        if not nickname:
            return jsonify({"error": "ニックネームを入力してください"}), 400
        
        # ニックネームから部屋の教室名 (@場所名) を抽出
        match_room = re.search(r'\(@([^)]+)\)', nickname)
        room_name = match_room.group(1).strip() if match_room else None
        # 1. 重複教室のバリデーション (ホスト登録時のみ)
        if room_name:
            for av in availability:
                day = av.get('day')
                start_time = av.get('start')
                period = START_TIME_TO_PERIOD.get(start_time, 3)
                # 重複判定を実行
                if db.check_classroom_booking(room_name, day, period):
                    return jsonify({"error": f"選択した教室「{room_name}」は、指定の時間帯にすでに他の募集またはイベントで使用されています。"}), 400
        if db.is_nickname_exists(nickname):
            return jsonify({"error": "このニックネームは既に登録されています。"}), 400
        # 2. マッチ有効期限の計算
        now = datetime.now()
        if match_time_type == "immediate":
            # 今すぐ遊べる：1時間後
            expire_at = now + timedelta(hours=1)
        else:
            # 1日前から予約：登録日当日の24:00 (23:59:59)
            expire_at = now.replace(hour=23, minute=59, second=59, microsecond=0)
            
        expire_at_str = expire_at.strftime('%Y-%m-%d %H:%M:%S')
        try:
            # ユーザー登録（教室名、期限も保存）
            user_id = db.add_user(nickname, room_name=room_name, match_type=match_time_type, expire_at=expire_at_str)
            
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
        # 後方互換用の標準HTMLフォームPOST処理 (必要に応じて同様に拡張可能)
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
        return jsonify({"is_matched": True, "event_id": event_id})
        
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
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)