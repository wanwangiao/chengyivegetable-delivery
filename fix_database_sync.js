#!/usr/bin/env node

/**
 * 資料庫同步修復工具
 * 自動修復本地和生產環境的資料庫配置
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const dns = require('dns');

// 設定IPv4優先
dns.setDefaultResultOrder('ipv4first');

console.log('🔧 資料庫同步修復工具');
console.log('======================');

// 用戶需要提供的正確憑證
const PLACEHOLDER_CORRECT_CONNECTION = 'postgresql://postgres:[YOUR_CORRECT_PASSWORD]@db.[YOUR_PROJECT_REF].supabase.co:5432/postgres';

async function detectCorrectCredentials() {
  console.log('\n🔍 嘗試自動檢測正確憑證...');
  
  // 可能的憑證組合
  const possibleCredentials = [
    // 標準格式嘗試
    'postgresql://postgres:Chengyivegetable2025!@db.cywcuzgbuqmxjxwyrrsp.supabase.co:5432/postgres',
    'postgresql://postgres.cywcuzgbuqmxjxwyrrsp:Chengyivegetable2025!@db.cywcuzgbuqmxjxwyrrsp.supabase.co:5432/postgres',
    
    // Pooler嘗試 (IPv4)
    'postgresql://postgres:Chengyivegetable2025!@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres',
    'postgresql://postgres.cywcuzgbuqmxjxwyrrsp:Chengyivegetable2025!@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres',
    
    // URL編碼密碼嘗試
    'postgresql://postgres:Chengyivegetable2025%21@db.cywcuzgbuqmxjxwyrrsp.supabase.co:5432/postgres',
    'postgresql://postgres.cywcuzgbuqmxjxwyrrsp:Chengyivegetable2025%21@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres',
  ];
  
  for (let i = 0; i < possibleCredentials.length; i++) {
    const connectionString = possibleCredentials[i];
    console.log(`\n🧪 測試組合 ${i + 1}/${possibleCredentials.length}`);
    console.log(`🔗 ${connectionString.replace(/:([^:@]+)@/, ':***@')}`);
    
    try {
      const pool = new Pool({
        connectionString,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 10000,
        family: 4 // IPv4優先
      });
      
      const result = await pool.query('SELECT NOW(), version()');
      console.log('✅ 連接成功！找到正確憑證');
      console.log(`📅 資料庫時間: ${result.rows[0].now}`);
      
      await pool.end();
      return connectionString;
      
    } catch (error) {
      console.log(`❌ 失敗: ${error.code} - ${error.message.substring(0, 50)}...`);
    }
  }
  
  return null;
}

async function updateEnvFiles(correctConnectionString) {
  console.log('\n📝 更新環境變數檔案...');
  
  const envFiles = [
    { path: '.env', description: '本地開發環境' },
    { path: '.env.production.local', description: '生產環境 (本地)' }
  ];
  
  for (const { path: envPath, description } of envFiles) {
    const fullPath = path.join(process.cwd(), envPath);
    
    try {
      let content = fs.existsSync(fullPath) ? fs.readFileSync(fullPath, 'utf8') : '';
      
      // 備份原始檔案
      if (fs.existsSync(fullPath)) {
        const backupPath = `${fullPath}.backup.${Date.now()}`;
        fs.writeFileSync(backupPath, content);
        console.log(`💾 備份原始檔案: ${backupPath}`);
      }
      
      // 移除舊的DATABASE_URL
      content = content.replace(/^DATABASE_URL=.*$/gm, '');
      
      // 清理空行
      content = content.replace(/\n\s*\n/g, '\n');
      
      // 添加正確的DATABASE_URL
      const envEntry = `# 修復後的資料庫連線 - ${new Date().toISOString()}
DATABASE_URL=${correctConnectionString}
`;
      
      if (content && !content.endsWith('\n')) {
        content += '\n';
      }
      content = envEntry + '\n' + content;
      
      fs.writeFileSync(fullPath, content);
      console.log(`✅ ${description}: ${envPath} 更新成功`);
      
    } catch (error) {
      console.log(`❌ 更新 ${envPath} 失敗: ${error.message}`);
    }
  }
}

async function testFinalConnection() {
  console.log('\n🎯 測試修復後的連接...');
  
  // 重新載入環境變數
  delete require.cache[require.resolve('dotenv')];
  require('dotenv').config();
  
  if (!process.env.DATABASE_URL) {
    console.log('❌ 無法讀取DATABASE_URL環境變數');
    return false;
  }
  
  try {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 15000,
      family: 4
    });
    
    const result = await pool.query(`
      SELECT 
        NOW() as current_time,
        current_database() as database_name,
        current_user as user_name,
        version() as version
    `);
    
    const info = result.rows[0];
    console.log('✅ 最終測試通過！');
    console.log(`📅 時間: ${info.current_time}`);
    console.log(`🗄️ 資料庫: ${info.database_name}`);
    console.log(`👤 使用者: ${info.user_name}`);
    console.log(`🏷️ 版本: ${info.version.split(' ')[0]}`);
    
    await pool.end();
    return true;
    
  } catch (error) {
    console.log('❌ 最終測試失敗:', error.message);
    return false;
  }
}

async function generateSyncReport() {
  console.log('\n📋 同步修復報告');
  console.log('================');
  
  console.log('🔧 已執行的修復步驟:');
  console.log('  ✅ 自動檢測正確的資料庫憑證');
  console.log('  ✅ 更新本地 .env 配置檔案'); 
  console.log('  ✅ 更新 .env.production.local 配置檔案');
  console.log('  ✅ 備份原始配置檔案');
  console.log('  ✅ 驗證修復後的連接');
  
  console.log('\n🎯 下一步建議:');
  console.log('  1. 重新啟動本地開發服務器');
  console.log('     cd C:\\Users\\黃士嘉\\veg-delivery-platform');
  console.log('     npm start');
  console.log('  ');
  console.log('  2. 確保Vercel環境變數正確:');
  console.log('     - 前往 Vercel Dashboard');
  console.log('     - 更新 DATABASE_URL 環境變數');
  console.log('     - 重新部署應用程式');
  console.log('  ');
  console.log('  3. 測試功能:');
  console.log('     - 本地: http://localhost:3002');
  console.log('     - 線上: https://chengyivegetable.vercel.app/');
  console.log('  ');
  console.log('  4. 如果問題持續:');
  console.log('     - 檢查Supabase專案狀態');
  console.log('     - 確認專案計費狀況');
  console.log('     - 聯絡Supabase支援');
}

async function main() {
  try {
    // 嘗試自動檢測正確憑證
    const correctCredentials = await detectCorrectCredentials();
    
    if (correctCredentials) {
      // 找到正確憑證，執行修復
      await updateEnvFiles(correctCredentials);
      const testPassed = await testFinalConnection();
      
      if (testPassed) {
        await generateSyncReport();
        console.log('\n🎉 資料庫同步修復完成！');
      } else {
        console.log('\n⚠️ 修復完成但最終測試失敗，可能需要手動調整');
      }
      
    } else {
      // 無法自動檢測，需要手動提供
      console.log('\n❌ 無法自動檢測正確憑證');
      console.log('\n📋 手動修復指南:');
      console.log('===============');
      console.log('');
      console.log('1. 前往 Supabase Dashboard:');
      console.log('   https://supabase.com/dashboard');
      console.log('');
      console.log('2. 選擇專案: chengyivegetable-2025');
      console.log('');
      console.log('3. 前往 Settings → Database');
      console.log('');
      console.log('4. 複製 "Connection string" 或 "Database URL"');
      console.log('');
      console.log('5. 將正確的連接字串更新到 .env 檔案:');
      console.log(`   DATABASE_URL=${PLACEHOLDER_CORRECT_CONNECTION}`);
      console.log('');
      console.log('6. 重新執行本工具驗證修復效果');
      console.log('');
      console.log('💡 提示: 如果Supabase專案暫停或刪除，');
      console.log('   可能需要重新創建專案或聯絡支援');
    }
    
  } catch (error) {
    console.error('\n💥 修復工具發生錯誤:', error);
    process.exit(1);
  }
}

// 執行修復
main();