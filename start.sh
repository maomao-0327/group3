#!/usr/bin/env bash
set -e

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT_DIR"

if ! command -v npm >/dev/null 2>&1; then
  echo "npm が見つかりません。WSL 内に Node.js をインストールしてください。"
  exit 1
fi

cd "$ROOT_DIR/backend"
if [ ! -d node_modules ]; then
  echo "backend: 依存関係をインストールしています..."
  npm install
fi

echo "backend: 起動中..."
npm run dev &
BACKEND_PID=$!

cd "$ROOT_DIR/frontend"
if [ ! -d node_modules ]; then
  echo "frontend: 依存関係をインストールしています..."
  npm install
fi

echo "frontend: 起動中..."
npm run dev -- --host 0.0.0.0 &
FRONTEND_PID=$!

echo "バックエンド PID: $BACKEND_PID"
echo "フロントエンド PID: $FRONTEND_PID"
echo "ブラウザで開いてください: http://localhost:5173"

echo "停止するには Ctrl+C を押してください。"
wait