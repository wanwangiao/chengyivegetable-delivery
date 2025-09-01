#!/usr/bin/env node

/**
 * IPv4強制連線修復工具
 * 解決家庭網路不支援IPv6導致Supabase連線失敗的問題
 */

const { Pool } = require('pg');
const dns = require('dns');
const { promisify } = require('util');

// 強制DNS使用IPv4優先
dns.setDefaultResultOrder('ipv4first');
process.env.FORCE_IPV4 = '1';
process.env.NODE_OPTIONS = '--dns-result-order=ipv4first';

console.log('🔧 IPv4 Connection Fix Tool');
console.log('============================');
console.log('解決IPv6網路不支援導致的Supabase連線問題');

const resolve4 = promisify(dns.resolve4);
const resolve6 = promisify(dns.resolve6);

async function testDNSResolution(hostname) {
  console.log(`\n📡 測試DNS解析: ${hostname}`);
  console.log('--------------------------------');
  
  try {
    // 測試IPv4解析
    try {
      const ipv4Addresses = await resolve4(hostname);
      console.log('✅ IPv4地址:', ipv4Addresses);
      return { ipv4: ipv4Addresses, ipv6: [] };
    } catch (ipv4Error) {
      console.log('❌ IPv4解析失敗:', ipv4Error.code);
    }
    
    // 測試IPv6解析
    try {
      const ipv6Addresses = await resolve6(hostname);
      console.log('🔍 IPv6地址:', ipv6Addresses);
      return { ipv4: [], ipv6: ipv6Addresses };
    } catch (ipv6Error) {
      console.log('❌ IPv6解析失敗:', ipv6Error.code);
    }
    
    return { ipv4: [], ipv6: [] };
  } catch (error) {
    console.log('❌ DNS解析完全失敗:', error.message);
    return null;
  }
}

async function testConnection(method, config) {
  console.log(`\n🔌 測試連線: ${method}`);
  console.log('---------------------------');
  
  const connectionDetails = {
    host: config.host || 'from connectionString',
    port: config.port || 'from connectionString',
    database: config.database || 'from connectionString',
    ssl: config.ssl ? '啟用' : '停用'
  };
  
  console.log('連線詳情:', connectionDetails);
  
  try {
    const pool = new Pool(config);
    const start = Date.now();
    
    // 設置超時
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('連線超時 (30秒)')), 30000)
    );
    
    const queryPromise = pool.query('SELECT NOW() as current_time, version() as db_version');
    
    const result = await Promise.race([queryPromise, timeoutPromise]);
    const duration = Date.now() - start;
    
    console.log(`✅ ${method} 成功! (${duration}ms)`);
    console.log('   連線時間:', result.rows[0].current_time);
    console.log('   資料庫版本:', result.rows[0].db_version.substring(0, 80));
    
    await pool.end();
    return { success: true, duration, config };
  } catch (error) {
    console.log(`❌ ${method} 失敗`);
    console.log('   錯誤代碼:', error.code || 'N/A');
    console.log('   錯誤訊息:', error.message);
    console.log('   嘗試地址:', error.address || 'N/A');
    return { success: false, error, config };
  }
}

async function generateOptimalConfig(testResults) {
  console.log('\n🎯 生成最佳配置');
  console.log('=================');
  
  const successful = testResults.filter(r => r.success);
  
  if (successful.length === 0) {
    console.log('❌ 沒有成功的連線配置');
    return null;
  }
  
  // 選擇最快的連線
  const fastest = successful.reduce((prev, current) => 
    prev.duration < current.duration ? prev : current
  );
  
  console.log('✅ 推薦配置:');
  console.log('   方法:', fastest.method);
  console.log('   連線時間:', fastest.duration + 'ms');
  
  return fastest.config;
}

async function runDiagnostics() {
  console.log('環境資訊:');
  console.log('  平台:', process.platform);
  console.log('  Node版本:', process.version);
  console.log('  IPv4優先:', process.env.NODE_OPTIONS);
  
  // 測試端點
  const endpoints = [
    'db.cywcuzgbuqmxjxwyrrsp.supabase.co',
    'aws-1-ap-southeast-1.pooler.supabase.com'
  ];
  
  const dnsResults = {};
  
  // DNS解析測試
  for (const endpoint of endpoints) {
    dnsResults[endpoint] = await testDNSResolution(endpoint);
  }
  
  // 準備連線測試配置
  const tests = [];
  
  // 1. 環境變數連線 (with IPv4 family)
  if (process.env.DATABASE_URL) {
    tests.push({
      method: '環境變數 DATABASE_URL (IPv4強制)',
      config: {
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 30000,
        idleTimeoutMillis: 30000,
        family: 4  // 強制IPv4
      }
    });
  }
  
  // 2. 直接主機連線 (原始端點)
  tests.push({
    method: '直接主機連線 (原始端點)',
    config: {
      host: 'db.cywcuzgbuqmxjxwyrrsp.supabase.co',
      port: 5432,
      database: 'postgres',
      user: 'postgres',
      password: 'Chengyivegetable2025!',
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 30000,
      family: 4
    }
  });
  
  // 3. Pooler連線 (推薦)
  tests.push({
    method: 'Supabase Pooler (推薦)',
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
  });
  
  // 4. IPv4地址直連 (如果DNS解析成功)
  const poolerDNS = dnsResults['aws-1-ap-southeast-1.pooler.supabase.com'];
  if (poolerDNS && poolerDNS.ipv4.length > 0) {
    tests.push({
      method: '直接IP連線 (IPv4)',
      config: {
        host: poolerDNS.ipv4[0],
        port: 6543,
        database: 'postgres',
        user: 'postgres.cywcuzgbuqmxjxwyrrsp',
        password: 'Chengyivegetable2025!',
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 30000,
        family: 4
      }
    });
  }
  
  console.log('\n🧪 開始連線測試');
  console.log('==================');
  
  const testResults = [];
  for (const test of tests) {
    const result = await testConnection(test.method, test.config);
    result.method = test.method;
    testResults.push(result);
    
    // 小延遲避免過快連線
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // 分析結果
  console.log('\n📊 測試結果摘要');
  console.log('==================');
  
  const successful = testResults.filter(r => r.success);
  const failed = testResults.filter(r => !r.success);
  
  console.log(`✅ 成功連線: ${successful.length}/${testResults.length}`);
  console.log(`❌ 失敗連線: ${failed.length}/${testResults.length}`);
  
  if (successful.length > 0) {
    console.log('\n🎉 可用的連線方法:');
    successful.forEach((result, index) => {
      console.log(`  ${index + 1}. ${result.method} (${result.duration}ms)`);
    });
    
    const optimalConfig = await generateOptimalConfig(testResults);
    if (optimalConfig) {
      console.log('\n📋 建議的生產環境配置:');
      console.log(JSON.stringify(optimalConfig, null, 2));
    }
  } else {
    console.log('\n🚨 所有連線方法都失敗了!');
    console.log('可能的問題:');
    console.log('  1. 網路防火牆阻止PostgreSQL連線 (port 5432/6543)');
    console.log('  2. DNS解析問題 (嘗試使用VPN或更改DNS)');
    console.log('  3. Supabase服務暫時不可用');
    console.log('  4. 認證資訊不正確');
  }
  
  return {
    successful: successful.length,
    total: testResults.length,
    results: testResults,
    dnsResults
  };
}

// 錯誤處理
process.on('uncaughtException', (error) => {
  console.error('💥 未捕獲異常:', error.message);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 未處理的Promise拒絕:', reason);
  process.exit(1);
});

// 執行診斷
if (require.main === module) {
  runDiagnostics().then((results) => {
    console.log('\n🏁 診斷完成');
    process.exit(results.successful > 0 ? 0 : 1);
  }).catch(error => {
    console.error('💥 診斷工具失敗:', error.message);
    process.exit(1);
  });
}

module.exports = { runDiagnostics, testConnection, testDNSResolution };