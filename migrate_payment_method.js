/**
 * 資料庫遷移腳本：新增 payment_method 欄位
 * 執行命令：node migrate_payment_method.js
 */

const { Pool } = require('pg');
require('dotenv').config();

// 資料庫連線設定 - 使用您的 DigitalOcean PostgreSQL
const pool = new Pool({
  host: 'db-postgresql-sgp1-67006-do-user-16407903-0.c.db.ondigitalocean.com',
  port: 25060,
  database: 'defaultdb',
  user: 'doadmin',
  password: process.env.DATABASE_PASSWORD || '請輸入資料庫密碼',
  ssl: { rejectUnauthorized: false }
});

const migrationSQL = `
-- 為orders表添加payment_method欄位
-- 執行日期: 2025-09-10
-- 用途: 修復前台結帳時的訂單提交錯誤

-- 檢查欄位是否已存在，如果不存在則添加
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='orders' AND column_name='payment_method') THEN
        ALTER TABLE orders ADD COLUMN payment_method TEXT DEFAULT 'cash';
        
        -- 更新現有記錄的預設付款方式
        UPDATE orders SET payment_method = 'cash' WHERE payment_method IS NULL;
        
        RAISE NOTICE 'payment_method 欄位已成功添加到 orders 表';
    ELSE
        RAISE NOTICE 'payment_method 欄位已存在於 orders 表中';
    END IF;
END $$;

-- 建立索引以提升查詢效能
CREATE INDEX IF NOT EXISTS idx_orders_payment_method ON orders(payment_method);
`;

async function runMigration() {
  try {
    console.log('🔧 開始執行資料庫遷移...');
    console.log('📊 連接資料庫: DigitalOcean PostgreSQL');
    
    const client = await pool.connect();
    console.log('✅ 資料庫連線成功');
    
    try {
      // 執行遷移 SQL
      const result = await client.query(migrationSQL);
      console.log('✅ 遷移 SQL 執行成功');
      
      // 檢查結果
      const checkResult = await client.query(`
        SELECT column_name, data_type, column_default 
        FROM information_schema.columns 
        WHERE table_name = 'orders' AND column_name = 'payment_method'
      `);
      
      if (checkResult.rows.length > 0) {
        console.log('✅ payment_method 欄位確認存在');
        console.log('📋 欄位詳情:', checkResult.rows[0]);
      } else {
        console.log('❌ payment_method 欄位未找到');
      }
      
      // 檢查索引
      const indexResult = await client.query(`
        SELECT indexname 
        FROM pg_indexes 
        WHERE tablename = 'orders' AND indexname = 'idx_orders_payment_method'
      `);
      
      if (indexResult.rows.length > 0) {
        console.log('✅ 索引 idx_orders_payment_method 已建立');
      } else {
        console.log('⚠️ 索引 idx_orders_payment_method 未找到');
      }
      
      // 檢查現有訂單數量
      const orderCountResult = await client.query('SELECT COUNT(*) as count FROM orders');
      console.log(`📊 現有訂單數量: ${orderCountResult.rows[0].count}`);
      
      console.log('🎉 資料庫遷移完成！');
      
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('❌ 資料庫遷移失敗:', error);
    console.error('錯誤詳情:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// 執行遷移
runMigration();