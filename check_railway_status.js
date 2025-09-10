/**
 * 檢查 Railway 部署狀態
 * 這個腳本會嘗試各種可能的 Railway URL
 */

const https = require('https');
const http = require('http');

async function checkUrl(url, timeout = 5000) {
  return new Promise((resolve) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const client = isHttps ? https : http;
    
    const req = client.get(url, { timeout }, (res) => {
      let data = '';
      
      res.on('data', chunk => {
        data += chunk;
        // 只讀取前 1000 個字符來檢查內容
        if (data.length > 1000) {
          res.destroy();
        }
      });
      
      res.on('end', () => {
        resolve({
          url,
          status: res.statusCode,
          headers: res.headers,
          preview: data.substring(0, 200) + (data.length > 200 ? '...' : ''),
          success: res.statusCode >= 200 && res.statusCode < 400
        });
      });
      
      res.on('error', (error) => {
        resolve({
          url,
          error: error.message,
          success: false
        });
      });
    });
    
    req.on('timeout', () => {
      req.destroy();
      resolve({
        url,
        error: '連線超時',
        success: false
      });
    });
    
    req.on('error', (error) => {
      resolve({
        url,
        error: error.message,
        success: false
      });
    });
  });
}

async function checkRailwayDeployment() {
  console.log('🚀 檢查 Railway 部署狀態...\n');
  
  // 可能的 Railway URL
  const possibleUrls = [
    'https://chengyivegetable-delivery-production.up.railway.app',
    'https://chengyivegetable-delivery.up.railway.app', 
    'https://web-production-8ec9.up.railway.app',
    'https://web-production.up.railway.app',
    // 加入常見的端點
    'https://chengyivegetable-delivery-production.up.railway.app/api/version',
    'https://chengyivegetable-delivery.up.railway.app/api/version',
  ];
  
  const results = [];
  
  console.log('🔍 測試可能的 URL...');
  for (const url of possibleUrls) {
    console.log(`   檢查: ${url}`);
    const result = await checkUrl(url);
    results.push(result);
    
    if (result.success) {
      console.log(`   ✅ 回應 ${result.status}`);
    } else {
      console.log(`   ❌ ${result.error || `狀態 ${result.status}`}`);
    }
  }
  
  console.log('\n📊 測試結果總結:');
  console.log('====================================');
  
  const workingUrls = results.filter(r => r.success);
  const failedUrls = results.filter(r => !r.success);
  
  if (workingUrls.length > 0) {
    console.log('✅ 可用的 URL:');
    workingUrls.forEach(result => {
      console.log(`   ${result.url} (狀態: ${result.status})`);
      if (result.preview && result.preview.length > 0) {
        console.log(`   內容預覽: ${result.preview}`);
      }
      console.log('');
    });
  } else {
    console.log('❌ 沒有找到可用的 URL');
  }
  
  if (failedUrls.length > 0) {
    console.log('❌ 失敗的 URL:');
    failedUrls.forEach(result => {
      console.log(`   ${result.url}: ${result.error || `狀態 ${result.status}`}`);
    });
  }
  
  console.log('\n🔧 部署診斷:');
  if (workingUrls.length === 0) {
    console.log('可能的問題:');
    console.log('1. Railway 部署還在進行中');
    console.log('2. 應用程式啟動失敗');
    console.log('3. 資料庫連線問題導致啟動失敗');
    console.log('4. Railway 域名配置問題');
    console.log('\n建議檢查:');
    console.log('- Railway 項目的 Logs 頁面');
    console.log('- Railway 項目的 Deployments 狀態');
    console.log('- 環境變數是否正確設置');
  } else {
    console.log('✅ 部署似乎成功，建議檢查:');
    console.log('- 應用程式功能是否正常');
    console.log('- 資料庫遷移是否執行成功');
    console.log('- 日誌中的遷移訊息');
  }
  
  return workingUrls.length > 0;
}

// 執行檢查
if (require.main === module) {
  checkRailwayDeployment()
    .then(success => {
      console.log(success ? '\n🎉 找到可用的部署!' : '\n😢 部署似乎有問題');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n💥 檢查過程發生錯誤:', error);
      process.exit(1);
    });
}