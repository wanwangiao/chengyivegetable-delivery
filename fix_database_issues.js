#!/usr/bin/env node
/**
 * 修復資料庫問題腳本
 * 1. 修復連接池配置問題
 * 2. 創建缺少的表和欄位
 */

const { Pool } = require('pg');

console.log('🔧 開始修復資料庫問題...');

async function fixDatabaseIssues() {
  let pool = null;
  let client = null;

  try {
    // 修改資料庫配置，增加更好的穩定性
    const dbConfig = {
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      max: 10, // 減少連接數量
      min: 2,  // 最小連接數
      idleTimeoutMillis: 60000,  // 增加空閒超時
      connectionTimeoutMillis: 20000, // 增加連接超時
      acquireTimeoutMillis: 20000,    // 增加獲取連接超時
      statement_timeout: 30000,       // SQL 語句超時
      query_timeout: 30000,          // 查詢超時
      application_name: 'chengyivegetable_fix',
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000
    };

    console.log('🔌 建立資料庫連接池...');
    pool = new Pool(dbConfig);

    // 獲取客戶端連接
    client = await pool.connect();
    console.log('✅ 資料庫連接成功');

    console.log('🗃️ 檢查並修復表結構...');

    // 1. 檢查並創建 products 表
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
    console.log('✅ products 表檢查完成');

    // 2. 檢查並創建 orders 表
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
    console.log('✅ orders 表檢查完成');

    // 3. 檢查並創建 order_items 表（修復 oi.price 錯誤）
    await client.query(`
      CREATE TABLE IF NOT EXISTS order_items (
        id SERIAL PRIMARY KEY,
        order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
        product_id INTEGER REFERENCES products(id),
        product_name VARCHAR(255) NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 1,
        price DECIMAL(10,2) NOT NULL,
        unit_price DECIMAL(10,2) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ order_items 表檢查完成');

    // 4. 檢查並創建 drivers 表
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
    console.log('✅ drivers 表檢查完成');

    // 5. 檢查並創建 users 表
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
    console.log('✅ users 表檢查完成');

    // 6. 插入示範資料
    console.log('📝 插入示範資料...');

    // 示範商品
    const productResult = await client.query('SELECT COUNT(*) FROM products');
    if (parseInt(productResult.rows[0].count) === 0) {
      await client.query(`
        INSERT INTO products (name, price, unit_hint, is_priced_item, is_available) VALUES
        ('青江菜', 30.0, '一份', false, true),
        ('白蘿蔔', 25.0, '一條', false, true),
        ('高麗菜', 35.0, '一顆', false, true),
        ('紅蘿蔔', 20.0, '一包', false, true),
        ('菠菜', 40.0, '一把', false, true),
        ('小白菜', 28.0, '一份', false, true),
        ('韭菜', 45.0, '一把', false, true),
        ('芹菜', 38.0, '一份', false, true);
      `);
      console.log('✅ 示範商品資料插入完成');
    } else {
      console.log('ℹ️ 商品資料已存在，跳過插入');
    }

    // 示範外送員
    const driverResult = await client.query('SELECT COUNT(*) FROM drivers');
    if (parseInt(driverResult.rows[0].count) === 0) {
      await client.query(`
        INSERT INTO drivers (driver_code, name, phone, password_hash, status) VALUES
        ('DEMO001', '示範外送員', '0912345678', 'demo123', 'active'),
        ('DEMO002', '測試外送員', '0912345679', 'test123', 'active');
      `);
      console.log('✅ 示範外送員資料插入完成');
    } else {
      console.log('ℹ️ 外送員資料已存在，跳過插入');
    }

    // 7. 測試關鍵查詢
    console.log('🧪 測試關鍵查詢...');

    try {
      const productsTest = await client.query(`
        SELECT id, name, price, is_priced_item, unit_hint, is_available
        FROM products
        ORDER BY name
        LIMIT 5
      `);
      console.log(`✅ products 查詢測試成功，找到 ${productsTest.rows.length} 個商品`);
    } catch (error) {
      console.error('❌ products 查詢測試失敗:', error.message);
    }

    try {
      const ordersTest = await client.query(`
        SELECT o.id, o.contact_name, o.total_amount, o.status,
               oi.product_name, oi.quantity, oi.price
        FROM orders o
        LEFT JOIN order_items oi ON o.id = oi.order_id
        LIMIT 5
      `);
      console.log(`✅ orders 查詢測試成功，找到 ${ordersTest.rows.length} 個訂單`);
    } catch (error) {
      console.error('❌ orders 查詢測試失敗:', error.message);
    }

    // 8. 優化連接池設置
    console.log('⚡ 優化連接池設置...');

    // 設置資料庫參數以提高穩定性
    await client.query(`
      SET statement_timeout = '30s';
      SET lock_timeout = '10s';
      SET idle_in_transaction_session_timeout = '60s';
    `);
    console.log('✅ 資料庫參數優化完成');

    client.release();
    console.log('🎉 資料庫修復完成！');

    // 摘要報告
    const productsCount = await pool.query('SELECT COUNT(*) FROM products');
    const ordersCount = await pool.query('SELECT COUNT(*) FROM orders');
    const driversCount = await pool.query('SELECT COUNT(*) FROM drivers');

    console.log('\n📊 資料庫狀態摘要:');
    console.log(`   - 商品數量: ${productsCount.rows[0].count}`);
    console.log(`   - 訂單數量: ${ordersCount.rows[0].count}`);
    console.log(`   - 外送員數量: ${driversCount.rows[0].count}`);

    return {
      success: true,
      summary: {
        products: parseInt(productsCount.rows[0].count),
        orders: parseInt(ordersCount.rows[0].count),
        drivers: parseInt(driversCount.rows[0].count)
      }
    };

  } catch (error) {
    console.error('❌ 修復過程中發生錯誤:', error.message);
    console.error('詳細錯誤:', error);

    return {
      success: false,
      error: error.message
    };

  } finally {
    if (client) {
      client.release();
    }
    if (pool) {
      await pool.end();
      console.log('🔒 資料庫連接已關閉');
    }
  }
}

// 如果直接執行此腳本
if (require.main === module) {
  fixDatabaseIssues()
    .then(result => {
      if (result.success) {
        console.log('\n✅ 所有修復操作已完成');
        process.exit(0);
      } else {
        console.log('\n❌ 修復失敗');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('\n💥 未處理的錯誤:', error);
      process.exit(1);
    });
}

module.exports = { fixDatabaseIssues };