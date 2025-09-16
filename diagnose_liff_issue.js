#!/usr/bin/env node

/**
 * LIFF 問題診斷腳本
 * 用於排查為什麼 LIFF 頁面顯示 "LIFF ID 未設定" 錯誤
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 LIFF 問題診斷開始');
console.log('=' .repeat(50));

// 1. 檢查當前環境變數
console.log('\n📋 1. 檢查當前 Node.js 環境變數:');
require('dotenv').config();
console.log('  NODE_ENV:', process.env.NODE_ENV || 'undefined');
console.log('  PORT:', process.env.PORT || 'undefined');
console.log('  LINE_LIFF_ID:', process.env.LINE_LIFF_ID || 'undefined');
console.log('  LINE_CHANNEL_ID:', process.env.LINE_CHANNEL_ID || 'undefined');
console.log('  LINE_CHANNEL_SECRET:', process.env.LINE_CHANNEL_SECRET ? 'SET (length: ' + process.env.LINE_CHANNEL_SECRET.length + ')' : 'undefined');
console.log('  LINE_CHANNEL_ACCESS_TOKEN:', process.env.LINE_CHANNEL_ACCESS_TOKEN ? 'SET (length: ' + process.env.LINE_CHANNEL_ACCESS_TOKEN.length + ')' : 'undefined');

// 2. 檢查 .env 文件
console.log('\n📋 2. 檢查本地 .env 文件:');
const envFiles = ['.env', '.env.local', '.env.production', 'src/.env'];
envFiles.forEach(envFile => {
  const envPath = path.join(__dirname, envFile);
  if (fs.existsSync(envPath)) {
    console.log(`  ✅ 找到 ${envFile}`);
    const content = fs.readFileSync(envPath, 'utf8');
    const lines = content.split('\n').filter(line => line.includes('LINE'));
    if (lines.length > 0) {
      console.log(`    LINE 相關設定:`);
      lines.forEach(line => {
        if (line.trim() && !line.startsWith('#')) {
          console.log(`      ${line.trim()}`);
        }
      });
    } else {
      console.log(`    沒有 LINE 相關設定`);
    }
  } else {
    console.log(`  ❌ 沒有找到 ${envFile}`);
  }
});

// 3. 檢查 railway.toml
console.log('\n📋 3. 檢查 railway.toml 設定:');
const railwayPath = path.join(__dirname, 'railway.toml');
if (fs.existsSync(railwayPath)) {
  console.log('  ✅ 找到 railway.toml');
  const content = fs.readFileSync(railwayPath, 'utf8');
  const lines = content.split('\n').filter(line => line.includes('LINE'));
  if (lines.length > 0) {
    console.log('    LINE 相關設定:');
    lines.forEach(line => {
      if (line.trim() && !line.startsWith('#')) {
        console.log(`      ${line.trim()}`);
      }
    });
  } else {
    console.log('    沒有 LINE 相關設定');
  }
} else {
  console.log('  ❌ 沒有找到 railway.toml');
}

// 4. 檢查 package.json
console.log('\n📋 4. 檢查 package.json:');
const packagePath = path.join(__dirname, 'package.json');
if (fs.existsSync(packagePath)) {
  const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  console.log('  ✅ 項目名稱:', pkg.name);
  console.log('  ✅ 版本:', pkg.version);
  console.log('  ✅ 主要文件:', pkg.main);
  console.log('  ✅ 啟動命令:', pkg.scripts?.start || 'undefined');
  
  // 檢查是否有 dotenv 依賴
  const hasDotenv = pkg.dependencies?.dotenv || pkg.devDependencies?.dotenv;
  console.log('  ✅ dotenv 依賴:', hasDotenv ? '已安裝 (' + hasDotenv + ')' : '未安裝');
} else {
  console.log('  ❌ 沒有找到 package.json');
}

// 5. 檢查 server.js 中的環境變數處理
console.log('\n📋 5. 檢查 server.js 環境變數處理:');
const serverPath = path.join(__dirname, 'src', 'server.js');
if (fs.existsSync(serverPath)) {
  const content = fs.readFileSync(serverPath, 'utf8');
  
  // 檢查 dotenv 載入
  const hasDotenvConfig = content.includes("require('dotenv').config()");
  console.log('  ✅ dotenv 配置:', hasDotenvConfig ? '已配置' : '未配置');
  
  // 檢查 LIFF 路由
  const hasLiffRoute = content.includes("/liff-entry");
  console.log('  ✅ LIFF 路由:', hasLiffRoute ? '已定義' : '未定義');
  
  // 檢查環境變數使用
  const liffIdUsage = content.match(/process\.env\.LINE_LIFF_ID/g);
  console.log('  ✅ LINE_LIFF_ID 使用次數:', liffIdUsage ? liffIdUsage.length : 0);
  
} else {
  console.log('  ❌ 沒有找到 src/server.js');
}

// 6. 檢查 LIFF entry 視圖文件
console.log('\n📋 6. 檢查 LIFF entry 視圖文件:');
const liffViewPath = path.join(__dirname, 'views', 'liff_entry.ejs');
if (fs.existsSync(liffViewPath)) {
  console.log('  ✅ 找到 views/liff_entry.ejs');
  const content = fs.readFileSync(liffViewPath, 'utf8');
  
  // 檢查 LIFF ID 使用
  const liffIdUsage = content.includes('<%= liffId %>');
  console.log('  ✅ liffId 變數使用:', liffIdUsage ? '正確' : '錯誤');
  
  // 檢查錯誤訊息來源
  const errorMessage = content.includes('LIFF ID 未設定');
  console.log('  ✅ 錯誤訊息來源:', errorMessage ? '在視圖文件中' : '在 JavaScript 邏輯中');
  
} else {
  console.log('  ❌ 沒有找到 views/liff_entry.ejs');
}

// 7. 提供診斷結果和建議
console.log('\n🎯 診斷結果和建議:');
console.log('=' .repeat(50));

const liffId = process.env.LINE_LIFF_ID;
if (!liffId) {
  console.log('❌ 問題確認: LINE_LIFF_ID 環境變數未正確設定');
  console.log('\n🔧 可能的解決方案:');
  console.log('1. 檢查 Railway 部署環境中的環境變數設定');
  console.log('2. 確認 railway.toml 中的變數是否正確部署');
  console.log('3. 重新部署應用程式以重新載入環境變數');
  console.log('4. 檢查 dotenv 是否在生產環境中正確載入');
} else {
  console.log('✅ LINE_LIFF_ID 在本地環境中正確設定:', liffId);
  console.log('\n🔧 如果線上仍有問題，請檢查:');
  console.log('1. Railway 部署日誌中的環境變數載入情況');
  console.log('2. 瀏覽器開發者工具中的實際 LIFF ID 值');
  console.log('3. 網路請求是否正確傳遞環境變數');
}

console.log('\n🌐 測試 URL:');
console.log('  本地: http://localhost:3000/api/line/debug');
console.log('  線上: https://chengyivegetable-production-7b4a.up.railway.app/api/line/debug');
console.log('  LIFF: https://chengyivegetable-production-7b4a.up.railway.app/liff-entry');

console.log('\n✅ 診斷完成！');