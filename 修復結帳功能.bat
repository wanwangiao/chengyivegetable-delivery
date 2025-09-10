@echo off
chcp 65001
title 誠憶鮮蔬 - 結帳功能修復工具

echo ==========================================
echo 🥬 誠憶鮮蔬結帳功能修復工具
echo ==========================================
echo.
echo 這個工具會修復結帳時出現的「資料驗證失敗」錯誤
echo.
echo 📋 修復內容：
echo   ✓ 為 orders 表添加 payment_method 欄位
echo   ✓ 設定所有現有訂單為現金付款
echo   ✓ 建立索引提升查詢效能
echo.

cd /d "C:\Users\黃士嘉\誠憶鮮蔬線上系統"

echo 🚀 啟動修復程式...
echo.

node "一鍵修復.js"

echo.
echo ==========================================
echo 修復程式已結束
pause