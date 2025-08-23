const { Pool } = require('pg');

async function testConnection() {
  // 測試您提到的密碼
  const testUrl = "postgresql://postgres.cywcuzgbuqmxjxwyrrsp:@chengyivegetable@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres";
  
  console.log('🔧 測試密碼: @chengyivegetable');
  console.log('🔍 連線字串:', testUrl);
  
  const pool = new Pool({
    connectionString: testUrl,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    // 測試連線
    const client = await pool.connect();
    console.log('✅ 資料庫連線成功！');
    
    // 測試商品查詢
    const result = await client.query('SELECT id, name, price FROM products ORDER BY id LIMIT 10');
    console.log('📦 商品資料：');
    result.rows.forEach(product => {
      console.log(`  ${product.id}: ${product.name} - $${product.price}`);
    });
    
    // 測試庫存查詢
    const inventoryResult = await client.query('SELECT product_id, current_stock FROM inventory LIMIT 5');
    console.log('📋 庫存資料：');
    inventoryResult.rows.forEach(item => {
      console.log(`  商品${item.product_id}: ${item.current_stock}個`);
    });
    
    client.release();
    console.log('✅ 測試完成');
    
  } catch (error) {
    console.log('❌ 連線或查詢失敗:', error.message);
    
    if (error.message.includes('password authentication failed')) {
      console.log('🔑 密碼驗證失敗 - 嘗試其他密碼格式');
    }
  }
  
  await pool.end();
}

testConnection();