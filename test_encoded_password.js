const { Pool } = require('pg');

async function testEncodedPassword() {
  // URL編碼版本：! 變成 %21
  const encodedUrl = "postgresql://postgres.cywcuzgbuqmxjxwyrrsp:Chengyi2025%21Fresh@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres";
  
  console.log('🔧 測試URL編碼版本密碼');
  
  const pool = new Pool({
    connectionString: encodedUrl,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    const client = await pool.connect();
    console.log('✅ URL編碼密碼連線成功！');
    
    const result = await client.query('SELECT COUNT(*) as count FROM products');
    console.log('📦 商品總數:', result.rows[0].count);
    
    client.release();
    
  } catch (error) {
    console.log('❌ URL編碼密碼連線失敗:', error.message);
    console.log('⏰ 可能需要等待密碼生效（1-2分鐘）');
  }
  
  await pool.end();
}

testEncodedPassword();