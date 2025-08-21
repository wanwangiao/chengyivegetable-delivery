@echo off
echo 🚀 啟動 LINE Bot 開發環境
echo.

echo 📋 步驟1: 啟動本地伺服器 (端口3005)
start cmd /k "cd /d %~dp0 && PORT=3005 node src/server.js"

echo.
echo ⏳ 等待伺服器啟動... (10秒)
timeout /t 10

echo.
echo 📋 步驟2: 建立ngrok隧道
echo 💡 請複製出現的 https://xxxxxx.ngrok.io 網址
echo 💡 這就是您的臨時網域，用於設定LINE Bot
echo.

ngrok http 3005