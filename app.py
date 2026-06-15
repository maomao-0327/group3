# app.py (一部抜粋・修正)
@app.route('/register', methods=['POST'])
def register():
    nickname = request.form.get('nickname')
    selected_hobbies = request.form.getlist('hobbies')
    selected_times = request.form.getlist('free_times')
    
    if not nickname:
        return "ニックネームを入力してください", 400
        
    # 事前にニックネームの重複チェックを行う
    if db.is_nickname_exists(nickname):
        return "このニックネームは既に登録されています。", 400
        
    try:
        # 空きコマのパースチェックを最初に行う（DB書き込み前にエラー検知するため）
        parsed_times = []
        for time_str in selected_times:
            if len(time_str) < 4:
                raise ValueError("時間帯のフォーマットが不正です。")
            day = time_str[:3]
            period = int(time_str[3:])
            parsed_times.append((day, period))
            
        # ユーザー情報の保存（トランザクションをまとめたいところですが、
        # シンプルさを維持するため個別関数を呼び出します）
        user_id = db.add_user(nickname)
        
        for hobby in selected_hobbies:
            db.add_hobby(user_id, hobby)
            
        for day, period in parsed_times:
            db.add_free_time(user_id, day, period)
            
        return render_template('waiting.html', user_id=user_id, nickname=nickname)
        
    except ValueError as ve:
        return f"入力エラー: {ve}", 400
    except Exception as e:
        # DB接続エラーなどのシステムエラー
        return f"システムエラーが発生しました: {e}", 500
@app.route('/api/check_status')
def check_status():
    user_id = request.args.get('user_id')
    if not user_id:
        return jsonify({"is_matched": False})
        
    # db.pyに処理をカプセル化
    event_id = db.get_user_event(user_id)
    
    if event_id:
        return jsonify({"is_matched": True, "event_id": event_id})
        
    return jsonify({"is_matched": False})
@app.route('/events/<int:event_id>')
def event_detail(event_id):
    # db.pyに処理をカプセル化
    event = db.get_event_by_id(event_id)
    
    if not event:
        return "イベントが見つかりません", 404
        
    members = db.get_event_members_with_name(event_id)
    member_names = [m[0] for m in members]
    
    return render_template('event_detail.html', event=event, members=member_names)
@app.route('/admin/reset', methods=['POST'])
def admin_reset():
    # 重複するリセット処理を db.reset_all_data に一元化
    db.reset_all_data()
    return "すべてのデータをリセットしました。"