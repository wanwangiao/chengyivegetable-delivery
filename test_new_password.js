const { Pool } = require('pg');

async function testNewPassword() {
  const newUrl = "postgresql://postgres.cywcuzgbuqmxjxwyrrsp:Chengyi2025!Fresh@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres";
  
  console.log('🔧 測試新密碼: Chengyi2025!Fresh');
  
  const pool = new Pool({
    connectionString: newUrl,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    const client = await pool.connect();
    console.log('✅ 新密碼連線成功！');
    
    const result = await client.query('SELECT COUNT(*) as count FROM products');
    console.log('📦 商品總數:', result.rows[0].count);
    
    const inventoryResult = await client.query('SELECT COUNT(*) as count FROM inventory');
    console.log('📋 庫存記錄總數:', inventoryResult.rows[0].count);
    
    client.release();
    
  } catch (error) {
    console.log('❌ 新密碼連線失敗:', error.message);
  }
  
  await pool.end();
}

testNewPassword();