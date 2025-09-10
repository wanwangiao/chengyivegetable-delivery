/**
 * 測試遷移腳本 - 驗證自動遷移是否正常工作
 * 這會模擬伺服器啟動時的遷移過程
 */

const { Pool } = require('pg');

// 從不同的資料庫來源嘗試連接
async function testDatabaseConnection() {
  const connectionOptions = [
    // Railway 環境變數
    {
      name: 'Railway DATABASE_URL',
      config: {
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
      }
    },
    // Supabase (從 package.json 中發現的)
    {
      name: 'Supabase',
      config: {
        connectionString: 'postgresql://postgres:Chengyivegetable2025!@db.cywcuzgbuqmxjxwyrrsp.supabase.co:5432/postgres?sslmode=require',
        ssl: { rejectUnauthorized: false }
      }
    },
    // DigitalOcean (如果有密碼)
    {
      name: 'DigitalOcean',
      config: {
        host: 'db-postgresql-sgp1-67006-do-user-16407903-0.c.db.ondigitalocean.com',
        port: 25060,
        database: 'defaultdb',
        user: 'doadmin',
        password: process.env.DB_PASSWORD || '請設置 DB_PASSWORD 環境變數',
        ssl: { rejectUnauthorized: false }
      }
    }
  ];

  console.log('🔍 測試資料庫連線...');

  for (const option of connectionOptions) {
    if (option.name === 'Railway DATABASE_URL' && !process.env.DATABASE_URL) {
      console.log(`⏭️  跳過 ${option.name}: 環境變數未設置`);
      continue;
    }
    
    if (option.name === 'DigitalOcean' && (!process.env.DB_PASSWORD || process.env.DB_PASSWORD === '請設置 DB_PASSWORD 環境變數')) {
      console.log(`⏭️  跳過 ${option.name}: 密碼未提供`);
      continue;
    }

    try {
      console.log(`🔗 嘗試連接 ${option.name}...`);
      
      const pool = new Pool(option.config);
      
      // 設置連線超時
      const client = await Promise.race([
        pool.connect(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('連線超時')), 10000)
        )
      ]);

      // 測試查詢
      const result = await client.query('SELECT NOW() as current_time, version() as db_version');
      console.log(`✅ ${option.name} 連線成功!`);
      console.log(`   時間: ${result.rows[0].current_time}`);
      console.log(`   版本: ${result.rows[0].db_version.substring(0, 50)}...`);

      client.release();
      
      return { pool, name: option.name };
      
    } catch (error) {
      console.log(`❌ ${option.name} 連線失敗: ${error.message}`);
      continue;
    }
  }
  
  throw new Error('所有資料庫連線選項都失敗');
}

// 測試遷移功能
async function testMigration() {
  try {
    console.log('🚀 開始遷移測試...\n');
    
    // 嘗試建立資料庫連線
    const { pool, name: dbName } = await testDatabaseConnection();
    console.log(`\n📊 使用資料庫: ${dbName}\n`);
    
    // 載入遷移模組
    const { executeAllStartupMigrations } = require('./auto_migrate_on_startup');
    
    console.log('🔧 執行遷移測試...');
    const migrationResult = await executeAllStartupMigrations(pool);
    
    console.log('\n📋 遷移結果:');
    console.log(JSON.stringify(migrationResult, null, 2));
    
    // 額外驗證 - 檢查表結構
    console.log('\n🔍 驗證表結構...');
    const tableInfo = await pool.query(`
      SELECT 
        column_name, 
        data_type, 
        is_nullable, 
        column_default
      FROM information_schema.columns 
      WHERE table_name = 'orders'
      ORDER BY ordinal_position
    `);
    
    console.log('📊 orders 表結構:');
    tableInfo.rows.forEach((row, index) => {
      console.log(`   ${index + 1}. ${row.column_name}: ${row.data_type}${row.is_nullable === 'NO' ? ' (NOT NULL)' : ''}`);
      if (row.column_default) {
        console.log(`      預設值: ${row.column_default}`);
      }
    });
    
    // 檢查是否有現有訂單
    const orderCount = await pool.query('SELECT COUNT(*) as count FROM orders');
    console.log(`\n📈 總訂單數量: ${orderCount.rows[0].count}`);
    
    if (parseInt(orderCount.rows[0].count) > 0) {
      const paymentMethodStats = await pool.query(`
        SELECT 
          COALESCE(payment_method, 'NULL') as payment_method,
          COUNT(*) as count,
          ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as percentage
        FROM orders 
        GROUP BY payment_method
        ORDER BY count DESC
      `);
      
      console.log('\n💳 付款方式分布:');
      paymentMethodStats.rows.forEach(row => {
        console.log(`   ${row.payment_method}: ${row.count} 筆 (${row.percentage}%)`);
      });
    }
    
    await pool.end();
    console.log('\n🎉 遷移測試完成!');
    
    return true;
    
  } catch (error) {
    console.error('\n❌ 遷移測試失敗:', error);
    console.error('錯誤詳情:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.log('\n💡 建議解決方案:');
      console.log('1. 檢查資料庫服務是否運行');
      console.log('2. 確認網路連線正常');
      console.log('3. 驗證連線資訊是否正確');
      console.log('4. 如果使用 DigitalOcean，請設置 DB_PASSWORD 環境變數:');
      console.log('   set DB_PASSWORD=your_password && node test_migration.js');
    }
    
    return false;
  }
}

// 如果直接執行此文件
if (require.main === module) {
  testMigration()
    .then(success => {
      console.log(success ? '\n✅ 測試通過' : '\n❌ 測試失敗');
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('\n💥 測試過程發生未預期錯誤:', error);
      process.exit(1);
    });
}

module.exports = { testMigration };