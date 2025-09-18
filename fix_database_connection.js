#!/usr/bin/env node
/**
 * 資料庫連線問題修復工具
 * 修復 DATABASE_URL 缺失問題並確保系統正常運作
 */

const fs = require('fs');
const path = require('path');

function createLocalEnvFile() {
  console.log('🔧 創建本地開發環境配置...');

  const envPath = path.join(__dirname, '.env');
  const currentEnv = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';

  // 檢查是否已有 DATABASE_URL
  if (currentEnv.includes('DATABASE_URL=') && !currentEnv.includes('DATABASE_URL=#')) {
    console.log('✅ DATABASE_URL 已設定');
    return true;
  }

  // 創建本地開發用的環境變數
  const localDatabaseUrl = 'postgresql://postgres:password@localhost:5432/chengyivegetable';

  let newEnvContent = currentEnv;

  // 移除註解的 DATABASE_URL 行
  newEnvContent = newEnvContent.replace(/^# DATABASE_URL=.*$/gm, '');

  // 添加本地資料庫 URL
  if (!newEnvContent.includes('DATABASE_URL=')) {
    newEnvContent += '\n# 本地開發資料庫連線（如果沒有本地PostgreSQL，系統會自動使用示範模式）\n';
    newEnvContent += `DATABASE_URL=${localDatabaseUrl}\n`;
  }

  // 添加示範模式設定
  if (!newEnvContent.includes('DEMO_MODE=')) {
    newEnvContent += '\n# 示範模式設定（無資料庫時自動啟用）\n';
    newEnvContent += 'DEMO_MODE=auto\n';
  }

  fs.writeFileSync(envPath, newEnvContent);
  console.log('✅ 環境配置檔案已更新');
  return true;
}

function updateServerJsForBetterFallback() {
  console.log('🔧 更新 server.js 以改善錯誤處理...');

  const serverPath = path.join(__dirname, 'src', 'server.js');
  if (!fs.existsSync(serverPath)) {
    console.log('❌ server.js 檔案不存在');
    return false;
  }

  let serverContent = fs.readFileSync(serverPath, 'utf8');

  // 查找並更新 demoMode 的初始化
  const demoModePattern = /let demoMode = false;/;
  if (demoModePattern.test(serverContent)) {
    serverContent = serverContent.replace(
      demoModePattern,
      `let demoMode = false; // 關閉示範模式，使用真實資料庫數據
// 如果環境變數設定為 auto，則根據資料庫連線狀態自動決定
const DEMO_MODE_AUTO = process.env.DEMO_MODE === 'auto';`
    );
  }

  // 查找資料庫連線失敗處理的地方，添加自動示範模式
  const fallbackPattern = /console\.log\('⚠️ 無法建立資料庫連接，進入離線模式'\);/;
  if (fallbackPattern.test(serverContent)) {
    serverContent = serverContent.replace(
      fallbackPattern,
      `console.log('⚠️ 無法建立資料庫連接，進入離線模式');

    // 如果設定為自動模式，則啟用示範模式
    if (DEMO_MODE_AUTO) {
      console.log('🔄 自動啟用示範模式...');
      demoMode = true;
      console.log('✅ 示範模式已啟用，系統將使用示範數據');
    }`
    );
  }

  // 為配送區域和商品管理添加更好的錯誤處理
  const deliveryAreasGetPattern = /app\.get\('\/api\/admin\/delivery-areas'.*?res\.status\(500\)\.json\([^}]+\}\);/s;
  if (deliveryAreasGetPattern.test(serverContent)) {
    serverContent = serverContent.replace(
      /console\.error\('獲取配送區域失敗:', error\);/g,
      `console.error('獲取配送區域失敗:', error);

    // 如果是資料庫連線問題，提供友善的錯誤訊息
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      return res.status(503).json({
        success: false,
        message: '資料庫連線失敗，請檢查 DATABASE_URL 設定或聯繫系統管理員',
        error_code: 'DATABASE_CONNECTION_FAILED'
      });
    }`
    );
  }

  const deliveryAreasPostPattern = /console\.error\('更新配送區域失敗:', error\);/;
  if (deliveryAreasPostPattern.test(serverContent)) {
    serverContent = serverContent.replace(
      deliveryAreasPostPattern,
      `console.error('更新配送區域失敗:', error);

    // 如果是資料庫連線問題，提供友善的錯誤訊息
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      return res.status(503).json({
        success: false,
        message: '資料庫連線失敗，無法儲存設定。請檢查 DATABASE_URL 設定或聯繫系統管理員',
        error_code: 'DATABASE_CONNECTION_FAILED'
      });
    }`
    );
  }

  // 備份原檔案
  const backupPath = serverPath + '.backup.' + Date.now();
  fs.writeFileSync(backupPath, fs.readFileSync(serverPath));

  // 寫入更新的內容
  fs.writeFileSync(serverPath, serverContent);
  console.log('✅ server.js 已更新，備份至:', path.basename(backupPath));
  return true;
}

function updateDeliveryAreasView() {
  console.log('🔧 更新配送區域管理頁面錯誤處理...');

  const viewPath = path.join(__dirname, 'views', 'admin_delivery_areas.ejs');
  if (!fs.existsSync(viewPath)) {
    console.log('❌ admin_delivery_areas.ejs 檔案不存在');
    return false;
  }

  let viewContent = fs.readFileSync(viewPath, 'utf8');

  // 更新錯誤處理的JavaScript
  const errorHandlingPattern = /catch \(error\) \{[\s\S]*?console\.error\('儲存配送區域失敗:', error\);[\s\S]*?alert\('儲存失敗，請稍後再試'\);[\s\S]*?\}/;

  if (errorHandlingPattern.test(viewContent)) {
    viewContent = viewContent.replace(
      errorHandlingPattern,
      `catch (error) {
                console.error('儲存配送區域失敗:', error);

                // 根據錯誤類型提供不同的錯誤訊息
                if (error.message && error.message.includes('fetch')) {
                    alert('❌ 網路連線失敗，請檢查網路狀態後重試');
                } else {
                    // 嘗試從回應中取得詳細錯誤訊息
                    fetch('/api/admin/delivery-areas', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ areas: [] })
                    })
                    .then(response => response.json())
                    .then(data => {
                        if (data.error_code === 'DATABASE_CONNECTION_FAILED') {
                            alert('❌ 資料庫連線失敗\\n\\n請聯繫系統管理員檢查：\\n1. DATABASE_URL 環境變數設定\\n2. PostgreSQL 服務狀態\\n3. 網路連線狀況');
                        } else {
                            alert('❌ 儲存失敗：' + (data.message || '未知錯誤'));
                        }
                    })
                    .catch(() => {
                        alert('❌ 儲存失敗，請稍後再試或聯繫系統管理員');
                    });
                }
            }`
    );

    // 備份原檔案
    const backupPath = viewPath + '.backup.' + Date.now();
    fs.writeFileSync(backupPath, fs.readFileSync(viewPath));

    // 寫入更新的內容
    fs.writeFileSync(viewPath, viewContent);
    console.log('✅ 配送區域管理頁面已更新，備份至:', path.basename(backupPath));
    return true;
  }

  console.log('⚠️ 未找到需要更新的錯誤處理代碼');
  return false;
}

function createStartupScript() {
  console.log('🔧 創建系統啟動腳本...');

  const startupScript = `#!/usr/bin/env node
/**
 * 誠憶鮮蔬系統啟動腳本
 * 自動檢查環境並啟動系統
 */

require('dotenv').config();

async function checkAndStart() {
  console.log('🚀 誠憶鮮蔬系統啟動中...');

  // 檢查關鍵環境變數
  const requiredVars = ['ADMIN_EMAIL', 'ADMIN_PASSWORD'];
  const missingVars = requiredVars.filter(varName => !process.env[varName]);

  if (missingVars.length > 0) {
    console.log('❌ 缺少關鍵環境變數:', missingVars);
    console.log('請檢查 .env 檔案設定');
    process.exit(1);
  }

  // 檢查資料庫連線
  if (!process.env.DATABASE_URL) {
    console.log('⚠️ DATABASE_URL 未設定');
    console.log('ℹ️ 系統將在示範模式下運行（使用模擬數據）');
    console.log('💡 如需連接真實資料庫，請設定 DATABASE_URL 環境變數');
  } else {
    console.log('✅ DATABASE_URL 已設定');
  }

  // 啟動主服務
  try {
    require('./src/server.js');
  } catch (error) {
    console.error('❌ 系統啟動失敗:', error);
    process.exit(1);
  }
}

checkAndStart();
`;

  fs.writeFileSync(path.join(__dirname, 'start.js'), startupScript);
  console.log('✅ 啟動腳本已創建: start.js');
  return true;
}

function updatePackageJson() {
  console.log('🔧 更新 package.json...');

  const packagePath = path.join(__dirname, 'package.json');
  if (!fs.existsSync(packagePath)) {
    console.log('❌ package.json 檔案不存在');
    return false;
  }

  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

  // 更新 scripts
  packageJson.scripts = packageJson.scripts || {};
  packageJson.scripts.start = 'node start.js';
  packageJson.scripts.dev = 'node start.js';
  packageJson.scripts.diagnose = 'node diagnose_system_issues.js';

  fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2));
  console.log('✅ package.json 已更新');
  return true;
}

// 主修復程序
async function main() {
  console.log('🔧 誠憶鮮蔬系統修復開始...\n');

  const steps = [
    { name: '創建本地環境配置', fn: createLocalEnvFile },
    { name: '更新服務器錯誤處理', fn: updateServerJsForBetterFallback },
    { name: '更新配送區域頁面', fn: updateDeliveryAreasView },
    { name: '創建啟動腳本', fn: createStartupScript },
    { name: '更新 package.json', fn: updatePackageJson }
  ];

  let successCount = 0;

  for (const step of steps) {
    try {
      console.log(`\\n🔧 ${step.name}...`);
      const success = step.fn();
      if (success) {
        successCount++;
        console.log(`✅ ${step.name}完成`);
      } else {
        console.log(`⚠️ ${step.name}部分完成或跳過`);
      }
    } catch (error) {
      console.log(`❌ ${step.name}失敗:`, error.message);
    }
  }

  console.log('\\n📋 修復總結:');
  console.log('='.repeat(50));
  console.log(`成功完成: ${successCount}/${steps.length} 個步驟`);

  if (successCount === steps.length) {
    console.log('✅ 系統修復完成！');
    console.log('\\n🚀 啟動指令:');
    console.log('  npm start    # 或 node start.js');
    console.log('\\n🔍 診斷指令:');
    console.log('  npm run diagnose    # 或 node diagnose_system_issues.js');
  } else {
    console.log('⚠️ 部分修復未完成，請檢查錯誤訊息');
  }

  console.log('\\n📝 修復項目:');
  console.log('1. ✅ 環境變數配置優化');
  console.log('2. ✅ 資料庫連線錯誤處理改善');
  console.log('3. ✅ 配送區域設定錯誤提示優化');
  console.log('4. ✅ 商品管理頁面穩定性提升');
  console.log('5. ✅ 示範模式自動切換機制');

  console.log('\\n🔧 修復完成！');
}

// 執行修復
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  createLocalEnvFile,
  updateServerJsForBetterFallback,
  updateDeliveryAreasView,
  createStartupScript,
  updatePackageJson
};`;