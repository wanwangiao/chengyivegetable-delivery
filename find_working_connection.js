#!/usr/bin/env node

/**
 * 尋找可用連線配置工具
 * 嘗試各種用戶名和連線方式組合
 */

const { Pool } = require('pg');
const dns = require('dns');

// 強制IPv4
dns.setDefaultResultOrder('ipv4first');

async function testPassword(host, port, database, user, password, description) {
  console.log(`\n🔍 測試: ${description}`);
  console.log('--------------------------------------');
  console.log(`主機: ${host}:${port}`);
  console.log(`用戶: ${user}`);
  console.log(`資料庫: ${database}`);
  
  try {
    const pool = new Pool({
      host: host,
      port: port,
      database: database,
      user: user,
      password: password,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 20000,
      family: 4
    });
    
    const start = Date.now();
    const result = await pool.query('SELECT NOW() as time, current_database() as db, current_user as user');
    const duration = Date.now() - start;
    
    console.log(`✅ 成功! (${duration}ms)`);
    console.log(`   連線用戶: ${result.rows[0].user}`);
    console.log(`   資料庫: ${result.rows[0].db}`);
    console.log(`   時間: ${result.rows[0].time}`);
    
    // 測試表格存在性
    try {
      const tables = await pool.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
        ORDER BY table_name
      `);
      console.log(`   找到 ${tables.rows.length} 個表格`);
      if (tables.rows.length > 0) {
        console.log(`   表格: ${tables.rows.map(r => r.table_name).slice(0, 5).join(', ')}${tables.rows.length > 5 ? '...' : ''}`);
      }
    } catch (e) {
      console.log(`   ⚠️ 表格查詢失敗: ${e.message}`);
    }
    
    await pool.end();
    
    // 生成連線字串
    const connectionString = `postgresql://${user}:${password}@${host}:${port}/${database}`;
    console.log(`\n✅ 找到可用連線!`);
    console.log(`連線字串: ${connectionString.replace(`:${password}@`, ':***@')}`);
    
    return {
      success: true,
      host, port, database, user, password,
      connectionString,
      duration
    };
    
  } catch (error) {
    console.log(`❌ 失敗: ${error.code} - ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function findWorkingConnection() {
  console.log('🔍 尋找可用連線配置');
  console.log('======================');
  
  // 不同的連線配置組合
  const testCombinations = [
    // Pooler 連線測試
    {
      host: 'aws-1-ap-southeast-1.pooler.supabase.com',
      port: 6543,
      database: 'postgres',
      users: [
        'postgres',
        'postgres.cywcuzgbuqmxjxwyrrsp'
      ],
      passwords: [
        'Chengyivegetable2025!',
        '@chengyivegetable',
        'chengyivegetable',
        'Chengyivegetable2025'
      ]
    },
    // 直接端點測試 (如果IPv6可用)
    {
      host: 'db.cywcuzgbuqmxjxwyrrsp.supabase.co',
      port: 5432,
      database: 'postgres',
      users: [
        'postgres'
      ],
      passwords: [
        'Chengyivegetable2025!',
        'Chengyivegetable2025',
        '@chengyivegetable'
      ]
    }
  ];
  
  const workingConfigs = [];
  
  for (const combo of testCombinations) {
    console.log(`\n🎯 測試主機: ${combo.host}:${combo.port}`);
    console.log('═'.repeat(50));
    
    for (const user of combo.users) {
      for (const password of combo.passwords) {
        const description = `${user} @ ${combo.host}`;
        const result = await testPassword(
          combo.host, 
          combo.port, 
          combo.database, 
          user, 
          password, 
          description
        );
        
        if (result.success) {
          workingConfigs.push(result);
        }
        
        // 小延遲避免過快請求
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
  }
  
  console.log('\n📊 測試結果');
  console.log('==============');
  
  if (workingConfigs.length > 0) {
    console.log(`🎉 找到 ${workingConfigs.length} 個可用配置:`);
    
    workingConfigs.forEach((config, index) => {
      console.log(`\n${index + 1}. ${config.user}@${config.host}:${config.port} (${config.duration}ms)`);
      console.log(`   連線字串: ${config.connectionString.replace(`:${config.password}@`, ':***@')}`);
    });
    
    // 選擇最快的配置
    const fastest = workingConfigs.reduce((prev, current) => 
      prev.duration < current.duration ? prev : current
    );
    
    console.log(`\n🚀 推薦配置 (最快: ${fastest.duration}ms):`);
    console.log(`DATABASE_URL=${fastest.connectionString}`);
    
    return fastest;
    
  } else {
    console.log('❌ 沒有找到任何可用的連線配置');
    
    console.log('\n🔧 故障排除建議:');
    console.log('1. 檢查Supabase項目狀態');
    console.log('2. 確認密碼是否正確');
    console.log('3. 檢查網路防火牆設定');
    console.log('4. 嘗試更換DNS服務器 (8.8.8.8, 1.1.1.1)');
    console.log('5. 考慮使用VPN');
    
    return null;
  }
}

// 如果直接運行此腳本
if (require.main === module) {
  findWorkingConnection().then(result => {
    process.exit(result ? 0 : 1);
  }).catch(error => {
    console.error('搜尋失敗:', error);
    process.exit(1);
  });
}

module.exports = findWorkingConnection;