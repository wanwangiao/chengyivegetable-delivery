/**
 * 測試新的模組化應用程式
 */

const path = require('path');

// 設置測試環境變數
process.env.NODE_ENV = 'development';
process.env.PORT = '3001';
process.env.DEMO_MODE = 'true';

// 載入基本的環境變數
require('dotenv').config({ path: path.join(__dirname, '.env') });

console.log('🧪 開始測試新的模組化應用程式...');
console.log('📍 測試環境變數:');
console.log('  - NODE_ENV:', process.env.NODE_ENV);
console.log('  - PORT:', process.env.PORT);
console.log('  - DEMO_MODE:', process.env.DEMO_MODE);
console.log('  - DATABASE_URL:', process.env.DATABASE_URL ? '已設定' : '未設定');

try {
  // 測試控制器載入
  console.log('\n🔧 測試控制器載入...');
  const { controllerManager } = require('./src/controllers');
  console.log('✅ 控制器管理器載入成功');

  const controllers = controllerManager.getAllControllers();
  console.log('✅ 控制器數量:', Object.keys(controllers).length);

  // 測試控制器健康狀態
  const health = controllerManager.checkHealth();
  console.log('✅ 控制器健康狀態:', health.status);

  // 測試應用程式類別載入
  console.log('\n🔧 測試應用程式類別載入...');
  const VegetableDeliveryApp = require('./src/app');
  console.log('✅ 應用程式類別載入成功');

  // 建立應用程式實例（但不啟動）
  const app = new VegetableDeliveryApp();
  console.log('✅ 應用程式實例建立成功');

  console.log('\n🎉 所有基本測試通過！');
  console.log('💡 如果要啟動完整的應用程式，請執行: node src/app.js');

} catch (error) {
  console.error('\n❌ 測試失敗:', error.message);
  console.error('📍 錯誤詳情:', error.stack);
  process.exit(1);
}