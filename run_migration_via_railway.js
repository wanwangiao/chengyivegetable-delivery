/**
 * 透過現有的 server.js 資料庫連線執行遷移
 * 這個腳本會嘗試連接到與 server.js 相同的資料庫
 */

const express = require('express');
const { Pool } = require('pg');

// 使用與 server.js 相同的資料庫連線邏輯
let pool;

// 嘗試建立資料庫連線
function createDatabasePool() {
  let databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    // 如果沒有 DATABASE_URL，使用 Supabase 連線字串
    databaseUrl = 'postgresql://postgres:Chengyivegetable2025!@db.cywcuzgbuqmxjxwyrrsp.supabase.co:5432/postgres?sslmode=require';
    console.log('⚠️ 未找到 DATABASE_URL 環境變數，使用 Supabase 連線字串');
  } else {
    console.log('✅ 使用 DATABASE_URL 環境變數');
  }

  console.log('🔗 嘗試連接資料庫...');
  console.log('📊 資料庫主機:', databaseUrl.includes('supabase') ? 'Supabase' : (databaseUrl.includes('digitalocean') ? 'DigitalOcean' : '其他'));

  try {
    pool = new Pool({
      connectionString: databaseUrl,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      // 增加連線超時設定
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 30000,
    });

    return pool;
  } catch (error) {
    console.error('❌ 建立資料庫連線池失敗:', error);
    throw error;
  }
}

const migrationSQL = `
-- 為orders表添加payment_method欄位
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='orders' AND column_name='payment_method') THEN
        ALTER TABLE orders ADD COLUMN payment_method TEXT DEFAULT 'cash';
        UPDATE orders SET payment_method = 'cash' WHERE payment_method IS NULL;
        RAISE NOTICE 'payment_method 欄位已成功添加到 orders 表';
    ELSE
        RAISE NOTICE 'payment_method 欄位已存在於 orders 表中';
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_orders_payment_method ON orders(payment_method);
`;

async function runMigration() {
  try {
    console.log('🚀 開始執行資料庫遷移...');
    
    // 建立資料庫連線
    const dbPool = createDatabasePool();
    
    // 測試連線
    const client = await dbPool.connect();
    console.log('✅ 資料庫連線成功');
    
    try {
      // 檢查當前表結構
      console.log('🔍 檢查當前 orders 表結構...');
      const currentSchema = await client.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_name = 'orders' 
        ORDER BY ordinal_position
      `);
      
      console.log('📋 當前欄位:');
      currentSchema.rows.forEach(col => {
        console.log(`   ${col.column_name}: ${col.data_type} ${col.is_nullable === 'YES' ? '(nullable)' : '(not null)'}`);
      });
      
      // 執行遷移
      console.log('🔧 執行遷移 SQL...');
      await client.query(migrationSQL);
      console.log('✅ 遷移 SQL 執行完成');
      
      // 驗證結果
      const updatedSchema = await client.query(`
        SELECT column_name, data_type, column_default 
        FROM information_schema.columns 
        WHERE table_name = 'orders' AND column_name = 'payment_method'
      `);
      
      if (updatedSchema.rows.length > 0) {
        console.log('✅ payment_method 欄位已成功添加');
        console.log('📋 欄位詳情:', updatedSchema.rows[0]);
      } else {
        console.log('⚠️ payment_method 欄位未找到');
      }
      
      // 檢查現有資料
      const orderCount = await client.query('SELECT COUNT(*) as count FROM orders');
      const paymentMethodCount = await client.query(`
        SELECT payment_method, COUNT(*) as count 
        FROM orders 
        GROUP BY payment_method
      `);
      
      console.log(`📊 總訂單數: ${orderCount.rows[0].count}`);
      console.log('📊 付款方式分布:');
      paymentMethodCount.rows.forEach(row => {
        console.log(`   ${row.payment_method || 'NULL'}: ${row.count} 筆`);
      });
      
      console.log('🎉 資料庫遷移成功完成！');
      
    } finally {
      client.release();
    }
    
    await dbPool.end();
    console.log('👋 資料庫連線已關閉');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ 遷移失敗:', error);
    console.error('錯誤詳情:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.log('\n💡 建議：');
      console.log('1. 檢查資料庫密碼是否正確');
      console.log('2. 確認網路連線正常');
      console.log('3. 驗證資料庫服務是否運行中');
    }
    
    process.exit(1);
  }
}

// 如果直接執行這個檔案
if (require.main === module) {
  runMigration();
} else {
  module.exports = { runMigration };
}