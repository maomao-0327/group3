from flask import Flask, render_template, request, jsonify, redirect, url_for
import db
import matching
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
# ------------------
# 1. ユーザー一覧取得 API (Reactフロント用)
# ------------------
@app.route('/api/users', methods=['GET'])
def api_get_users():
    users = db.get_all_users_details()
    return jsonify(users)
# ------------------
# 2. マッチ履歴取得 API (Reactフロント用)
# ------------------
@app.route('/api/matches', methods=['GET'])
def api_get_matches():
    matches = db.get_all_matches_details()
    return jsonify(matches)
# ------------------
# 3. ユーザー登録処理 (HTMLフォームとReact JSON APIの両方に対応)
# ------------------
@app.route('/register', methods=['POST', 'OPTIONS'])
@app.route('/api/register', methods=['POST', 'OPTIONS'])
def register():
    if request.method == 'OPTIONS':
        return '', 200
    # JSONリクエスト（Reactフロントエンド）の場合
    if request.is_json:
        data = request.get_json()
        nickname = data.get('nickname')
        games = data.get('games', [])  # 趣味タグ
        availability = data.get('availability', [])  # 空きコマリスト
        if not nickname:
            return jsonify({"error": "ニックネームを入力してください"}), 400
        
        if db.is_nickname_exists(nickname):
            return jsonify({"error": "このニックネームは既に登録されています。"}), 400
        try:
            user_id = db.add_user(nickname)
            
            # 趣味登録
            for hobby in games:
                db.add_hobby(user_id, hobby)
                
            # 空きコマ登録
            for av in availability:
                day = av.get('day')
                start_time = av.get('start')
                # 開始時刻から時限(1~7)に変換。見つからない場合はデフォルトの3(3限)とする
                period = START_TIME_TO_PERIOD.get(start_time, 3)
                db.add_free_time(user_id, day, period)
                
            return jsonify({"success": True, "user_id": user_id}), 200
            
        except Exception as e:
            return jsonify({"error": f"システムエラーが発生しました: {e}"}), 500
    # 従来のフォームデータ送信の場合（後方互換用）
    else:
        nickname = request.form.get('nickname')
        selected_hobbies = request.form.getlist('hobbies')
        selected_times = request.form.getlist('free_times')
        
        if not nickname:
            return "ニックネームを入力してください", 400
            
        if db.is_nickname_exists(nickname):
            return "このニックネームは既に登録されています。", 400
            
        try:
            user_id = db.add_user(nickname)
            
            for hobby in selected_hobbies:
                db.add_hobby(user_id, hobby)
                
            for time_str in selected_times:
                day = time_str[:3]
                period = int(time_str[3:])
                db.add_free_time(user_id, day, period)
                
            return render_template('waiting.html', user_id=user_id, nickname=nickname)
            
        except Exception as e:
            return f"システムエラーが発生しました: {e}", 500
# ------------------
# 4. マッチング状況チェック API (JSから5秒おきに叩かれる)
# ------------------
@app.route('/api/check_status', methods=['GET'])
def check_status():
    user_id = request.args.get('user_id')
    if not user_id:
        return jsonify({"is_matched": False})
        
    event_id = db.get_user_event(user_id)
    
    if event_id:
        return jsonify({"is_matched": True, "event_id": event_id})
        
    return jsonify({"is_matched": False})
# ------------------
# 5. イベント詳細・一覧画面 (HTML用)
# ------------------
@app.route('/events/<int:event_id>')
def event_detail(event_id):
    event = db.get_event_by_id(event_id)
    if not event:
        return "イベントが見つかりません", 404
        
    members = db.get_event_members_with_name(event_id)
    member_names = [m[0] for m in members]
    
    return render_template('event_detail.html', event=event, members=member_names)
# ------------------
# 6. 管理者用：マッチング手動実行
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
# 7. 管理者用：データリセット
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
# ユーザー登録画面（トップページ・HTML用）
# ------------------
@app.route('/')
def index():
    hobbies = ["ボードゲーム", "ポケモン", "カードゲーム", "麻雀", "Movie"]
    return render_template('index.html', hobbies=hobbies)
if __name__ == '__main__':
    # 仮想サーバーでの動作を想定し、外部からのアクセス(0.0.0.0)を許可
    app.run(host='0.0.0.0', port=5000, debug=True)

