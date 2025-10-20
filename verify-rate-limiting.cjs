/**
 * Rate Limiting 禁用驗證測試
 * 驗證開發環境中 rate limiting 是否已成功禁用
 *
 * 執行: node verify-rate-limiting.cjs
 */

const API_BASE = 'http://localhost:3000/api/v1';

// 工具函數
async function makeRequest(path) {
  const start = Date.now();
  try {
    const response = await fetch(`${API_BASE}${path}`);
    const duration = Date.now() - start;
    return {
      status: response.status,
      duration,
      success: response.status !== 429
    };
  } catch (error) {
    return {
      status: 0,
      duration: Date.now() - start,
      success: false,
      error: error.message
    };
  }
}

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 主測試函數
async function runRateLimitTests() {
  console.log('='.repeat(70));
  console.log('Rate Limiting 禁用驗證測試');
  console.log('測試日期:', new Date().toISOString());
  console.log('='.repeat(70));
  console.log('');

  // 測試 1: 快速連續請求 (全域 rate limit 測試)
  console.log('📋 測試 1: 快速連續請求 - 驗證全域 rate limiting');
  console.log('   生產環境限制: 100 次/15分鐘');
  console.log('   開發環境限制: 應該無限制');
  console.log('   測試方法: 20 次連續請求，間隔 100ms');
  console.log('');

  const results = [];
  for (let i = 1; i <= 20; i++) {
    const result = await makeRequest('/products');
    results.push(result);

    const statusIcon = result.status === 200 ? '✅' : result.status === 429 ? '❌' : '⚠️';
    console.log(
      `   ${statusIcon} Request ${i.toString().padStart(2)}: HTTP ${result.status} ` +
      `(${result.duration}ms)`
    );

    if (i < 20) await delay(100);
  }

  const successCount = results.filter(r => r.success).length;
  const rateLimitedCount = results.filter(r => r.status === 429).length;
  const avgDuration = Math.round(
    results.reduce((sum, r) => sum + r.duration, 0) / results.length
  );

  console.log('');
  console.log('   結果統計:');
  console.log(`   - 成功請求: ${successCount}/20`);
  console.log(`   - Rate limited (429): ${rateLimitedCount}/20`);
  console.log(`   - 平均響應時間: ${avgDuration}ms`);
  console.log('');

  if (rateLimitedCount === 0 && successCount === 20) {
    console.log('   ✅ 測試 1 通過: 全域 rate limiting 已成功禁用');
  } else if (rateLimitedCount > 0) {
    console.log('   ❌ 測試 1 失敗: 仍遇到 rate limiting (HTTP 429)');
  } else {
    console.log('   ⚠️  測試 1 部分通過: 有其他錯誤發生');
  }
  console.log('');

  // 測試 2: 極短間隔請求 (訂單 rate limit 模擬)
  console.log('📋 測試 2: 極短間隔請求 - 模擬訂單建立 rate limiting');
  console.log('   生產環境限制: 3 次/分鐘');
  console.log('   開發環境限制: 應該無限制');
  console.log('   測試方法: 10 次連續請求，間隔 50ms');
  console.log('');

  const rapidResults = [];
  for (let i = 1; i <= 10; i++) {
    const result = await makeRequest('/products');
    rapidResults.push(result);

    const statusIcon = result.status === 200 ? '✅' : result.status === 429 ? '❌' : '⚠️';
    console.log(
      `   ${statusIcon} Request ${i.toString().padStart(2)}: HTTP ${result.status} ` +
      `(${result.duration}ms)`
    );

    if (i < 10) await delay(50);
  }

  const rapidSuccess = rapidResults.filter(r => r.success).length;
  const rapidLimited = rapidResults.filter(r => r.status === 429).length;

  console.log('');
  console.log('   結果統計:');
  console.log(`   - 成功請求: ${rapidSuccess}/10`);
  console.log(`   - Rate limited (429): ${rapidLimited}/10`);
  console.log('');

  if (rapidLimited === 0 && rapidSuccess === 10) {
    console.log('   ✅ 測試 2 通過: 訂單級 rate limiting 已成功禁用');
  } else if (rapidLimited > 0) {
    console.log('   ❌ 測試 2 失敗: 仍遇到 rate limiting (HTTP 429)');
  } else {
    console.log('   ⚠️  測試 2 部分通過: 有其他錯誤發生');
  }
  console.log('');

  // 測試 3: 並行請求 (壓力測試)
  console.log('📋 測試 3: 並行請求 - 壓力測試');
  console.log('   測試方法: 同時發送 15 個請求');
  console.log('');

  const parallelStart = Date.now();
  const parallelPromises = Array(15).fill(null).map((_, i) =>
    makeRequest('/products')
  );

  const parallelResults = await Promise.all(parallelPromises);
  const parallelDuration = Date.now() - parallelStart;

  const parallelSuccess = parallelResults.filter(r => r.success).length;
  const parallelLimited = parallelResults.filter(r => r.status === 429).length;

  console.log(`   完成 15 個並行請求，總耗時: ${parallelDuration}ms`);
  console.log('');
  console.log('   結果統計:');
  console.log(`   - 成功請求: ${parallelSuccess}/15`);
  console.log(`   - Rate limited (429): ${parallelLimited}/15`);
  console.log('');

  if (parallelLimited === 0 && parallelSuccess === 15) {
    console.log('   ✅ 測試 3 通過: 並行請求不受 rate limiting 限制');
  } else if (parallelLimited > 0) {
    console.log('   ❌ 測試 3 失敗: 並行請求遇到 rate limiting');
  } else {
    console.log('   ⚠️  測試 3 部分通過: 有其他錯誤發生');
  }
  console.log('');

  // 總結
  console.log('='.repeat(70));
  console.log('📊 測試結果總結');
  console.log('='.repeat(70));

  const totalRequests = results.length + rapidResults.length + parallelResults.length;
  const totalSuccess = successCount + rapidSuccess + parallelSuccess;
  const totalLimited = rateLimitedCount + rapidLimited + parallelLimited;

  console.log(`總請求數: ${totalRequests}`);
  console.log(`成功: ${totalSuccess} ✅`);
  console.log(`Rate Limited (429): ${totalLimited} ❌`);
  console.log(`成功率: ${((totalSuccess / totalRequests) * 100).toFixed(2)}%`);
  console.log('');

  // 最終判定
  const test1Pass = rateLimitedCount === 0 && successCount === 20;
  const test2Pass = rapidLimited === 0 && rapidSuccess === 10;
  const test3Pass = parallelLimited === 0 && parallelSuccess === 15;
  const allTestsPass = test1Pass && test2Pass && test3Pass;

  console.log('測試通過狀態:');
  console.log(`  ${test1Pass ? '✅' : '❌'} 測試 1: 快速連續請求`);
  console.log(`  ${test2Pass ? '✅' : '❌'} 測試 2: 極短間隔請求`);
  console.log(`  ${test3Pass ? '✅' : '❌'} 測試 3: 並行請求`);
  console.log('');

  console.log('='.repeat(70));
  if (allTestsPass) {
    console.log('✅ 驗證結果: 全部通過');
    console.log('✅ Rate limiting 已成功在開發環境中禁用');
    console.log('✅ API 請求不會被 HTTP 429 阻擋');
    console.log('✅ 系統已準備好執行完整測試套件');
    console.log('');
    console.log('🎯 建議下一步:');
    console.log('   1. 重新執行完整訂單管理測試');
    console.log('   2. 重新執行 E2E 流程測試');
    console.log('   3. 驗證所有之前因 rate limiting 失敗的測試');
  } else if (totalLimited > 0) {
    console.log('❌ 驗證結果: 失敗');
    console.log('❌ Rate limiting 仍在運作中');
    console.log('');
    console.log('🔧 故障排除建議:');
    console.log('   1. 檢查 NODE_ENV 環境變數是否設定為 "development"');
    console.log('   2. 確認 API 服務器已重新啟動');
    console.log('   3. 檢查 apps/api/src/middleware/rate-limit.ts 配置');
    console.log('   4. 檢查 apps/api/src/app.ts 中間件應用邏輯');
    console.log('   5. 查看 API 服務器啟動日誌確認環境配置');
  } else {
    console.log('⚠️  驗證結果: 部分通過');
    console.log('⚠️  沒有 rate limiting 問題，但有其他錯誤');
    console.log('');
    console.log('請檢查 API 服務器狀態和網路連線');
  }
  console.log('='.repeat(70));

  // 返回測試結果
  return {
    passed: allTestsPass,
    totalRequests,
    totalSuccess,
    totalLimited,
    test1Pass,
    test2Pass,
    test3Pass
  };
}

// 執行測試
runRateLimitTests()
  .then(result => {
    process.exit(result.passed ? 0 : 1);
  })
  .catch(err => {
    console.error('❌ 測試執行失敗:', err.message);
    console.error(err);
    process.exit(1);
  });
