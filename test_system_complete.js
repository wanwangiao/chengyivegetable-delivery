const { Pool } = require('pg');
const axios = require('axios');

console.log('🧪 誠憶鮮蔬外送系統完整測試');
console.log('=====================================');

// 測試1: 檢查環境變數
async function testEnvironmentVariables() {
  console.log('\n📋 測試1: 環境變數檢查');
  console.log('  NODE_ENV:', process.env.NODE_ENV || '未設定');
  console.log('  PORT:', process.env.PORT || '未設定');
  console.log('  DATABASE_URL:', process.env.DATABASE_URL ? '已設定' : '未設定');
  
  if (process.env.DATABASE_URL) {
    console.log('  DATABASE_URL格式:', process.env.DATABASE_URL.substring(0, 20) + '...');
  }
}

// 測試2: 資料庫連接測試
async function testDatabaseConnection() {
  console.log('\n🔗 測試2: 資料庫連接測試');
  
  const methods = [
    {
      name: '環境變數連線',
      config: process.env.DATABASE_URL ? {
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 10000,
        family: 4
      } : null
    },
    {
      name: 'Supabase直接連線',
      config: {
        host: '18.206.107.106',
        port: 5432,
        database: 'postgres',
        user: 'postgres',
        password: 'Chengyivegetable2025!',
        ssl: { rejectUnauthorized: false, servername: 'db.cywcuzgbuqmxjxwyrrsp.supabase.co' },
        connectionTimeoutMillis: 10000,
        family: 4
      }
    }
  ];
  
  for (const method of methods) {
    if (!method.config) {
      console.log(`  ⚠️ ${method.name}: 跳過（配置未設定）`);
      continue;
    }
    
    try {
      console.log(`  🔄 嘗試 ${method.name}...`);
      const pool = new Pool(method.config);
      const result = await pool.query('SELECT NOW() as current_time, version() as db_version');
      console.log(`  ✅ ${method.name}: 成功`);
      console.log(`    時間: ${result.rows[0].current_time}`);
      console.log(`    版本: ${result.rows[0].db_version.substring(0, 50)}...`);
      
      // 檢查重要表
      const tables = ['orders', 'drivers', 'products'];
      for (const table of tables) {
        try {
          const count = await pool.query(`SELECT COUNT(*) as count FROM ${table}`);
          console.log(`    ${table}表: ${count.rows[0].count}筆記錄`);
        } catch (error) {
          console.log(`    ${table}表: 不存在或錯誤 (${error.message})`);
        }
      }
      
      await pool.end();
      return pool;
    } catch (error) {
      console.log(`  ❌ ${method.name}: 失敗 - ${error.message}`);
    }
  }
  
  return null;
}

// 測試3: 檢查測試訂單
async function testOrderData(pool) {
  if (!pool) {
    console.log('\n📦 測試3: 訂單資料檢查 - 跳過（無資料庫連線）');
    return;
  }
  
  console.log('\n📦 測試3: 訂單資料檢查');
  
  try {
    // 連接使用相同配置
    const testPool = new Pool({
      host: '18.206.107.106',
      port: 5432,
      database: 'postgres',
      user: 'postgres',
      password: 'Chengyivegetable2025!',
      ssl: { rejectUnauthorized: false, servername: 'db.cywcuzgbuqmxjxwyrrsp.supabase.co' },
      connectionTimeoutMillis: 10000,
      family: 4
    });
    
    const orders = await testPool.query('SELECT order_id, status, customer_name FROM orders ORDER BY created_at DESC');
    console.log(`  總訂單數: ${orders.rows.length}`);
    
    const testOrders = orders.rows.filter(order => order.order_id.startsWith('TEST'));
    console.log(`  測試訂單數: ${testOrders.length}`);
    
    if (testOrders.length > 0) {
      console.log('  測試訂單詳情:');
      testOrders.forEach(order => {
        console.log(`    ${order.order_id}: ${order.status} - ${order.customer_name}`);
      });
    }
    
    const packedOrders = orders.rows.filter(order => order.status === 'packed');
    console.log(`  可接單(packed)訂單數: ${packedOrders.length}`);
    
    await testPool.end();
  } catch (error) {
    console.log('  ❌ 訂單資料檢查失敗:', error.message);
  }
}

// 測試4: 檢查外送員資料
async function testDriverData() {
  console.log('\n🚗 測試4: 外送員資料檢查');
  
  try {
    const pool = new Pool({
      host: '18.206.107.106',
      port: 5432,
      database: 'postgres',
      user: 'postgres',
      password: 'Chengyivegetable2025!',
      ssl: { rejectUnauthorized: false, servername: 'db.cywcuzgbuqmxjxwyrrsp.supabase.co' },
      connectionTimeoutMillis: 10000,
      family: 4
    });
    
    const drivers = await pool.query('SELECT driver_id, phone, name, status FROM drivers');
    console.log(`  外送員總數: ${drivers.rows.length}`);
    
    const testDriver = drivers.rows.find(driver => driver.phone === '0912345678');
    if (testDriver) {
      console.log('  ✅ 測試外送員存在:');
      console.log(`    ID: ${testDriver.driver_id}`);
      console.log(`    電話: ${testDriver.phone}`);
      console.log(`    姓名: ${testDriver.name}`);
      console.log(`    狀態: ${testDriver.status}`);
    } else {
      console.log('  ❌ 測試外送員(0912345678)不存在');
    }
    
    await pool.end();
  } catch (error) {
    console.log('  ❌ 外送員資料檢查失敗:', error.message);
  }
}

// 測試5: 啟動伺服器測試
async function testServerStartup() {
  console.log('\n🚀 測試5: 伺服器啟動測試');
  
  // 設定測試埠號
  process.env.PORT = '3002';
  
  const { spawn } = require('child_process');
  
  return new Promise((resolve) => {
    const server = spawn('node', ['src/server.js'], {
      cwd: process.cwd(),
      env: { ...process.env, PORT: '3002' }
    });
    
    let output = '';
    let startupSuccessful = false;
    
    server.stdout.on('data', (data) => {
      const text = data.toString();
      output += text;
      console.log('  📝', text.trim());
      
      if (text.includes('系統正在監聽埠號')) {
        startupSuccessful = true;
      }
    });
    
    server.stderr.on('data', (data) => {
      const text = data.toString();
      output += text;
      console.log('  ⚠️', text.trim());
    });
    
    // 5秒後檢查結果
    setTimeout(() => {
      server.kill();
      
      if (startupSuccessful) {
        console.log('  ✅ 伺服器啟動成功');
      } else {
        console.log('  ❌ 伺服器啟動失敗或未在5秒內完成');
      }
      
      resolve(startupSuccessful);
    }, 5000);
  });
}

// 主測試函數
async function runAllTests() {
  try {
    await testEnvironmentVariables();
    const pool = await testDatabaseConnection();
    await testOrderData(pool);
    await testDriverData();
    const serverStarted = await testServerStartup();
    
    console.log('\n📊 測試總結');
    console.log('=====================================');
    console.log('  資料庫連線:', pool ? '✅ 成功' : '❌ 失敗');
    console.log('  伺服器啟動:', serverStarted ? '✅ 成功' : '❌ 失敗');
    
    if (pool && serverStarted) {
      console.log('\n🎉 系統基本功能正常，可以進行詳細測試');
      console.log('  - 前台: http://localhost:3002');
      console.log('  - 後台: http://localhost:3002/admin');
      console.log('  - 外送員: http://localhost:3002/driver');
    } else {
      console.log('\n⚠️ 系統有問題需要修復');
    }
    
  } catch (error) {
    console.error('測試過程發生錯誤:', error);
  }
}

// 執行測試
runAllTests();