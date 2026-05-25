# Classroom Match Server

このバックエンドは、教授と生徒をゲーム教室にマッチングするためのAPIを提供します。

## できること

- 匿名登録
- 好きなゲーム嗜好の登録
- 空き時間と教室のマッチング
- 教室データの管理
- マッチングリクエストの作成と一覧

## 開発

```bash
cd backend
npm install
npm run dev
```

## API

- `POST /api/register` - ユーザー登録
- `POST /api/match` - マッチング作成
- `GET /api/users` - ユーザー一覧
- `GET /api/rooms` - 教室一覧
- `POST /api/rooms` - 教室登録
- `GET /api/matches` - マッチ履歴
