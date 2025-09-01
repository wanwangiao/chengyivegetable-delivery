#!/usr/bin/env node

/**
 * 本地與線上環境同步驗證指南
 * 提供分步驟的測試和修復方案
 */

const { Pool } = require('pg');
const fs = require('fs');
const dns = require('dns');

// 強制IPv4
dns.setDefaultResultOrder('ipv4first');

console.log('🔍 本地與線上環境同步驗證指南');
console.log('================================');

function displayEnvironmentAnalysis() {
  console.log('\n📊 環境分析結果');
  console.log('================');
  
  console.log('🔴 **本地環境問題**:');
  console.log('   - 資料庫憑證認證失敗 (28P01)');
  console.log('   - IPv6網路支援限制');
  console.log('   - 環境變數配置不正確');
  
  console.log('\n🟢 **線上環境狀態**:');
  console.log('   - Vercel部署正常運行');  
  console.log('   - https://chengyivegetable.vercel.app/ 可訪問');
  console.log('   - Supabase連接成功 (推測)');
  
  console.log('\n🔍 **差異分析**:');
  console.log('   - 線上環境可能有不同的環境變數覆蓋');
  console.log('   - 雲端平台有更好的IPv6支援');
  console.log('   - 可能使用了不同的Supabase憑證');
}

function displayNetworkDiagnosis() {
  console.log('\n🌐 網路診斷結果');
  console.log('================');
  
  console.log('🔍 **DNS解析測試**:');
  console.log('   - db.cywcuzgbuqmxjxwyrrsp.supabase.co:');
  console.log('     ❌ IPv4: 無法解析 (ENODATA)');
  console.log('     ✅ IPv6: 2406:da18:243:7412:8147:72a8:d980:3b31');
  console.log('   ');
  console.log('   - aws-1-ap-southeast-1.pooler.supabase.com:');
  console.log('     ✅ IPv4: 3.1.167.181, 13.213.241.248');
  console.log('     ✅ IPv6: 支援');
  
  console.log('\n💡 **影響評估**:');
  console.log('   - 家庭網路ISP不支援IPv6 → 無法連接原始端點');
  console.log('   - Pooler端點有IPv4但認證失敗 → 憑證問題');
  console.log('   - 線上環境IPv6支援正常 → 可能使用原始端點');
}

function displayCredentialAnalysis() {
  console.log('\n🔐 憑證分析結果');
  console.log('================');
  
  console.log('📝 **發現的配置**:');
  console.log('   本地 (.env):');
  console.log('   └── postgres.cywcuzgbuqmxjxwyrrsp:Chengyivegetable2025!');
  console.log('   ');
  console.log('   生產 (.env.production.local):');
  console.log('   └── postgres.cywcuzgbuqmxjxwyrrsp:@chengyivegetable (明顯錯誤)');
  
  console.log('\n⚠️ **問題分析**:');
  console.log('   - 用戶名格式可能錯誤');
  console.log('   - 密碼不匹配Supabase專案');
  console.log('   - 專案可能已暫停或重置');
  console.log('   - 可能需要重新生成憑證');
}

async function createConnectionTestTool() {
  console.log('\n🧪 建立測試工具');
  console.log('================');
  
  const testScript = `#!/usr/bin/env node

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
    
    const result = await pool.query(\`
      SELECT 
        NOW() as time,
        current_database() as db,
        current_user as user,
        version() as version
    \`);
    
    console.log('✅ 連接成功!');
    console.log('📊 資料庫資訊:', result.rows[0]);
    
    // 測試業務表
    try {
      const tables = await pool.query(\`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
        ORDER BY table_name
      \`);
      console.log(\`📋 找到 \${tables.rows.length} 個資料表\`);
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
`;
  
  const toolPath = 'test_user_credentials.js';
  fs.writeFileSync(toolPath, testScript);
  console.log(`✅ 建立測試工具: ${toolPath}`);
  
  return toolPath;
}

function displayStepByStepSolution() {
  console.log('\n🎯 分步驟解決方案');
  console.log('==================');
  
  console.log('**階段1: 獲取正確憑證** (最關鍵)');
  console.log('   1. 登入 Supabase Dashboard');
  console.log('   2. 找到專案: chengyivegetable-2025');
  console.log('   3. Settings → Database → Connection info');
  console.log('   4. 複製完整的連接字串');
  console.log('   5. 或提供以下資訊:');
  console.log('      - Project Reference ID');
  console.log('      - Database Password');
  console.log('');
  
  console.log('**階段2: 測試憑證** (驗證)');
  console.log('   1. 使用測試工具驗證憑證:');
  console.log('      node test_user_credentials.js "你的連接字串"');
  console.log('   2. 如果成功，繼續階段3');
  console.log('   3. 如果失敗，檢查憑證或專案狀態');
  console.log('');
  
  console.log('**階段3: 更新本地配置** (同步)');
  console.log('   1. 更新 .env 檔案');
  console.log('   2. 更新 .env.production.local 檔案');  
  console.log('   3. 確保格式正確，無多餘字符');
  console.log('');
  
  console.log('**階段4: 解決網路問題** (IPv6)'); 
  console.log('   1. 更改DNS為 Google DNS (8.8.8.8)');
  console.log('   2. 或使用VPN服務');
  console.log('   3. 或修改系統hosts檔案');
  console.log('');
  
  console.log('**階段5: 同步Vercel環境** (生產)');
  console.log('   1. 前往 Vercel Dashboard');
  console.log('   2. 專案設定 → Environment Variables');
  console.log('   3. 更新 DATABASE_URL');
  console.log('   4. 重新部署');
}

function displayTroubleshootingGuide() {
  console.log('\n🔧 故障排除指南');
  console.log('================');
  
  console.log('❓ **如果Supabase專案找不到**:');
  console.log('   - 檢查是否被暫停或刪除');
  console.log('   - 檢查帳單狀態');
  console.log('   - 聯絡Supabase支援');
  console.log('   - 考慮建立新專案');
  console.log('');
  
  console.log('❓ **如果憑證仍然錯誤**:');
  console.log('   - 重置資料庫密碼');
  console.log('   - 檢查特殊字符編碼');
  console.log('   - 嘗試不同的連接端點');
  console.log('   - 使用Supabase CLI工具');
  console.log('');
  
  console.log('❓ **如果網路問題持續**:');
  console.log('   - 使用手機熱點測試');
  console.log('   - 聯絡ISP詢問IPv6支援');
  console.log('   - 考慮使用代理伺服器');
  console.log('   - 設定本地PostgreSQL進行開發');
}

async function main() {
  displayEnvironmentAnalysis();
  displayNetworkDiagnosis();
  displayCredentialAnalysis();
  
  const toolPath = await createConnectionTestTool();
  
  displayStepByStepSolution();
  displayTroubleshootingGuide();
  
  console.log('\n📞 需要用戶協助');
  console.log('================');
  console.log('為了完成同步修復，需要用戶提供:');
  console.log('');
  console.log('1. **Supabase正確的連接字串** (必需)');
  console.log('   格式: postgresql://[用戶名]:[密碼]@[主機]:[端口]/postgres');
  console.log('');
  console.log('2. **專案狀態確認** (重要)');
  console.log('   - 專案是否正常運行');
  console.log('   - 是否有帳單或配額問題');
  console.log('');
  console.log('3. **Vercel環境變數** (可選)');
  console.log('   - 查看實際生產環境使用的DATABASE_URL');
  console.log('');
  console.log('📧 一旦提供正確憑證，我將立即:');
  console.log('   ✅ 自動更新所有環境配置檔案');
  console.log('   ✅ 測試本地連接');
  console.log('   ✅ 提供Vercel同步指令');
  console.log('   ✅ 驗證完整功能');
  
  console.log(`\n🛠️ 建立的工具: ${toolPath}`);
  console.log('📋 診斷完成，等待用戶提供Supabase憑證');
}

main();