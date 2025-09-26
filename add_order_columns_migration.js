/**
 * 資料庫遷移腳本：新增訂單表格遺漏的欄位
 */

require('dotenv').config();
const { Pool } = require('pg');

// 使用環境變數中的資料庫連線資訊
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function runMigration() {
  console.log('🔄 開始資料庫遷移：新增訂單表格欄位...');

  try {
    // 檢查並新增遺漏的欄位
    const migrations = [
      {
        name: 'updated_at',
        sql: 'ALTER TABLE orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()'
      },
      {
        name: 'cancelled_at',
        sql: 'ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP'
      },
      {
        name: 'cancel_reason',
        sql: 'ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancel_reason TEXT'
      },
      {
        name: 'driver_id',
        sql: 'ALTER TABLE orders ADD COLUMN IF NOT EXISTS driver_id INTEGER'
      },
      {
        name: 'line_user_id',
        sql: 'ALTER TABLE orders ADD COLUMN IF NOT EXISTS line_user_id TEXT'
      }
    ];

    for (const migration of migrations) {
      console.log(`📝 新增欄位: ${migration.name}`);
      await pool.query(migration.sql);
    }

    console.log('✅ 資料庫遷移完成！');
    console.log('📊 檢查目前的訂單表格結構...');

    // 檢查表格結構
    const result = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'orders'
      ORDER BY ordinal_position
    `);

    console.log('📋 orders 表格欄位：');
    result.rows.forEach(row => {
      console.log(`  - ${row.column_name} (${row.data_type}, nullable: ${row.is_nullable})`);
    });

  } catch (error) {
    console.error('❌ 資料庫遷移失敗:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

// 執行遷移
if (require.main === module) {
  runMigration().catch(error => {
    console.error('❌ 遷移腳本執行失敗:', error);
    process.exit(1);
  });
}

module.exports = runMigration;