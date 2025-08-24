const { Pool } = require('pg');
require('dotenv').config();

console.log('🔧 測試資料庫連線...');
console.log('DATABASE_URL:', process.env.DATABASE_URL ? '已設定' : '未設定');

async function testConnection() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 30000,
    max: 1
  });

  try {
    console.log('⏳ 嘗試連線...');
    const result = await pool.query('SELECT NOW() as current_time, COUNT(*) as product_count FROM products');
    console.log('✅ 資料庫連線成功！');
    console.log('📅 當前時間:', result.rows[0].current_time);
    console.log('📦 商品數量:', result.rows[0].product_count);
    
    // 測試庫存數據
    const inventoryResult = await pool.query('SELECT COUNT(*) as inventory_count FROM inventory');
    console.log('📋 庫存記錄數量:', inventoryResult.rows[0].inventory_count);
    
  } catch (error) {
    console.log('❌ 資料庫連線失敗:', error.message);
    console.log('🔍 錯誤碼:', error.code);
  } finally {
    await pool.end();
  }
}

testConnection();