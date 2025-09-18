#!/usr/bin/env node
/**
 * 系統問題診斷工具
 * 檢查配送區域設定和商品管理功能
 */

const { Pool } = require('pg');

// 環境變數檢查
function checkEnvironmentVariables() {
  console.log('🔍 檢查環境變數...');

  const requiredVars = [
    'DATABASE_URL',
    'ADMIN_EMAIL',
    'ADMIN_PASSWORD',
    'NODE_ENV'
  ];

  const missing = [];
  const existing = [];

  requiredVars.forEach(varName => {
    if (process.env[varName]) {
      existing.push(varName);
    } else {
      missing.push(varName);
    }
  });

  console.log('✅ 已設定的環境變數:', existing);
  if (missing.length > 0) {
    console.log('⚠️  缺少的環境變數:', missing);
  }

  return missing.length === 0;
}

// 資料庫連線檢查
async function checkDatabaseConnection() {
  console.log('🔍 檢查資料庫連線...');

  if (!process.env.DATABASE_URL) {
    console.log('❌ DATABASE_URL 未設定');
    return false;
  }

  try {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });

    const result = await pool.query('SELECT NOW() as current_time, version() as db_version');
    console.log('✅ 資料庫連線成功');
    console.log('📊 資料庫時間:', result.rows[0].current_time);
    console.log('📊 資料庫版本:', result.rows[0].db_version.split(' ')[0]);

    await pool.end();
    return true;
  } catch (error) {
    console.log('❌ 資料庫連線失敗:', error.message);
    return false;
  }
}

// 檢查關鍵表是否存在
async function checkDatabaseTables() {
  console.log('🔍 檢查資料庫表結構...');

  if (!process.env.DATABASE_URL) {
    console.log('❌ 無法檢查表結構：DATABASE_URL 未設定');
    return false;
  }

  try {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });

    const requiredTables = [
      'products',
      'delivery_areas',
      'orders',
      'users',
      'system_settings'
    ];

    const existingTables = [];
    const missingTables = [];

    for (const table of requiredTables) {
      try {
        const result = await pool.query(`
          SELECT table_name
          FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = $1
        `, [table]);

        if (result.rows.length > 0) {
          existingTables.push(table);
        } else {
          missingTables.push(table);
        }
      } catch (error) {
        missingTables.push(table);
      }
    }

    console.log('✅ 存在的表:', existingTables);
    if (missingTables.length > 0) {
      console.log('⚠️  缺少的表:', missingTables);
    }

    await pool.end();
    return missingTables.length === 0;
  } catch (error) {
    console.log('❌ 檢查表結構失敗:', error.message);
    return false;
  }
}

// 檢查配送區域功能
async function checkDeliveryAreas() {
  console.log('🔍 檢查配送區域功能...');

  if (!process.env.DATABASE_URL) {
    console.log('❌ 無法檢查配送區域：DATABASE_URL 未設定');
    return false;
  }

  try {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });

    // 檢查表結構
    const tableStructure = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'delivery_areas'
      ORDER BY ordinal_position
    `);

    console.log('📋 delivery_areas 表結構:');
    tableStructure.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? 'NOT NULL' : 'NULLABLE'}`);
    });

    // 檢查現有數據
    const dataCount = await pool.query('SELECT COUNT(*) as count FROM delivery_areas');
    console.log('📊 配送區域數據量:', dataCount.rows[0].count);

    if (parseInt(dataCount.rows[0].count) > 0) {
      const sampleData = await pool.query('SELECT city, district, enabled FROM delivery_areas LIMIT 5');
      console.log('📋 配送區域範例數據:');
      sampleData.rows.forEach(row => {
        console.log(`  - ${row.city} ${row.district}: ${row.enabled ? '啟用' : '停用'}`);
      });
    }

    await pool.end();
    return true;
  } catch (error) {
    console.log('❌ 檢查配送區域失敗:', error.message);
    return false;
  }
}

// 檢查商品管理功能
async function checkProducts() {
  console.log('🔍 檢查商品管理功能...');

  if (!process.env.DATABASE_URL) {
    console.log('❌ 無法檢查商品：DATABASE_URL 未設定');
    return false;
  }

  try {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });

    // 檢查表結構
    const tableStructure = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'products'
      ORDER BY ordinal_position
    `);

    console.log('📋 products 表結構:');
    tableStructure.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? 'NOT NULL' : 'NULLABLE'}`);
    });

    // 檢查現有數據
    const dataCount = await pool.query('SELECT COUNT(*) as count FROM products');
    console.log('📊 商品數據量:', dataCount.rows[0].count);

    if (parseInt(dataCount.rows[0].count) > 0) {
      const sampleData = await pool.query(`
        SELECT id, name, price, is_priced_item, is_available
        FROM products
        ORDER BY id
        LIMIT 5
      `);
      console.log('📋 商品範例數據:');
      sampleData.rows.forEach(row => {
        console.log(`  - ID:${row.id} ${row.name}: $${row.price} ${row.is_available ? '上架' : '下架'}`);
      });
    }

    await pool.end();
    return true;
  } catch (error) {
    console.log('❌ 檢查商品失敗:', error.message);
    return false;
  }
}

// 模擬API測試
async function testDeliveryAreasAPI() {
  console.log('🔍 測試配送區域 API...');

  if (!process.env.DATABASE_URL) {
    console.log('❌ 無法測試 API：DATABASE_URL 未設定');
    return false;
  }

  try {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });

    // 模擬GET請求
    console.log('🔸 測試 GET /api/admin/delivery-areas');
    const getResult = await pool.query('SELECT city, district, enabled FROM delivery_areas WHERE enabled = true ORDER BY city, district');
    console.log('✅ GET 請求模擬成功，返回', getResult.rows.length, '個區域');

    // 模擬POST請求（只檢查語法，不實際執行）
    console.log('🔸 測試 POST /api/admin/delivery-areas 語法');
    const testAreas = [
      { city: '台北市', district: '中正區', enabled: true },
      { city: '台北市', district: '大安區', enabled: true }
    ];

    // 檢查DELETE和INSERT語法是否正確
    await pool.query('BEGIN');
    await pool.query('DELETE FROM delivery_areas WHERE 1=0'); // 不會刪除任何數據

    for (const area of testAreas) {
      await pool.query(
        'INSERT INTO delivery_areas (city, district, enabled) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
        [area.city, area.district, area.enabled]
      );
    }

    await pool.query('ROLLBACK'); // 回滾測試更改
    console.log('✅ POST 請求語法驗證成功');

    await pool.end();
    return true;
  } catch (error) {
    console.log('❌ API 測試失敗:', error.message);
    return false;
  }
}

// 主診斷程序
async function main() {
  console.log('🔍 誠憶鮮蔬系統診斷開始...\n');

  const results = {
    env: false,
    database: false,
    tables: false,
    deliveryAreas: false,
    products: false,
    api: false
  };

  try {
    results.env = checkEnvironmentVariables();
    console.log('');

    if (results.env) {
      results.database = await checkDatabaseConnection();
      console.log('');

      if (results.database) {
        results.tables = await checkDatabaseTables();
        console.log('');

        results.deliveryAreas = await checkDeliveryAreas();
        console.log('');

        results.products = await checkProducts();
        console.log('');

        results.api = await testDeliveryAreasAPI();
        console.log('');
      }
    }

    // 總結報告
    console.log('📋 診斷結果總結:');
    console.log('='.repeat(50));
    console.log(`環境變數檢查: ${results.env ? '✅ 通過' : '❌ 失敗'}`);
    console.log(`資料庫連線: ${results.database ? '✅ 通過' : '❌ 失敗'}`);
    console.log(`表結構檢查: ${results.tables ? '✅ 通過' : '❌ 失敗'}`);
    console.log(`配送區域功能: ${results.deliveryAreas ? '✅ 通過' : '❌ 失敗'}`);
    console.log(`商品管理功能: ${results.products ? '✅ 通過' : '❌ 失敗'}`);
    console.log(`API 測試: ${results.api ? '✅ 通過' : '❌ 失敗'}`);

    const allPassed = Object.values(results).every(r => r);
    console.log('='.repeat(50));
    console.log(`整體狀態: ${allPassed ? '✅ 系統正常' : '⚠️  發現問題'}`);

    if (!allPassed) {
      console.log('\n🔧 建議修復步驟:');
      if (!results.env) {
        console.log('1. 檢查 .env 檔案中的環境變數設定');
      }
      if (!results.database) {
        console.log('2. 檢查 DATABASE_URL 設定和網路連線');
      }
      if (!results.tables) {
        console.log('3. 執行資料庫遷移腳本建立缺少的表');
      }
      if (!results.deliveryAreas || !results.products) {
        console.log('4. 檢查表結構是否完整，可能需要重新建立');
      }
      if (!results.api) {
        console.log('5. 檢查 server.js 中的 API 路由設定');
      }
    }

  } catch (error) {
    console.error('❌ 診斷過程發生錯誤:', error);
  }

  console.log('\n🔍 診斷完成!');
}

// 執行診斷
if (require.main === module) {
  require('dotenv').config();
  main().catch(console.error);
}

module.exports = {
  checkEnvironmentVariables,
  checkDatabaseConnection,
  checkDatabaseTables,
  checkDeliveryAreas,
  checkProducts,
  testDeliveryAreasAPI
};