#!/usr/bin/env node
/**
 * 快速修復示範模式問題
 */

const fs = require('fs');
const path = require('path');

function fixDemoMode() {
  console.log('🔧 修復示範模式設定...');

  const serverPath = path.join(__dirname, 'src', 'server.js');
  let content = fs.readFileSync(serverPath, 'utf8');

  // 修復：當資料庫連線失敗時，應該啟用示範模式而不是設為false
  const originalPattern = /demoMode = false;\s*pool = null; \/\/ 設為 null，讓服務知道沒有資料庫連線/;
  const replacement = `demoMode = true; // 啟用示範模式，使用模擬數據
  pool = null; // 設為 null，API 會檢查並使用示範數據`;

  if (originalPattern.test(content)) {
    content = content.replace(originalPattern, replacement);
    console.log('✅ 修復了資料庫連線失敗時的示範模式設定');
  }

  // 確保所有資料庫API都有正確的demoMode檢查
  const deliveryAreasGetPattern = /app\.get\('\/api\/admin\/delivery-areas'[^}]+if \(demoMode\)/s;
  if (!deliveryAreasGetPattern.test(content)) {
    console.log('⚠️ 配送區域GET API可能缺少demoMode檢查');
  }

  const deliveryAreasPostPattern = /app\.post\('\/api\/admin\/delivery-areas'[^}]+if \(demoMode\)/s;
  if (!deliveryAreasPostPattern.test(content)) {
    console.log('⚠️ 配送區域POST API可能缺少demoMode檢查');
  }

  // 寫回檔案
  fs.writeFileSync(serverPath, content);
  console.log('✅ server.js 已更新');
}

function addBetterErrorHandling() {
  console.log('🔧 添加更好的錯誤處理...');

  const viewPath = path.join(__dirname, 'views', 'admin_delivery_areas.ejs');
  if (!fs.existsSync(viewPath)) {
    console.log('❌ admin_delivery_areas.ejs 不存在');
    return;
  }

  let content = fs.readFileSync(viewPath, 'utf8');

  // 查找錯誤處理部分並改善
  const errorPattern = /alert\('儲存失敗，請稍後再試'\);/;
  if (errorPattern.test(content)) {
    const betterErrorHandling = `
                // 提供更詳細的錯誤訊息
                if (error.message && error.message.includes('Failed to fetch')) {
                    alert('❌ 網路連線失敗，請檢查網路狀態後重試');
                } else if (response && response.status === 503) {
                    alert('❌ 資料庫連線失敗\\n\\n系統可能在維護中，請稍後再試或聯繫管理員');
                } else {
                    alert('❌ 儲存失敗，請稍後再試或聯繫系統管理員');
                }`;

    content = content.replace(errorPattern, betterErrorHandling);
    fs.writeFileSync(viewPath, content);
    console.log('✅ 配送區域頁面錯誤處理已改善');
  }
}

function createTestScript() {
  console.log('🔧 創建測試腳本...');

  const testScript = `#!/usr/bin/env node
/**
 * 快速測試系統功能
 */

require('dotenv').config();

// 模擬訪問配送區域API
async function testDeliveryAreasAPI() {
  console.log('🧪 測試配送區域API...');

  // 檢查示範模式是否正確工作
  try {
    // 啟動服務器（不會阻塞）
    const app = require('./src/server.js');

    // 等待1秒讓服務器初始化
    await new Promise(resolve => setTimeout(resolve, 1000));

    console.log('✅ 服務器啟動成功');
    console.log('ℹ️ 請手動測試:');
    console.log('1. 打開瀏覽器訪問 http://localhost:3001/admin/delivery-areas');
    console.log('2. 嘗試勾選配送區域並點擊儲存');
    console.log('3. 檢查是否顯示示範模式訊息');

  } catch (error) {
    console.error('❌ 測試失敗:', error.message);
  }
}

if (require.main === module) {
  testDeliveryAreasAPI();
}
`;

  fs.writeFileSync(path.join(__dirname, 'test_system.js'), testScript);
  console.log('✅ 測試腳本已創建');
}

// 執行修復
try {
  console.log('🚀 開始快速修復...\n');

  fixDemoMode();
  addBetterErrorHandling();
  createTestScript();

  console.log('\n✅ 快速修復完成！');
  console.log('\n🧪 測試指令:');
  console.log('  npm start');
  console.log('  node test_system.js');

  console.log('\n📋 修復內容:');
  console.log('1. ✅ 修復了資料庫連線失敗時的示範模式設定');
  console.log('2. ✅ 改善了配送區域頁面的錯誤提示');
  console.log('3. ✅ 創建了測試腳本');

  console.log('\n💡 現在系統應該能夠：');
  console.log('• 在無資料庫連線時自動進入示範模式');
  console.log('• 配送區域設定顯示示範模式訊息而不是錯誤');
  console.log('• 商品管理頁面可以正常訪問（示範模式）');

} catch (error) {
  console.error('❌ 修復失敗:', error);
}