/**
 * 資料庫初始化路由
 * 用於在Railway環境中透過網頁初始化資料庫結構
 */

const express = require('express');
const router = express.Router();

/**
 * 資料庫初始化API
 * GET /api/admin/init-database
 */
router.get('/init-database', async (req, res) => {
  let client = null;

  try {
    console.log('🚀 開始資料庫初始化...');

    // 檢查是否有資料庫連接池
    const pool = req.app.locals.pool;
    if (!pool) {
      throw new Error('資料庫連接池未初始化');
    }

    // 獲取資料庫客戶端
    client = await pool.connect();
    console.log('✅ 資料庫連接成功');

    const initResults = [];
    let errorCount = 0;

    // 1. 創建 products 表
    try {
      console.log('📦 創建 products 表...');
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
      initResults.push('✅ products 表創建成功');
      console.log('✅ products 表創建完成');
    } catch (error) {
      initResults.push(`❌ products 表創建失敗: ${error.message}`);
      errorCount++;
      console.error('❌ products 表創建失敗:', error.message);
    }

    // 2. 創建 orders 表
    try {
      console.log('📋 創建 orders 表...');
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
      initResults.push('✅ orders 表創建成功');
      console.log('✅ orders 表創建完成');
    } catch (error) {
      initResults.push(`❌ orders 表創建失敗: ${error.message}`);
      errorCount++;
      console.error('❌ orders 表創建失敗:', error.message);
    }

    // 3. 創建 order_items 表（關鍵！）
    try {
      console.log('📝 創建 order_items 表...');
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
      initResults.push('✅ order_items 表創建成功');
      console.log('✅ order_items 表創建完成');
    } catch (error) {
      initResults.push(`❌ order_items 表創建失敗: ${error.message}`);
      errorCount++;
      console.error('❌ order_items 表創建失敗:', error.message);
    }

    // 4. 創建 drivers 表
    try {
      console.log('🚚 創建 drivers 表...');
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
      initResults.push('✅ drivers 表創建成功');
      console.log('✅ drivers 表創建完成');
    } catch (error) {
      initResults.push(`❌ drivers 表創建失敗: ${error.message}`);
      errorCount++;
      console.error('❌ drivers 表創建失敗:', error.message);
    }

    // 5. 創建 users 表（LINE用戶）
    try {
      console.log('👤 創建 users 表...');
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
      initResults.push('✅ users 表創建成功');
      console.log('✅ users 表創建完成');
    } catch (error) {
      initResults.push(`❌ users 表創建失敗: ${error.message}`);
      errorCount++;
      console.error('❌ users 表創建失敗:', error.message);
    }

    // 6. 插入示範資料
    try {
      console.log('📝 插入示範商品資料...');
      const productCheck = await client.query('SELECT COUNT(*) FROM products');
      if (parseInt(productCheck.rows[0].count) === 0) {
        await client.query(`
          INSERT INTO products (name, price, unit_hint, is_priced_item, is_available) VALUES
          ('青江菜', 30.0, '一份', false, true),
          ('白蘿蔔', 25.0, '一條', false, true),
          ('高麗菜', 35.0, '一顆', false, true),
          ('紅蘿蔔', 20.0, '一包', false, true),
          ('菠菜', 40.0, '一把', false, true),
          ('小白菜', 28.0, '一份', false, true),
          ('韭菜', 45.0, '一把', false, true),
          ('芹菜', 38.0, '一份', false, true),
          ('空心菜', 32.0, '一份', false, true),
          ('地瓜葉', 30.0, '一份', false, true)
        `);
        initResults.push('✅ 示範商品資料插入成功');
        console.log('✅ 示範商品資料插入完成');
      } else {
        initResults.push('ℹ️ 商品資料已存在，跳過插入');
        console.log('ℹ️ 商品資料已存在');
      }
    } catch (error) {
      initResults.push(`❌ 示範商品資料插入失敗: ${error.message}`);
      errorCount++;
      console.error('❌ 示範商品資料插入失敗:', error.message);
    }

    try {
      console.log('🚚 插入示範外送員資料...');
      const driverCheck = await client.query('SELECT COUNT(*) FROM drivers');
      if (parseInt(driverCheck.rows[0].count) === 0) {
        await client.query(`
          INSERT INTO drivers (driver_code, name, phone, password_hash, status) VALUES
          ('DEMO001', '示範外送員', '0912345678', 'demo123', 'active'),
          ('DEMO002', '測試外送員', '0912345679', 'test123', 'active')
        `);
        initResults.push('✅ 示範外送員資料插入成功');
        console.log('✅ 示範外送員資料插入完成');
      } else {
        initResults.push('ℹ️ 外送員資料已存在，跳過插入');
        console.log('ℹ️ 外送員資料已存在');
      }
    } catch (error) {
      initResults.push(`❌ 示範外送員資料插入失敗: ${error.message}`);
      errorCount++;
      console.error('❌ 示範外送員資料插入失敗:', error.message);
    }

    // 7. 測試關鍵查詢
    try {
      console.log('🧪 測試關鍵查詢...');

      // 測試商品查詢
      const productsTest = await client.query(`
        SELECT id, name, price, is_priced_item, unit_hint, is_available
        FROM products
        ORDER BY name
        LIMIT 5
      `);
      initResults.push(`✅ products 查詢測試成功，找到 ${productsTest.rows.length} 個商品`);

      // 測試訂單查詢（包含 order_items）
      const ordersTest = await client.query(`
        SELECT o.id, o.contact_name, o.total_amount, o.status,
               oi.product_name, oi.quantity, oi.price
        FROM orders o
        LEFT JOIN order_items oi ON o.id = oi.order_id
        LIMIT 5
      `);
      initResults.push(`✅ orders 查詢測試成功，找到 ${ordersTest.rows.length} 個訂單`);

    } catch (error) {
      initResults.push(`❌ 查詢測試失敗: ${error.message}`);
      errorCount++;
      console.error('❌ 查詢測試失敗:', error.message);
    }

    // 8. 獲取最終統計
    const finalStats = {};
    try {
      const productsCount = await client.query('SELECT COUNT(*) FROM products');
      const ordersCount = await client.query('SELECT COUNT(*) FROM orders');
      const driversCount = await client.query('SELECT COUNT(*) FROM drivers');
      const usersCount = await client.query('SELECT COUNT(*) FROM users');

      finalStats.products = parseInt(productsCount.rows[0].count);
      finalStats.orders = parseInt(ordersCount.rows[0].count);
      finalStats.drivers = parseInt(driversCount.rows[0].count);
      finalStats.users = parseInt(usersCount.rows[0].count);

      initResults.push(`📊 最終統計: 商品 ${finalStats.products} 個, 訂單 ${finalStats.orders} 個, 外送員 ${finalStats.drivers} 個, 用戶 ${finalStats.users} 個`);
    } catch (error) {
      initResults.push(`❌ 統計查詢失敗: ${error.message}`);
      errorCount++;
    }

    console.log('🎉 資料庫初始化完成！');

    // 回傳結果
    res.json({
      success: errorCount === 0,
      message: errorCount === 0 ? '資料庫初始化完成' : `資料庫初始化完成，但有 ${errorCount} 個錯誤`,
      results: initResults,
      statistics: finalStats,
      errorCount: errorCount,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('💥 資料庫初始化失敗:', error);
    res.status(500).json({
      success: false,
      message: '資料庫初始化失敗',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  } finally {
    if (client) {
      client.release();
      console.log('🔒 資料庫連接已釋放');
    }
  }
});

/**
 * 資料庫狀態檢查API
 * GET /api/admin/database-status
 */
router.get('/database-status', async (req, res) => {
  let client = null;

  try {
    const pool = req.app.locals.pool;
    if (!pool) {
      throw new Error('資料庫連接池未初始化');
    }

    client = await pool.connect();

    const tables = ['products', 'orders', 'order_items', 'drivers', 'users'];
    const status = {};

    for (const tableName of tables) {
      try {
        // 檢查表是否存在
        const exists = await client.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables
            WHERE table_name = $1
          );
        `, [tableName]);

        if (exists.rows[0].exists) {
          // 獲取記錄數量
          const count = await client.query(`SELECT COUNT(*) FROM ${tableName}`);
          status[tableName] = {
            exists: true,
            count: parseInt(count.rows[0].count)
          };
        } else {
          status[tableName] = {
            exists: false,
            count: 0
          };
        }
      } catch (error) {
        status[tableName] = {
          exists: false,
          error: error.message
        };
      }
    }

    res.json({
      success: true,
      message: '資料庫狀態檢查完成',
      tables: status,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: '資料庫狀態檢查失敗',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  } finally {
    if (client) {
      client.release();
    }
  }
});

module.exports = router;