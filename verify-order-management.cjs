/**
 * 訂單管理功能驗證測試
 * 用於驗證 rate limiting 問題解決後，核心訂單功能正常運作
 *
 * 執行: node verify-order-management.cjs
 */

const API_BASE = 'http://localhost:3000/api/v1';
let testResults = [];
let adminToken = null;
let testProductId = null;
let testOrderId = null;

// 工具函數
async function apiRequest(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (adminToken && !options.skipAuth) {
    headers['Authorization'] = `Bearer ${adminToken}`;
  }

  const response = await fetch(url, {
    ...options,
    headers
  });

  const data = await response.json();
  return { status: response.status, data };
}

function logTest(name, passed, message = '') {
  const status = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${status}: ${name}`);
  if (message) console.log(`   ${message}`);
  testResults.push({ name, passed, message });
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 測試套件
async function runTests() {
  console.log('='.repeat(60));
  console.log('訂單管理功能驗證測試');
  console.log('測試日期:', new Date().toISOString());
  console.log('='.repeat(60));
  console.log('');

  try {
    // 測試 1: 管理員登入
    console.log('📋 測試 1: 管理員登入');
    const loginRes = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        phone: '0900000000',
        password: 'admin123'
      }),
      skipAuth: true
    });

    if (loginRes.status === 200 && loginRes.data.data?.token) {
      adminToken = loginRes.data.data.token;
      logTest('管理員登入', true, `Token: ${adminToken.substring(0, 20)}...`);
    } else {
      logTest('管理員登入', false, `HTTP ${loginRes.status}`);
      console.log('❌ 無法繼續測試，管理員登入失敗');
      return;
    }
    console.log('');

    // 測試 2: 建立測試商品
    console.log('📋 測試 2: 建立測試商品');
    const productRes = await apiRequest('/admin/products', {
      method: 'POST',
      body: JSON.stringify({
        name: `測試商品_${Date.now()}`,
        category: '葉菜類',
        description: '驗證測試用商品',
        pricingType: 'FIXED',
        basePrice: 100,
        unit: '份',
        available: true,
        stock: 100,
        images: []
      })
    });

    if (productRes.status === 201 && productRes.data.data?.id) {
      testProductId = productRes.data.data.id;
      logTest('建立測試商品', true, `商品 ID: ${testProductId}`);
    } else {
      logTest('建立測試商品', false, `HTTP ${productRes.status}`);
    }
    console.log('');

    // 測試 3: 快速連續建立訂單（測試 rate limiting）
    console.log('📋 測試 3: 快速連續建立 5 筆訂單（驗證無 rate limiting）');
    const orderPromises = [];

    for (let i = 1; i <= 5; i++) {
      const orderData = {
        customerName: `測試客戶_${i}`,
        customerPhone: `090000000${i}`,
        deliveryAddress: '台北市測試路 123 號',
        items: [
          {
            productId: testProductId,
            quantity: 1,
            unitPrice: 100
          }
        ],
        deliveryFee: 50,
        totalAmount: 150,
        deliveryDate: new Date(Date.now() + 86400000).toISOString()
      };

      orderPromises.push(
        apiRequest('/orders', {
          method: 'POST',
          body: JSON.stringify(orderData)
        })
      );
    }

    const orderResults = await Promise.allSettled(orderPromises);
    const successCount = orderResults.filter(r =>
      r.status === 'fulfilled' && r.value.status === 201
    ).length;
    const failCount = orderResults.filter(r =>
      r.status === 'rejected' || (r.status === 'fulfilled' && r.value.status === 429)
    ).length;

    if (successCount === 5 && failCount === 0) {
      testOrderId = orderResults[0].value.data.data.id;
      logTest('快速連續建立訂單', true, `成功建立 ${successCount}/5 筆訂單，無 HTTP 429 錯誤`);
    } else if (failCount > 0 && orderResults.some(r => r.value?.status === 429)) {
      logTest('快速連續建立訂單', false, `遇到 rate limiting: ${failCount} 筆失敗 (HTTP 429)`);
    } else {
      logTest('快速連續建立訂單', false, `只成功 ${successCount}/5 筆訂單`);
    }
    console.log('');

    // 測試 4: 查詢訂單列表
    console.log('📋 測試 4: 查詢訂單列表');
    const listRes = await apiRequest('/admin/orders');

    if (listRes.status === 200 && Array.isArray(listRes.data.data)) {
      logTest('查詢訂單列表', true, `找到 ${listRes.data.data.length} 筆訂單`);
    } else {
      logTest('查詢訂單列表', false, `HTTP ${listRes.status}`);
    }
    console.log('');

    // 測試 5: 訂單狀態更新
    if (testOrderId) {
      console.log('📋 測試 5: 訂單狀態更新流程');

      // preparing
      const prepRes = await apiRequest(`/orders/${testOrderId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'preparing' })
      });
      const prepPassed = prepRes.status === 200;
      logTest('更新為準備中 (preparing)', prepPassed, prepPassed ? '✓' : `HTTP ${prepRes.status}`);

      await delay(100);

      // ready
      const readyRes = await apiRequest(`/orders/${testOrderId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'ready' })
      });
      const readyPassed = readyRes.status === 200;
      logTest('更新為備妥 (ready)', readyPassed, readyPassed ? '✓' : `HTTP ${readyRes.status}`);

      console.log('');
    }

    // 測試 6: 訂單歷史查詢
    if (testOrderId) {
      console.log('📋 測試 6: 訂單歷史查詢');
      const historyRes = await apiRequest(`/orders/${testOrderId}/history`);

      if (historyRes.status === 200 && Array.isArray(historyRes.data.data)) {
        const historyCount = historyRes.data.data.length;
        logTest('訂單歷史查詢', true, `找到 ${historyCount} 筆歷史記錄`);
      } else {
        logTest('訂單歷史查詢', false, `HTTP ${historyRes.status}`);
      }
      console.log('');
    }

    // 測試 7: 電話搜尋訂單
    console.log('📋 測試 7: 電話搜尋訂單');
    const searchRes = await apiRequest('/orders/search?phone=0900000001');

    if (searchRes.status === 200) {
      logTest('電話搜尋訂單', true, searchRes.data.data?.length > 0 ? '找到訂單' : '無訂單（正常）');
    } else {
      logTest('電話搜尋訂單', false, `HTTP ${searchRes.status}`);
    }
    console.log('');

  } catch (error) {
    console.error('❌ 測試執行錯誤:', error.message);
    logTest('測試執行', false, error.message);
  }

  // 測試結果總結
  console.log('='.repeat(60));
  console.log('📊 測試結果總結');
  console.log('='.repeat(60));

  const totalTests = testResults.length;
  const passedTests = testResults.filter(t => t.passed).length;
  const failedTests = totalTests - passedTests;
  const passRate = ((passedTests / totalTests) * 100).toFixed(2);

  console.log(`總測試數: ${totalTests}`);
  console.log(`通過: ${passedTests} ✅`);
  console.log(`失敗: ${failedTests} ❌`);
  console.log(`通過率: ${passRate}%`);
  console.log('');

  if (failedTests > 0) {
    console.log('失敗的測試:');
    testResults.filter(t => !t.passed).forEach(t => {
      console.log(`  ❌ ${t.name}: ${t.message}`);
    });
    console.log('');
  }

  // Rate Limiting 驗證
  const rateLimitTest = testResults.find(t => t.name === '快速連續建立訂單');
  if (rateLimitTest) {
    console.log('🎯 Rate Limiting 驗證:');
    if (rateLimitTest.passed) {
      console.log('  ✅ 開發環境 rate limiting 已成功禁用');
      console.log('  ✅ 可以快速連續執行 API 請求');
      console.log('  ✅ 測試執行不會被 HTTP 429 阻擋');
    } else {
      console.log('  ❌ Rate limiting 仍在運作');
      console.log('  ❌ 請檢查 NODE_ENV 是否設定為 development');
      console.log('  ❌ 請確認 API 服務器已重啟');
    }
    console.log('');
  }

  // 最終評估
  console.log('='.repeat(60));
  if (passRate >= 90) {
    console.log('✅ 測試結果: 優秀 - 系統運作正常');
    console.log('✅ Rate limiting 障礙已成功排除');
    console.log('✅ 建議繼續執行完整測試套件');
  } else if (passRate >= 70) {
    console.log('⚠️  測試結果: 良好 - 部分功能需要檢查');
  } else {
    console.log('❌ 測試結果: 需要修復 - 多項功能異常');
  }
  console.log('='.repeat(60));
}

// 執行測試
runTests().catch(err => {
  console.error('測試執行失敗:', err);
  process.exit(1);
});
