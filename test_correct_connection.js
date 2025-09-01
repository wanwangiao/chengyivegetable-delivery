#!/usr/bin/env node

/**
 * 正確連線字串測試
 * 測試正確的Supabase Pooler連線配置
 */

const { Pool } = require('pg');
const dns = require('dns');

// 強制IPv4
dns.setDefaultResultOrder('ipv4first');
process.env.FORCE_IPV4 = '1';

async function testCorrectConnections() {
  console.log('🔧 正確連線字串測試');
  console.log('======================');
  
  const configs = [
    {
      name: 'Pooler連線 - 正確密碼',
      connectionString: 'postgresql://postgres.cywcuzgbuqmxjxwyrrsp:Chengyivegetable2025!@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres',
      family: 4
    },
    {
      name: 'Pooler連線 - URL編碼密碼',
      connectionString: 'postgresql://postgres.cywcuzgbuqmxjxwyrrsp:Chengyivegetable2025%21@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres',
      family: 4
    },
    {
      name: '原始端點 - IPv6測試',
      connectionString: 'postgresql://postgres:Chengyivegetable2025!@db.cywcuzgbuqmxjxwyrrsp.supabase.co:5432/postgres?sslmode=require',
      family: 6  // 允許IPv6
    },
    {
      name: '原始端點 - IPv4強制',
      connectionString: 'postgresql://postgres:Chengyivegetable2025!@db.cywcuzgbuqmxjxwyrrsp.supabase.co:5432/postgres?sslmode=require',
      family: 4
    }
  ];
  
  let successfulConfig = null;
  
  for (const { name, connectionString, family } of configs) {
    console.log(`\n🔌 測試: ${name}`);
    console.log('-------------------------------');
    console.log('連線字串:', connectionString.replace(/:Chengyivegetable2025[^@]*@/, ':***@'));
    console.log('協議族:', family === 4 ? 'IPv4' : family === 6 ? 'IPv6' : 'Auto');
    
    try {
      const pool = new Pool({
        connectionString: connectionString,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 30000,
        idleTimeoutMillis: 30000,
        family: family
      });
      
      const start = Date.now();
      const result = await pool.query('SELECT NOW() as current_time, version() as db_version, current_database() as db_name');
      const duration = Date.now() - start;
      
      console.log(`✅ 連線成功! (${duration}ms)`);
      console.log('   連線時間:', result.rows[0].current_time);
      console.log('   資料庫名稱:', result.rows[0].db_name);
      console.log('   PostgreSQL版本:', result.rows[0].db_version.substring(0, 50) + '...');
      
      // 測試基本功能
      try {
        const tablesResult = await pool.query(`
          SELECT table_name, table_type 
          FROM information_schema.tables 
          WHERE table_schema = 'public' 
          ORDER BY table_name
          LIMIT 10
        `);
        
        if (tablesResult.rows.length > 0) {
          console.log('   可用表格 (' + tablesResult.rows.length + '):', 
            tablesResult.rows.map(r => r.table_name).join(', '));
          
          // 測試products表是否存在
          const productsTest = await pool.query(`
            SELECT COUNT(*) as count 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'products'
          `);
          
          if (productsTest.rows[0].count > 0) {
            const productCount = await pool.query('SELECT COUNT(*) as count FROM products');
            console.log('   產品數量:', productCount.rows[0].count);
          }
        } else {
          console.log('   ⚠️ 未發現任何表格');
        }
        
      } catch (queryError) {
        console.log('   ⚠️ 查詢測試失敗:', queryError.message);
      }
      
      await pool.end();
      
      if (!successfulConfig) {
        successfulConfig = {
          name: name,
          connectionString: connectionString,
          family: family,
          duration: duration
        };
      }
      
    } catch (error) {
      console.log(`❌ 連線失敗`);
      console.log('   錯誤代碼:', error.code || 'N/A');
      console.log('   錯誤訊息:', error.message);
      
      // 分析錯誤
      if (error.code === '28P01') {
        console.log('   💡 認證失敗 - 檢查用戶名或密碼');
      } else if (error.code === 'ENOTFOUND') {
        console.log('   💡 DNS解析失敗 - 網路不支援IPv4或域名無法解析');
      } else if (error.code === 'ECONNREFUSED') {
        console.log('   💡 連線被拒絕 - 防火牆或端口問題');
      } else if (error.message.includes('Tenant or user not found')) {
        console.log('   💡 租戶或用戶未找到 - Pooler配置問題');
      }
    }
  }
  
  console.log('\n📊 測試結果摘要');
  console.log('==================');
  
  if (successfulConfig) {
    console.log('🎉 找到可用的連線配置!');
    console.log('推薦配置:', successfulConfig.name);
    console.log('響應時間:', successfulConfig.duration + 'ms');
    
    // 生成.env格式的配置
    console.log('\n📋 環境變數配置:');
    console.log('DATABASE_URL=' + successfulConfig.connectionString);
    
    return successfulConfig;
  } else {
    console.log('❌ 所有連線配置都失敗了');
    console.log('\n🔍 可能的解決方案:');
    console.log('1. 檢查網路是否支援IPv6 (原始端點需要)');
    console.log('2. 嘗試更改DNS設定 (8.8.8.8, 1.1.1.1)');
    console.log('3. 使用VPN連線');
    console.log('4. 聯絡網路服務提供商啟用IPv6');
    console.log('5. 確認Supabase項目狀態和密碼');
    
    return null;
  }
}

// 如果直接運行此腳本
if (require.main === module) {
  testCorrectConnections().then(result => {
    process.exit(result ? 0 : 1);
  }).catch(error => {
    console.error('測試失敗:', error);
    process.exit(1);
  });
}

module.exports = testCorrectConnections;