#!/usr/bin/env node

/**
 * Supabase Pooler連線測試
 * 測試正確的Pooler連線配置
 */

const { Pool } = require('pg');
const dns = require('dns');

// 強制IPv4
dns.setDefaultResultOrder('ipv4first');
process.env.FORCE_IPV4 = '1';

async function testPoolerConnection() {
  console.log('🔧 Supabase Pooler Connection Test');
  console.log('===================================');
  
  const configs = [
    {
      name: '方法1: 標準用戶名 (postgres)',
      config: {
        host: 'aws-1-ap-southeast-1.pooler.supabase.com',
        port: 6543,
        database: 'postgres',
        user: 'postgres',
        password: 'Chengyivegetable2025!',
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 30000,
        family: 4
      }
    },
    {
      name: '方法2: 帶項目ID的用戶名',
      config: {
        host: 'aws-1-ap-southeast-1.pooler.supabase.com', 
        port: 6543,
        database: 'postgres',
        user: 'postgres.cywcuzgbuqmxjxwyrrsp',
        password: 'Chengyivegetable2025!',
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 30000,
        family: 4
      }
    },
    {
      name: '方法3: 直接IPv4地址連線',
      config: {
        host: '13.213.241.248',
        port: 6543,
        database: 'postgres',
        user: 'postgres',
        password: 'Chengyivegetable2025!',
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 30000,
        family: 4
      }
    },
    {
      name: '方法4: 原始端點IPv6繞過測試',
      config: {
        connectionString: 'postgresql://postgres:Chengyivegetable2025!@db.cywcuzgbuqmxjxwyrrsp.supabase.co:5432/postgres?sslmode=require',
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 30000,
        family: 6  // 嘗試使用IPv6
      }
    }
  ];
  
  console.log('開始測試各種連線配置...\n');
  
  for (const { name, config } of configs) {
    console.log(`🔌 ${name}`);
    console.log('-----------------------------------');
    
    try {
      const pool = new Pool(config);
      const start = Date.now();
      
      const result = await pool.query('SELECT NOW() as current_time, version() as db_version');
      const duration = Date.now() - start;
      
      console.log(`✅ 連線成功! (${duration}ms)`);
      console.log('   連線時間:', result.rows[0].current_time);
      console.log('   資料庫版本:', result.rows[0].db_version.substring(0, 50) + '...');
      
      // 測試基本查詢
      try {
        const tablesResult = await pool.query(`
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_schema = 'public' 
          LIMIT 5
        `);
        console.log('   可用表格:', tablesResult.rows.map(r => r.table_name).join(', '));
      } catch (queryError) {
        console.log('   ⚠️ 表格查詢失敗:', queryError.message);
      }
      
      await pool.end();
      
      console.log('\n🎉 找到可用的連線配置!');
      console.log('建議的連線配置:');
      console.log(JSON.stringify(config, null, 2));
      
      return config;
      
    } catch (error) {
      console.log(`❌ 連線失敗`);
      console.log('   錯誤代碼:', error.code || 'N/A');
      console.log('   錯誤訊息:', error.message);
      
      // 分析常見錯誤
      if (error.code === '28P01') {
        console.log('   💡 建議: 密碼認證失敗，請檢查密碼或用戶名');
      } else if (error.code === 'ENOTFOUND') {
        console.log('   💡 建議: DNS解析失敗，嘗試使用IP地址');
      } else if (error.code === 'ECONNREFUSED') {
        console.log('   💡 建議: 連線被拒絕，檢查防火牆或端口');
      }
    }
    
    console.log('');
  }
  
  console.log('🚨 所有連線方法都失敗了');
  return null;
}

// 如果直接運行此腳本
if (require.main === module) {
  testPoolerConnection().then(result => {
    process.exit(result ? 0 : 1);
  }).catch(error => {
    console.error('測試失敗:', error);
    process.exit(1);
  });
}

module.exports = testPoolerConnection;