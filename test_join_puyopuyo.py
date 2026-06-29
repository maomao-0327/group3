import app
import sample_data
import json

def test():
    print("--- 1. サンプルデータを再生成します ---")
    sample_data.create_sample_data()
    
    client = app.app.test_client()
    
    # ぷよぷよ部屋(ホストD: ID 7, 定員 4)にゲスト(Taro)が「スマブラ」タグで合流する
    print("\n--- 2. ホストD (ID: 7, ぷよぷよ＆スマブラ 4人募集) の部屋に Taro が『スマブラ』で合流します ---")
    payload = {
        "host_user_id": 7,
        "nickname": "Taro",
        "comment": "ぷよぷよ初心者です",
        "sns_contact": "taro_sns",
        "game": "スマブラ",
        "day": "Mon",
        "start": "12:15"
    }
    
    join_res = client.post('/api/join_event', 
                           data=json.dumps(payload), 
                           content_type='application/json')
    
    print("合流APIレスポンスコード:", join_res.status_code)
    join_data = json.loads(join_res.get_data(as_text=True))
    print("合流結果:\n", json.dumps(join_data, indent=2, ensure_ascii=False))
    
    # 新しく追加されたゲスト Taro のユーザーIDを取得 (ID 8 になる予定)
    new_user_id = join_data.get("user_id")
    
    if new_user_id:
        print(f"\n--- 3. 追加されたゲスト Taro (ID: {new_user_id}) のステータスを確認します ---")
        status_res = client.get(f'/api/check_status?user_id={new_user_id}')
        status_data = json.loads(status_res.get_data(as_text=True))
        print("ステータス確認結果:\n", json.dumps(status_data, indent=2, ensure_ascii=False))
        
        # メンバー数と定員の確認
        members = status_data.get("members", [])
        capacity = status_data.get("capacity", 4)
        matched_game = status_data.get("matched_game", "")
        print("\n==================================================")
        print(f"部屋の登録種目: {matched_game}")
        print(f"現在のメンバー数: {len(members)}名 / 設定定員: {capacity}名")
        if len(members) < capacity:
            print("👉 定員に達していません！ (UI上では『シアン色/メンバー募集中』になります)")
        else:
            print("👉 定員に達しました！ (UI上では『ピンク色/マッチ確定』になります)")
        print("==================================================")

if __name__ == '__main__':
    test()
