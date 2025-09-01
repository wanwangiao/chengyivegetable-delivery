#!/usr/bin/env node

/**
 * IPv4修復驗證測試
 * 驗證server.js的IPv4強制修復是否生效
 */

const { Pool } = require('pg');
const dns = require('dns');

// 設置IPv4優先 (模擬server.js的行為)
dns.setDefaultResultOrder('ipv4first');
process.env.FORCE_IPV4 = '1';

async function testServerConnection() {
  console.log('🧪 IPv4修復驗證測試');
  console.log('===================');
  
  // 載入環境變數
  require('dotenv').config();
  
  console.log('環境資訊:');
  console.log('  DATABASE_URL:', process.env.DATABASE_URL ? '已設定' : '未設定');
  console.log('  DNS優先順序:', dns.getDefaultResultOrder());
  
  if (!process.env.DATABASE_URL) {
    console.log('❌ DATABASE_URL 環境變數未設定');
    return false;
  }
  
  // 測試修復後的連線配置
  const config = {
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 30000,
    idleTimeoutMillis: 30000,
    max: 5,
    family: 4  // 關鍵修復：強制IPv4
  };
  
  console.log('\n🔌 測試IPv4強制連線');
  console.log('----------------------');
  console.log('連線配置:');
  console.log('  SSL:', config.ssl ? '啟用' : '停用');
  console.log('  協議族:', config.family === 4 ? 'IPv4' : config.family === 6 ? 'IPv6' : 'Auto');
  console.log('  超時:', config.connectionTimeoutMillis + 'ms');
  console.log('  連線字串:', config.connectionString.replace(/:[^:@]+@/, ':***@'));
  
  try {
    const pool = new Pool(config);
    const start = Date.now();
    
    // 基本連線測試
    const result = await pool.query('SELECT NOW() as current_time, inet_server_addr() as server_ip, version() as db_version');
    const duration = Date.now() - start;
    
    console.log(`\n✅ 連線成功! (${duration}ms)`);
    console.log('  伺服器時間:', result.rows[0].current_time);
    console.log('  伺服器IP:', result.rows[0].server_ip || 'N/A');
    console.log('  資料庫版本:', result.rows[0].db_version.substring(0, 50) + '...');
    
    // 測試基本資料表查詢
    try {
      const tablesResult = await pool.query(`
        SELECT COUNT(*) as table_count 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
      `);
      
      console.log('  公開表格數量:', tablesResult.rows[0].table_count);
      
      // 檢查重要表格
      const importantTables = ['products', 'orders', 'order_items'];
      for (const tableName of importantTables) {
        try {
          const existsResult = await pool.query(`
            SELECT EXISTS (
              SELECT 1 FROM information_schema.tables 
              WHERE table_schema = 'public' AND table_name = $1
            )
          `, [tableName]);
          
          const exists = existsResult.rows[0].exists;
          console.log(`  表格 ${tableName}:`, exists ? '✅存在' : '❌不存在');
          
          if (exists) {
            const countResult = await pool.query(`SELECT COUNT(*) as count FROM ${tableName}`);
            console.log(`    記錄數: ${countResult.rows[0].count}`);
          }
        } catch (tableError) {
          console.log(`  表格 ${tableName}: ❌查詢失敗 (${tableError.message})`);
        }
      }
      
    } catch (queryError) {
      console.log('  ⚠️ 表格查詢失敗:', queryError.message);
    }
    
    await pool.end();
    
    console.log('\n🎉 IPv4修復驗證成功!');
    console.log('建議:');
    console.log('  1. 啟動應用程式: npm start');
    console.log('  2. 檢查資料庫連線日誌');
    console.log('  3. 測試應用程式基本功能');
    
    return true;
    
  } catch (error) {
    console.log('\n❌ 連線失敗');
    console.log('錯誤代碼:', error.code || 'N/A');
    console.log('錯誤訊息:', error.message);
    console.log('詳細資訊:', error.detail || 'N/A');
    
    // 錯誤分析和建議
    console.log('\n🔍 錯誤分析:');
    if (error.code === 'ENOTFOUND') {
      console.log('  問題: DNS解析失敗');
      console.log('  原因: 網路不支援目標主機的IP版本');
      console.log('  解決方案:');
      console.log('    1. 確認網路連線狀態');
      console.log('    2. 嘗試更改DNS設定 (8.8.8.8, 1.1.1.1)');
      console.log('    3. 考慮使用VPN');
    } else if (error.code === '28P01') {
      console.log('  問題: 認證失敗');
      console.log('  原因: 用戶名或密碼不正確');
      console.log('  解決方案:');
      console.log('    1. 檢查DATABASE_URL中的認證資訊');
      console.log('    2. 確認Supabase項目狀態');
    } else if (error.message.includes('timeout')) {
      console.log('  問題: 連線超時');
      console.log('  原因: 網路延遲或防火牆阻擋');
      console.log('  解決方案:');
      console.log('    1. 檢查網路防火牆設定');
      console.log('    2. 增加連線超時時間');
      console.log('    3. 嘗試使用不同的網路');
    } else {
      console.log('  問題: 未知錯誤');
      console.log('  建議: 聯絡技術支援或查看詳細日誌');
    }
    
    return false;
  }
}

// 如果直接運行此腳本
if (require.main === module) {
  testServerConnection().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error('測試執行失敗:', error);
    process.exit(1);
  });
}

module.exports = testServerConnection;