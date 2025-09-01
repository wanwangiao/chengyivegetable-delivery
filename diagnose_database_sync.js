#!/usr/bin/env node

/**
 * 資料庫同步問題診斷工具
 * 分析本地與線上環境的資料庫連線差異
 */

const { Pool } = require('pg');
const dns = require('dns');

// 設定強制IPv4
dns.setDefaultResultOrder('ipv4first');
process.env.FORCE_IPV4 = '1';
process.env.NODE_OPTIONS = '--dns-result-order=ipv4first';

console.log('🔍 資料庫同步問題診斷工具');
console.log('================================');

// 測試配置
const configurations = {
  '本地 .env 配置': {
    connectionString: 'postgresql://postgres.cywcuzgbuqmxjxwyrrsp:Chengyivegetable2025!@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres',
    description: '本地開發環境配置'
  },
  '生產 .env.production.local 配置': {
    connectionString: 'postgresql://postgres.cywcuzgbuqmxjxwyrrsp:@chengyivegetable@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres',
    description: '生產環境配置（看起來有問題）'
  },
  'Supabase 標準直連': {
    connectionString: 'postgresql://postgres:Chengyivegetable2025!@db.cywcuzgbuqmxjxwyrrsp.supabase.co:5432/postgres',
    description: 'Supabase 原始端點（IPv6可能有問題）'
  }
};

async function testConnection(name, config) {
  console.log(`\n🧪 測試: ${name}`);
  console.log(`📄 說明: ${config.description}`);
  console.log(`🔗 連線字串: ${config.connectionString.replace(/:([^:@]+)@/, ':***@')}`);
  
  try {
    const pool = new Pool({
      connectionString: config.connectionString,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 15000,
      idleTimeoutMillis: 15000,
      max: 1,
      family: 4  // 強制IPv4
    });
    
    console.log('⏳ 嘗試連接...');
    const start = Date.now();
    const result = await pool.query('SELECT NOW() as current_time, version() as db_version');
    const duration = Date.now() - start;
    
    console.log(`✅ 連接成功! (${duration}ms)`);
    console.log(`📅 資料庫時間: ${result.rows[0].current_time}`);
    console.log(`🗄️ 資料庫版本: ${result.rows[0].db_version.split(' ')[0]}`);
    
    // 測試基本查詢
    try {
      const tableResult = await pool.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        ORDER BY table_name 
        LIMIT 5
      `);
      console.log(`📊 資料表數量: ${tableResult.rows.length} (顯示前5個)`);
      if (tableResult.rows.length > 0) {
        console.log(`📋 資料表: ${tableResult.rows.map(r => r.table_name).join(', ')}`);
      }
    } catch (tableError) {
      console.log('⚠️ 無法查詢資料表（可能是權限問題）');
    }
    
    await pool.end();
    return { success: true, duration };
    
  } catch (error) {
    console.log(`❌ 連接失敗`);
    console.log(`🚨 錯誤代碼: ${error.code}`);
    console.log(`💬 錯誤訊息: ${error.message}`);
    
    // 分析錯誤類型
    if (error.code === '28P01') {
      console.log('🔐 分析: 認證失敗 - 用戶名或密碼錯誤');
    } else if (error.code === 'ENOTFOUND') {
      console.log('🌐 分析: DNS解析失敗 - 主機名稱無法解析');
    } else if (error.code === 'ETIMEDOUT') {
      console.log('⏰ 分析: 連接超時 - 網路或防火牆問題');
    } else if (error.code === 'ECONNREFUSED') {
      console.log('🚫 分析: 連接被拒絕 - 服務不可用或端口封鎖');
    }
    
    return { success: false, error: error.message, code: error.code };
  }
}

async function analyzeDNS() {
  console.log('\n🌐 DNS 解析分析');
  console.log('================');
  
  const hosts = [
    'db.cywcuzgbuqmxjxwyrrsp.supabase.co',
    'aws-1-ap-southeast-1.pooler.supabase.com'
  ];
  
  for (const host of hosts) {
    console.log(`\n🔍 分析主機: ${host}`);
    
    try {
      // IPv4 解析
      const ipv4Addresses = await new Promise((resolve, reject) => {
        dns.resolve4(host, (err, addresses) => {
          if (err) reject(err);
          else resolve(addresses);
        });
      });
      console.log(`✅ IPv4: ${ipv4Addresses.join(', ')}`);
    } catch (error) {
      console.log(`❌ IPv4: 無法解析 (${error.code})`);
    }
    
    try {
      // IPv6 解析
      const ipv6Addresses = await new Promise((resolve, reject) => {
        dns.resolve6(host, (err, addresses) => {
          if (err) reject(err);
          else resolve(addresses);
        });
      });
      console.log(`✅ IPv6: ${ipv6Addresses.join(', ')}`);
    } catch (error) {
      console.log(`❌ IPv6: 無法解析 (${error.code})`);
    }
  }
}

async function generateReport(results) {
  console.log('\n📋 診斷報告');
  console.log('============');
  
  const successful = results.filter(r => r.result.success);
  const failed = results.filter(r => !r.result.success);
  
  console.log(`✅ 成功連接: ${successful.length} / ${results.length}`);
  console.log(`❌ 連接失敗: ${failed.length} / ${results.length}`);
  
  if (successful.length > 0) {
    console.log('\n🎯 推薦配置:');
    const fastest = successful.reduce((prev, current) => 
      (prev.result.duration < current.result.duration) ? prev : current
    );
    console.log(`   配置: ${fastest.name}`);
    console.log(`   速度: ${fastest.result.duration}ms`);
  }
  
  if (failed.length > 0) {
    console.log('\n🔧 修復建議:');
    
    const authErrors = failed.filter(r => r.result.code === '28P01');
    if (authErrors.length > 0) {
      console.log('   1. 認證問題: 檢查Supabase憑證是否正確');
      console.log('      - 確認用戶名格式: postgres.{project_ref}');
      console.log('      - 確認密碼是否包含特殊字符');
      console.log('      - 檢查Supabase專案狀態');
    }
    
    const networkErrors = failed.filter(r => ['ETIMEDOUT', 'ENOTFOUND', 'ECONNREFUSED'].includes(r.result.code));
    if (networkErrors.length > 0) {
      console.log('   2. 網路問題: IPv6/防火牆限制');
      console.log('      - 更改DNS為Google DNS (8.8.8.8)');
      console.log('      - 使用VPN繞過ISP限制');
      console.log('      - 檢查防火牆設定');
    }
  }
  
  console.log('\n💡 同步解決方案:');
  console.log('   1. 統一使用成功的連接配置');
  console.log('   2. 更新.env.production.local使用正確憑證');
  console.log('   3. 確保本地和線上環境變數一致');
  console.log('   4. 如需Supabase憑證，請提供正確的資料庫密碼');
}

async function main() {
  console.log('🏠 環境資訊:');
  console.log(`   NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   Platform: ${process.platform}`);
  console.log(`   DNS Order: ipv4first (強制)`);
  
  // DNS 分析
  await analyzeDNS();
  
  // 連接測試
  console.log('\n🧪 連接測試');
  console.log('============');
  
  const results = [];
  
  for (const [name, config] of Object.entries(configurations)) {
    const result = await testConnection(name, config);
    results.push({ name, config, result });
  }
  
  // 生成報告
  await generateReport(results);
  
  console.log('\n🔚 診斷完成');
  console.log('如需更多協助，請提供Supabase專案的正確資料庫憑證');
}

// 執行診斷
main().catch(error => {
  console.error('💥 診斷工具發生錯誤:', error);
  process.exit(1);
});