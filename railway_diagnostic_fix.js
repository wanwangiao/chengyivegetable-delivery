#!/usr/bin/env node
/**
 * Railway 診斷和修復腳本
 * 檢查資料庫連接、表結構，並修復常見問題
 */

require('dotenv').config();
const { Pool } = require('pg');

console.log('🔍 開始 Railway 系統診斷...');

async function diagnosticAndFix() {
  let pool = null;

  try {
    // 1. 檢查環境變數
    console.log('\n📋 環境變數檢查:');
    const requiredVars = [
      'DATABASE_URL',
      'ADMIN_PASSWORD',
      'SESSION_SECRET',
      'LINE_CHANNEL_ACCESS_TOKEN',
      'LINE_LIFF_ID'
    ];

    const missingVars = [];
    requiredVars.forEach(varName => {
      if (process.env[varName]) {
        console.log(`✅ ${varName}: 已設置`);
      } else {
        console.log(`❌ ${varName}: 未設置`);
        missingVars.push(varName);
      }
    });

    if (missingVars.length > 0) {
      console.log(`\n⚠️  缺少 ${missingVars.length} 個必要環境變數`);
    }

    // 2. 嘗試資料庫連接
    console.log('\n🔌 資料庫連接測試:');

    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL 環境變數未設置');
    }

    const dbConfig = {
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 15000,
    };

    pool = new Pool(dbConfig);

    // 測試連接
    const client = await pool.connect();
    console.log('✅ 資料庫連接成功');

    // 3. 檢查表結構
    console.log('\n🗄️  資料庫表結構檢查:');

    const tables = ['products', 'orders', 'drivers', 'users'];
    const missingTables = [];

    for (const tableName of tables) {
      try {
        const result = await client.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables
            WHERE table_name = $1
          );
        `, [tableName]);

        if (result.rows[0].exists) {
          console.log(`✅ ${tableName} 表存在`);

          // 檢查基本欄位
          const columns = await client.query(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = $1
          `, [tableName]);

          console.log(`   📊 ${tableName} 有 ${columns.rows.length} 個欄位`);

        } else {
          console.log(`❌ ${tableName} 表不存在`);
          missingTables.push(tableName);
        }
      } catch (error) {
        console.log(`❌ 檢查 ${tableName} 表時發生錯誤: ${error.message}`);
        missingTables.push(tableName);
      }
    }

    // 4. 修復缺少的表
    if (missingTables.length > 0) {
      console.log(`\n🔧 發現 ${missingTables.length} 個缺少的表，開始修復...`);

      // 創建 products 表
      if (missingTables.includes('products')) {
        console.log('🔨 創建 products 表...');
        await client.query(`
          CREATE TABLE IF NOT EXISTS products (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            price DECIMAL(10,2) NOT NULL DEFAULT 0,
            unit_hint VARCHAR(100),
            is_priced_item BOOLEAN DEFAULT false,
            is_available BOOLEAN DEFAULT true,
            image_url TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
          );
        `);

        // 插入一些示範商品
        await client.query(`
          INSERT INTO products (name, price, unit_hint, is_priced_item, is_available) VALUES
          ('青江菜', 30.0, '一份', false, true),
          ('白蘿蔔', 25.0, '一條', false, true),
          ('高麗菜', 35.0, '一顆', false, true),
          ('紅蘿蔔', 20.0, '一包', false, true),
          ('菠菜', 40.0, '一把', false, true)
          ON CONFLICT DO NOTHING;
        `);
        console.log('✅ products 表創建完成，並插入示範商品');
      }

      // 創建 orders 表
      if (missingTables.includes('orders')) {
        console.log('🔨 創建 orders 表...');
        await client.query(`
          CREATE TABLE IF NOT EXISTS orders (
            id SERIAL PRIMARY KEY,
            contact_name VARCHAR(255) NOT NULL,
            contact_phone VARCHAR(20) NOT NULL,
            address TEXT NOT NULL,
            line_user_id VARCHAR(255),
            total_amount DECIMAL(10,2) NOT NULL,
            payment_method VARCHAR(50) DEFAULT 'cash',
            delivery_fee DECIMAL(10,2) DEFAULT 0,
            status VARCHAR(50) DEFAULT 'pending',
            driver_id INTEGER,
            notes TEXT,
            lat DECIMAL(10,7),
            lng DECIMAL(10,7),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
          );
        `);
        console.log('✅ orders 表創建完成');
      }

      // 創建 drivers 表
      if (missingTables.includes('drivers')) {
        console.log('🔨 創建 drivers 表...');
        await client.query(`
          CREATE TABLE IF NOT EXISTS drivers (
            id SERIAL PRIMARY KEY,
            driver_code VARCHAR(50) UNIQUE,
            name VARCHAR(255) NOT NULL,
            phone VARCHAR(20) UNIQUE NOT NULL,
            password_hash VARCHAR(255),
            status VARCHAR(50) DEFAULT 'active',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
          );
        `);

        // 插入示範外送員
        await client.query(`
          INSERT INTO drivers (driver_code, name, phone, password_hash, status) VALUES
          ('DEMO001', '示範外送員', '0912345678', 'demo123', 'active')
          ON CONFLICT (phone) DO NOTHING;
        `);
        console.log('✅ drivers 表創建完成，並插入示範外送員');
      }

      // 創建 users 表（LINE用戶）
      if (missingTables.includes('users')) {
        console.log('🔨 創建 users 表...');
        await client.query(`
          CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            line_user_id VARCHAR(255) UNIQUE,
            display_name VARCHAR(255),
            phone VARCHAR(20),
            email VARCHAR(255),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
          );
        `);
        console.log('✅ users 表創建完成');
      }
    }

    // 5. 測試基本查詢
    console.log('\n🧪 基本查詢測試:');

    try {
      const productsCount = await client.query('SELECT COUNT(*) FROM products');
      console.log(`✅ products 表查詢成功，共有 ${productsCount.rows[0].count} 個商品`);
    } catch (error) {
      console.log(`❌ products 表查詢失敗: ${error.message}`);
    }

    try {
      const ordersCount = await client.query('SELECT COUNT(*) FROM orders');
      console.log(`✅ orders 表查詢成功，共有 ${ordersCount.rows[0].count} 個訂單`);
    } catch (error) {
      console.log(`❌ orders 表查詢失敗: ${error.message}`);
    }

    client.release();

    console.log('\n🎉 診斷完成！');
    console.log('\n📋 診斷結果摘要:');
    console.log(`   - 缺少環境變數: ${missingVars.length} 個`);
    console.log(`   - 修復資料庫表: ${missingTables.length} 個`);
    console.log(`   - 資料庫連接: ✅ 正常`);

    return {
      success: true,
      missingVars,
      repairedTables: missingTables
    };

  } catch (error) {
    console.error('\n❌ 診斷過程中發生錯誤:', error.message);
    console.error('詳細錯誤:', error);

    return {
      success: false,
      error: error.message
    };

  } finally {
    if (pool) {
      await pool.end();
      console.log('🔒 資料庫連接已關閉');
    }
  }
}

// 如果直接執行此腳本
if (require.main === module) {
  diagnosticAndFix()
    .then(result => {
      if (result.success) {
        console.log('\n✅ 所有診斷和修復操作已完成');
        process.exit(0);
      } else {
        console.log('\n❌ 診斷失敗');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('\n💥 未處理的錯誤:', error);
      process.exit(1);
    });
}

module.exports = { diagnosticAndFix };