#!/usr/bin/env node

/**
 * 用戶提供憑證後的連接測試
 */

const { Pool } = require('pg');
const dns = require('dns');

dns.setDefaultResultOrder('ipv4first');

async function testUserCredentials(connectionString) {
  console.log('🔌 測試用戶提供的憑證...');
  console.log('連線字串:', connectionString.replace(/:[^:@]+@/, ':***@'));
  
  try {
    const pool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 15000,
      family: 4
    });
    
    const result = await pool.query(`
      SELECT 
        NOW() as time,
        current_database() as db,
        current_user as user,
        version() as version
    `);
    
    console.log('✅ 連接成功!');
    console.log('📊 資料庫資訊:', result.rows[0]);
    
    // 測試業務表
    try {
      const tables = await pool.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
        ORDER BY table_name
      `);
      console.log(`📋 找到 ${tables.rows.length} 個資料表`);
    } catch (e) {
      console.log('⚠️ 無法查詢資料表，但連接正常');
    }
    
    await pool.end();
    return true;
    
  } catch (error) {
    console.log('❌ 連接失敗:', error.message);
    return false;
  }
}

// 使用方式: node test_user_credentials.js "postgresql://..."
const connectionString = process.argv[2];
if (!connectionString) {
  console.log('使用方式: node test_user_credentials.js "your_connection_string"');
  process.exit(1);
}

testUserCredentials(connectionString);
