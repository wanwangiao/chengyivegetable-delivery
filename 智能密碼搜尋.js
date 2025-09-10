/**
 * 智能密碼搜尋工具
 * 自動嘗試找到的各種密碼，找到正確的資料庫連線
 */

const { Pool } = require('pg');

console.log('🔍 智能密碼搜尋工具');
console.log('=======================================');
console.log('正在嘗試找到正確的資料庫密碼...\n');

// 從檔案中找到的所有可能密碼
const possiblePasswords = [
  'Chengyivegetable2025!',
  'Chengyi2025!Fresh', 
  'bpBeqwyPkeXWwopKSzBYtcAuhesQRqix',
  '@Chengyivegetable',
  'chengyivegetable'
];

// 可能的資料庫配置
const databaseConfigs = [
  {
    name: 'DigitalOcean PostgreSQL',
    config: {
      host: 'db-postgresql-sgp1-67006-do-user-16407903-0.c.db.ondigitalocean.com',
      port: 25060,
      database: 'defaultdb',
      user: 'doadmin',
      ssl: { rejectUnauthorized: false }
    }
  },
  {
    name: 'Supabase (db.cywcuzgbuqmxjxwyrrsp)',
    config: {
      connectionString: 'postgresql://postgres:PASSWORD_PLACEHOLDER@db.cywcuzgbuqmxjxwyrrsp.supabase.co:5432/postgres?sslmode=require'
    }
  },
  {
    name: 'Railway Internal',
    config: {
      connectionString: 'postgresql://postgres:PASSWORD_PLACEHOLDER@postgres.railway.internal:5432/railway'
    }
  }
];

async function testConnection(config, password) {
  try {
    let finalConfig;
    
    if (config.connectionString) {
      // 替換密碼占位符
      finalConfig = {
        connectionString: config.connectionString.replace('PASSWORD_PLACEHOLDER', password),
        ssl: { rejectUnauthorized: false }
      };
    } else {
      finalConfig = {
        ...config,
        password: password
      };
    }
    
    const pool = new Pool(finalConfig);
    
    // 設置短超時避免等太久
    const client = await Promise.race([
      pool.connect(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('連線超時')), 5000)
      )
    ]);
    
    // 測試查詢
    const result = await client.query('SELECT NOW() as current_time, version() as db_version');
    client.release();
    await pool.end();
    
    return {
      success: true,
      time: result.rows[0].current_time,
      version: result.rows[0].db_version.substring(0, 50) + '...'
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.code || error.message
    };
  }
}

async function findWorkingPassword() {
  console.log('🔍 測試資料庫連線...\n');
  
  const workingConfigs = [];
  
  for (const dbConfig of databaseConfigs) {
    console.log(`📊 測試 ${dbConfig.name}:`);
    
    for (const password of possiblePasswords) {
      const maskedPassword = password.substring(0, 4) + '*'.repeat(Math.max(0, password.length - 8)) + password.substring(Math.max(4, password.length - 4));
      process.stdout.write(`   🔐 ${maskedPassword}... `);
      
      const result = await testConnection(dbConfig.config, password);
      
      if (result.success) {
        console.log('✅ 成功!');
        workingConfigs.push({
          name: dbConfig.name,
          password: password,
          config: dbConfig.config,
          time: result.time,
          version: result.version
        });
        break;
      } else {
        console.log(`❌ ${result.error}`);
      }
    }
    
    console.log('');
  }
  
  return workingConfigs;
}

async function main() {
  try {
    const workingConfigs = await findWorkingPassword();
    
    console.log('🎉 搜尋完成!');
    console.log('=======================================\n');
    
    if (workingConfigs.length > 0) {
      console.log(`✅ 找到 ${workingConfigs.length} 個可用的資料庫連線:\n`);
      
      workingConfigs.forEach((config, index) => {
        console.log(`${index + 1}. ${config.name}`);
        console.log(`   🔐 密碼: ${config.password}`);
        console.log(`   ⏰ 時間: ${config.time}`);
        console.log(`   💾 版本: ${config.version}`);
        
        if (config.name.includes('DigitalOcean')) {
          console.log('   🎯 推薦用於修復工具！');
        }
        console.log('');
      });
      
      console.log('📋 下一步:');
      console.log('1. 複製上面找到的密碼');
      console.log('2. 執行: 修復結帳功能.bat');  
      console.log('3. 貼上密碼');
      console.log('4. 等待修復完成 🎉');
      
    } else {
      console.log('❌ 沒有找到可用的資料庫連線');
      console.log('\n💡 可能的解決方案:');
      console.log('1. 檢查網路連線');
      console.log('2. 確認資料庫服務正在運行');
      console.log('3. 聯繫資料庫提供商');
      console.log('4. 檢查防火牆設定');
    }
    
  } catch (error) {
    console.error('❌ 搜尋過程發生錯誤:', error.message);
  }
}

// 執行搜尋
main().then(() => {
  console.log('\n按任意鍵退出...');
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.on('data', () => {
    process.exit(0);
  });
}).catch(error => {
  console.error('程式異常:', error);
  process.exit(1);
});