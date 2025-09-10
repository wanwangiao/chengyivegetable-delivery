/**
 * 測試 server.js 語法和基本功能
 */

console.log('🔍 測試 server.js 語法和啟動...');

try {
  // 測試語法
  console.log('1. 檢查語法...');
  require('./src/server.js');
  console.log('✅ 語法正確');
  
} catch (error) {
  console.log('❌ 語法錯誤:', error.message);
  process.exit(1);
}

console.log('🎉 所有測試通過');