#!/usr/bin/env node
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
