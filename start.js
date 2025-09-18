require('dotenv').config();

console.log('🚀 誠憶鮮蔬系統啟動中...');

if (!process.env.DATABASE_URL) {
  console.log('⚠️ DATABASE_URL 未設定，系統將在示範模式下運行');
}

require('./src/server.js');
