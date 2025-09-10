/**
 * 全面檢查所有可能的部署 URL
 */

const https = require('https');

async function checkUrl(url, timeout = 10000) {
  return new Promise((resolve) => {
    const req = https.get(url, { timeout }, (res) => {
      let data = '';
      
      res.on('data', chunk => {
        data += chunk;
        if (data.length > 500) {
          res.destroy();
        }
      });
      
      res.on('end', () => {
        resolve({
          url,
          status: res.statusCode,
          contentPreview: data.substring(0, 200),
          success: res.statusCode >= 200 && res.statusCode < 400
        });
      });
      
      res.on('error', (error) => {
        resolve({ url, error: error.message, success: false });
      });
    });
    
    req.on('timeout', () => {
      req.destroy();
      resolve({ url, error: '連線超時', success: false });
    });
    
    req.on('error', (error) => {
      resolve({ url, error: error.message, success: false });
    });
  });
}

async function checkAllUrls() {
  console.log('🌐 全面檢查所有可能的部署 URL...\n');
  
  // 基於您的 GitHub 倉庫名稱的各種可能組合
  const baseDomains = [
    'chengyivegetable-delivery',
    'chengyivegetable',
    'vegetable-delivery',
    'web-production',
    'server-production',
    'nodejs-production'
  ];
  
  const suffixes = [
    '.up.railway.app',
    '-production.up.railway.app',
    '.railway.app',
    '-prod.up.railway.app',
    '-main.up.railway.app'
  ];
  
  const urls = [];
  
  // 生成所有可能的 URL 組合
  baseDomains.forEach(base => {
    suffixes.forEach(suffix => {
      urls.push(`https://${base}${suffix}`);
      urls.push(`https://${base}${suffix}/api/version`);
    });
  });
  
  // 加入一些手動的可能 URL
  urls.push(
    'https://chengyivegetable-delivery-production-8ec9.up.railway.app',
    'https://chengyivegetable-delivery-main.up.railway.app',
    'https://chengyivegetable-delivery-b4a6250.up.railway.app', // 最新 commit hash
    'https://railway-chengyivegetable.up.railway.app',
    'https://fresh-vegetable-delivery.up.railway.app'
  );
  
  console.log(`🔍 準備測試 ${urls.length} 個可能的 URL...\n`);
  
  const workingUrls = [];
  const results = [];
  
  // 批次測試（每次 5 個避免過載）
  for (let i = 0; i < urls.length; i += 5) {
    const batch = urls.slice(i, i + 5);
    
    console.log(`測試批次 ${Math.floor(i/5) + 1}/${Math.ceil(urls.length/5)}:`);
    
    const batchPromises = batch.map(url => {
      process.stdout.write(`   ${url.replace('https://', '')}... `);
      return checkUrl(url);
    });
    
    const batchResults = await Promise.all(batchPromises);
    
    batchResults.forEach((result, idx) => {
      if (result.success) {
        console.log(`✅ 成功 (${result.status})`);
        workingUrls.push(result);
      } else {
        console.log(`❌ ${result.error || `狀態 ${result.status}`}`);
      }
    });
    
    results.push(...batchResults);
    console.log('');
    
    // 如果找到工作的 URL，可以提早結束
    if (workingUrls.length > 0) {
      console.log('🎉 已找到可用 URL，停止進一步測試\n');
      break;
    }
  }
  
  console.log('📊 檢查結果：');
  console.log('=================================');
  
  if (workingUrls.length > 0) {
    console.log(`✅ 找到 ${workingUrls.length} 個可用的 URL：\n`);
    
    workingUrls.forEach((result, index) => {
      console.log(`${index + 1}. ${result.url}`);
      console.log(`   狀態: ${result.status}`);
      if (result.contentPreview && result.contentPreview.trim()) {
        console.log(`   內容預覽: ${result.contentPreview.trim()}`);
      }
      console.log('');
    });
    
    console.log('🎯 建議使用第一個 URL 進行測試');
    
  } else {
    console.log('❌ 沒有找到任何可用的 URL');
    console.log('\n🔧 可能的問題：');
    console.log('1. Railway 部署仍在進行中');
    console.log('2. 應用程式啟動失敗');
    console.log('3. Railway 專案可能使用了不同的命名');
    console.log('4. 需要檢查 Railway 控制台的實際 URL');
    
    console.log('\n💡 建議：');
    console.log('1. 登入 Railway 控制台查看實際的部署 URL');
    console.log('2. 檢查 Railway 專案的 Logs 頁面');
    console.log('3. 確認專案是否正確部署');
  }
}

// 執行檢查
checkAllUrls().catch(error => {
  console.error('檢查過程發生錯誤:', error);
});