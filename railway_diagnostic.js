/**
 * Railway 部署診斷工具
 * 檢查可能的部署問題
 */

console.log('🚂 Railway 部署診斷工具');
console.log('====================================');

// 檢查 1: package.json 配置
console.log('\n1. 檢查 package.json 配置...');
try {
  const packageJson = require('./package.json');
  console.log('✅ package.json 存在');
  console.log(`   - name: ${packageJson.name}`);
  console.log(`   - main: ${packageJson.main}`);
  console.log(`   - start script: ${packageJson.scripts?.start || '未設定'}`);
  
  if (!packageJson.scripts?.start) {
    console.log('❌ 缺少 start 腳本！Railway 需要這個來啟動服務');
  }
  
  if (packageJson.main !== 'src/server.js') {
    console.log(`⚠️ main 欄位是 ${packageJson.main}，應該是 src/server.js`);
  }
  
} catch (error) {
  console.log('❌ package.json 讀取失敗:', error.message);
}

// 檢查 2: Railway 配置
console.log('\n2. 檢查 Railway 配置...');
const fs = require('fs');

if (fs.existsSync('./railway.toml')) {
  console.log('✅ railway.toml 存在');
  try {
    const railwayConfig = fs.readFileSync('./railway.toml', 'utf8');
    if (railwayConfig.includes('startCommand')) {
      console.log('✅ 包含 startCommand 配置');
    } else {
      console.log('⚠️ 沒有 startCommand 配置');
    }
  } catch (error) {
    console.log('❌ railway.toml 讀取失敗:', error.message);
  }
} else {
  console.log('⚠️ railway.toml 不存在');
}

// 檢查 3: 伺服器檔案
console.log('\n3. 檢查伺服器檔案...');
if (fs.existsSync('./src/server.js')) {
  console.log('✅ src/server.js 存在');
  
  try {
    const serverContent = fs.readFileSync('./src/server.js', 'utf8');
    
    // 檢查關鍵設定
    if (serverContent.includes('app.listen')) {
      console.log('✅ 包含 app.listen');
    } else {
      console.log('❌ 缺少 app.listen');
    }
    
    if (serverContent.includes('process.env.PORT')) {
      console.log('✅ 使用 process.env.PORT');
    } else {
      console.log('❌ 沒有使用 process.env.PORT');
    }
    
    if (serverContent.includes('module.exports')) {
      console.log('✅ 有 module.exports');
    } else {
      console.log('⚠️ 沒有 module.exports');
    }
    
  } catch (error) {
    console.log('❌ server.js 讀取失敗:', error.message);
  }
} else {
  console.log('❌ src/server.js 不存在');
}

// 檢查 4: 潛在的語法錯誤
console.log('\n4. 檢查語法錯誤...');
try {
  require('./src/server.js');
  console.log('✅ server.js 語法正確');
} catch (error) {
  console.log('❌ server.js 有語法錯誤:', error.message);
  console.log('   這可能導致 Railway 部署失敗');
}

// 檢查 5: 依賴項目
console.log('\n5. 檢查關鍵依賴...');
const criticalDeps = ['express', 'pg', 'body-parser'];

try {
  const packageJson = require('./package.json');
  const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
  
  criticalDeps.forEach(dep => {
    if (deps[dep]) {
      console.log(`✅ ${dep}: ${deps[dep]}`);
    } else {
      console.log(`❌ 缺少 ${dep}`);
    }
  });
} catch (error) {
  console.log('❌ 無法檢查依賴項目');
}

console.log('\n====================================');
console.log('🔧 診斷建議:');

console.log('\n如果部署失敗，請檢查：');
console.log('1. Railway 控制台的 Logs 頁面');
console.log('2. 確認環境變數 DATABASE_URL 已設定');
console.log('3. 確認 PORT 環境變數由 Railway 自動提供');
console.log('4. 檢查上述診斷中的任何 ❌ 項目');

console.log('\n可能的解決方案：');
console.log('1. 修復任何語法錯誤');
console.log('2. 確保 package.json 有正確的 start 腳本');
console.log('3. 檢查 Railway 專案設定');
console.log('4. 嘗試重新部署');

console.log('\n🌐 測試 URL:');
console.log('- https://chengyivegetable-delivery.railway.app');
console.log('- 檢查 Railway 控制台獲取正確的專案 URL');