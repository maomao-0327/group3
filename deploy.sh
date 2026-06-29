#!/usr/bin/env bash
set -e

# group3 のパス (WSL内の絶対パス)
SRC_DIR="/mnt/c/Users/viole/group3"

HOST="153.121.60.184"
USER="shimu"
DEST="/var/www/html"

echo "=================================================="
echo " さくらサーバーへのデプロイを開始します"
echo "=================================================="

# フォルダへ移動
cd "$SRC_DIR"

# 初回接続時の確認で止まらないように StrictHostKeyChecking=accept-new を追加
echo ">>> 1. 修正されたファイルをアップロードしています..."
scp -o StrictHostKeyChecking=accept-new app.py db.py create_db.py sample_data.py ${USER}@${HOST}:${DEST}/
scp -o StrictHostKeyChecking=accept-new templates/index.html ${USER}@${HOST}:${DEST}/templates/index.html

echo ">>> 2. さくらサーバーの Flask サーバーを再起動しています..."
ssh -o StrictHostKeyChecking=accept-new ${USER}@${HOST} << 'EOF'
  echo "  -> 稼働中の古い Flask アプリを停止しています..."
  pkill -f app.py || true
  sleep 1

  echo "  -> データベースのパーミッションを設定しています..."
  chmod 666 /var/www/html/maomao.db || true

  echo "  -> 最新のプログラムで Flask アプリを起動しています..."
  cd /var/www/html
  nohup python3 app.py > app.log 2>&1 &
  
  echo "  -> 再起動処理が完了しました。"
EOF

echo "=================================================="
echo " 🎉 デプロイがすべて正常に完了しました！"
echo "=================================================="
