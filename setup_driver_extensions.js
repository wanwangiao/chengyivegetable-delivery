#!/usr/bin/env node

/**
 * 外送員系統擴展安裝腳本
 * 自動安裝依賴、建立資料庫表、設置目錄權限
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚀 開始安裝外送員系統擴展...\n');

// 步驟 1: 檢查並安裝 sharp 套件
console.log('📦 1. 檢查並安裝圖片處理套件...');
try {
    require('sharp');
    console.log('✅ Sharp 套件已安裝');
} catch (error) {
    console.log('⏳ 安裝 Sharp 套件中...');
    try {
        execSync('npm install sharp --save', { stdio: 'inherit' });
        console.log('✅ Sharp 套件安裝完成');
    } catch (installError) {
        console.error('❌ Sharp 套件安裝失敗:', installError.message);
        console.log('🔧 請手動執行: npm install sharp');
    }
}

// 步驟 2: 建立上傳目錄
console.log('\n📁 2. 建立上傳目錄...');
const uploadDirs = [
    'uploads',
    'uploads/delivery_photos',
    'uploads/delivery_photos/compressed'
];

uploadDirs.forEach(dir => {
    const fullPath = path.join(process.cwd(), dir);
    if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true });
        console.log(`✅ 創建目錄: ${dir}`);
    } else {
        console.log(`ℹ️  目錄已存在: ${dir}`);
    }
});

// 步驟 3: 檢查環境變數設定
console.log('\n🔧 3. 檢查環境變數設定...');
const requiredEnvVars = [
    'LINE_CHANNEL_ACCESS_TOKEN',
    'LINE_CHANNEL_SECRET'
];

const optionalEnvVars = [
    'ADMIN_LINE_ID',
    'LINE_ADMIN_USER_ID',
    'BASE_URL'
];

let missingRequired = [];
let missingOptional = [];

requiredEnvVars.forEach(varName => {
    if (!process.env[varName]) {
        missingRequired.push(varName);
    } else {
        console.log(`✅ ${varName}: 已設定`);
    }
});

optionalEnvVars.forEach(varName => {
    if (!process.env[varName]) {
        missingOptional.push(varName);
    } else {
        console.log(`✅ ${varName}: 已設定`);
    }
});

if (missingRequired.length > 0) {
    console.log('\n⚠️  缺少必要環境變數:');
    missingRequired.forEach(varName => {
        console.log(`   - ${varName}`);
    });
}

if (missingOptional.length > 0) {
    console.log('\n📋 建議設定的環境變數:');
    missingOptional.forEach(varName => {
        console.log(`   - ${varName}`);
    });
}

// 步驟 4: 生成環境變數範例文件
console.log('\n📝 4. 生成環境變數範例文件...');
const envExample = `# 外送員系統擴展環境變數設定範例

# LINE Bot 基本設定（必需）
LINE_CHANNEL_ACCESS_TOKEN=your_line_channel_access_token_here
LINE_CHANNEL_SECRET=your_line_channel_secret_here

# 管理員通知設定（建議）
ADMIN_LINE_ID=your_admin_line_user_id
LINE_ADMIN_USER_ID=your_admin_line_user_id

# 網站設定（建議）
BASE_URL=https://yourdomain.com

# 資料庫設定（如需要）
DATABASE_URL=postgresql://username:password@localhost:5432/database_name

# 其他設定
NODE_ENV=production
PORT=3000
`;

const envExamplePath = path.join(process.cwd(), '.env.driver.example');
fs.writeFileSync(envExamplePath, envExample);
console.log(`✅ 環境變數範例文件已建立: ${envExamplePath}`);

// 步驟 5: 檢查資料庫設定
console.log('\n🗄️  5. 資料庫設定提醒...');
console.log('📋 請執行以下步驟建立資料庫表:');
console.log('   1. 連接到您的 PostgreSQL 資料庫');
console.log('   2. 執行: \\i driver_extensions_schema.sql');
console.log('   3. 或使用: psql -f driver_extensions_schema.sql');

// 步驟 6: 檢查靜態檔案服務
console.log('\n🌐 6. 靜態檔案服務檢查...');
const serverJsPath = path.join(process.cwd(), 'src', 'server.js');
if (fs.existsSync(serverJsPath)) {
    const serverContent = fs.readFileSync(serverJsPath, 'utf8');
    if (serverContent.includes('/uploads')) {
        console.log('✅ 靜態檔案服務已配置');
    } else {
        console.log('⚠️  需要在 server.js 中添加靜態檔案服務:');
        console.log('   app.use(\'/uploads\', express.static(\'uploads\'));');
    }
} else {
    console.log('ℹ️  找不到 server.js 檔案，請手動設定靜態檔案服務');
}

// 步驟 7: 生成測試腳本
console.log('\n🧪 7. 生成測試腳本...');
const testScript = `#!/bin/bash

# 外送員系統擴展 API 測試腳本

echo "🧪 開始測試外送員系統擴展 API..."

BASE_URL="http://localhost:3000/api/driver"

# 測試 1: 獲取訂單統計
echo "📊 測試獲取統計..."
curl -s "$BASE_URL/stats" | jq '.'

# 測試 2: 測試問題回報 (需要有效的 orderId)
echo "🚨 測試問題回報..."
curl -s -X POST "$BASE_URL/report-problem" \\
  -H "Content-Type: application/json" \\
  -d '{
    "orderId": 1,
    "problemType": "customer_not_home",
    "description": "測試問題回報",
    "priority": "medium"
  }' | jq '.'

# 測試 3: 處理離線佇列
echo "🔄 測試離線佇列處理..."
curl -s -X POST "$BASE_URL/process-offline-queue" | jq '.'

# 測試 4: 查看訂單照片
echo "📷 測試獲取訂單照片..."
curl -s "$BASE_URL/order-photos/1" | jq '.'

echo "✅ 測試完成！"
`;

const testScriptPath = path.join(process.cwd(), 'test_driver_api.sh');
fs.writeFileSync(testScriptPath, testScript);
console.log(`✅ 測試腳本已建立: ${testScriptPath}`);

// 步驟 8: 權限設定
console.log('\n🔒 8. 設定檔案權限...');
try {
    if (process.platform !== 'win32') {
        execSync(`chmod +x "${testScriptPath}"`);
        console.log('✅ 測試腳本執行權限已設定');
    }
} catch (error) {
    console.log('ℹ️  跳過權限設定（Windows 系統）');
}

// 完成總結
console.log('\n🎉 外送員系統擴展安裝完成！\n');
console.log('📋 後續步驟:');
console.log('1. 設定環境變數（參考 .env.driver.example）');
console.log('2. 執行資料庫建立腳本: driver_extensions_schema.sql');
console.log('3. 重啟應用程式');
console.log('4. 使用測試腳本驗證功能: ./test_driver_api.sh');
console.log('5. 參考 DRIVER_API_DOCUMENTATION.md 了解 API 使用方式\n');

console.log('💡 提示: 在示範模式下，所有功能都可以正常測試，不需要實際的 LINE 設定');
console.log('');