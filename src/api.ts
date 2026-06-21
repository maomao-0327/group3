export type AvailabilitySlot = {
  day: string;
  start: string;
  end: string;
};
// Flaskサーバーのアドレス
const BASE_URL = "http://localhost:5000";
export const api = {
  // 1. 待機中の募集ユーザー一覧の取得
  async getUsers() {
    const response = await fetch(`${BASE_URL}/api/users`);
    if (!response.ok) {
      throw new Error("ユーザーデータの取得に失敗しました");
    }
    return response.json();
  },
  // 2. マッチング成立履歴の取得
  async getMatches() {
    const response = await fetch(`${BASE_URL}/api/matches`);
    if (!response.ok) {
      throw new Error("マッチング履歴の取得に失敗しました");
    }
    return response.json();
  },
  // 3. ホストまたはゲストの登録処理
  async registerUser(data: {
    role: string;
    nickname: string;
    games: string[];
    availability: AvailabilitySlot[];
  }) {
    const response = await fetch(`${BASE_URL}/api/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || "登録処理に失敗しました");
    }
    return response.json();
  },
  // 4. マッチングエンジンの手動実行トリガー
  async triggerMatching() {
    const response = await fetch(`${BASE_URL}/api/match`, {
      method: "POST",
    });
    if (!response.ok) {
      throw new Error("マッチングエンジンの実行に失敗しました");
    }
    return response.json();
  }
};