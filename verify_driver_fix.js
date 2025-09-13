/**
 * 驗證外送員系統修復結果
 * 檢查修復後的資料庫狀態和功能
 */

const axios = require('axios');

const RAILWAY_BASE_URL = 'https://chengyivegetable-production-7b4a.up.railway.app';
const TEST_DRIVER = {
  phone: '0912345678',
  password: 'driver123'
};

console.log('🔧 外送員系統修復驗證工具');
console.log('======================================');
console.log(`📡 目標伺服器: ${RAILWAY_BASE_URL}`);
console.log('📅 驗證時間:', new Date().toLocaleString('zh-TW'));
console.log('');

async function testDriverLogin() {
  console.log('🔐 測試外送員登入功能...');
  
  try {
    // 獲取登入頁面
    const loginPageResponse = await axios.get(`${RAILWAY_BASE_URL}/driver/login`);
    console.log('✅ 登入頁面可訪問:', loginPageResponse.status === 200);
    
    // 嘗試登入
    const loginData = new URLSearchParams({
      phone: TEST_DRIVER.phone,
      password: TEST_DRIVER.password
    });
    
    const loginResponse = await axios.post(
      `${RAILWAY_BASE_URL}/driver/login`,
      loginData,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        maxRedirects: 0, // 不自動重定向
        validateStatus: (status) => status < 400 // 接受重定向狀態碼
      }
    );
    
    if (loginResponse.status === 302) {
      console.log('✅ 外送員登入成功 (重定向)');
      console.log('📍 重定向位置:', loginResponse.headers.location);
      
      // 獲取登入後的cookie
      const cookies = loginResponse.headers['set-cookie'];
      if (cookies && cookies.length > 0) {
        console.log('🍪 Session cookie已設置');
        return cookies;
      }
    } else {
      console.log('⚠️ 登入響應狀態:', loginResponse.status);
    }
    
  } catch (error) {
    if (error.response && error.response.status === 302) {
      console.log('✅ 外送員登入成功 (重定向異常捕獲)');
      return error.response.headers['set-cookie'];
    } else {
      console.error('❌ 登入測試失敗:', error.message);
    }
  }
  
  return null;
}

async function testDriverDashboard(cookies) {
  console.log('\n📊 測試外送員儀表板...');
  
  try {
    const dashboardResponse = await axios.get(
      `${RAILWAY_BASE_URL}/driver`,
      {
        headers: {
          'Cookie': cookies ? cookies.join('; ') : ''
        }
      }
    );
    
    if (dashboardResponse.status === 200) {
      console.log('✅ 儀表板頁面可訪問');
      
      // 檢查頁面內容
      const pageContent = dashboardResponse.data;
      const contentChecks = {
        '訂單列表': pageContent.includes('訂單列表') || pageContent.includes('order'),
        '勾選功能': pageContent.includes('checkbox') || pageContent.includes('選取'),
        '我的訂單': pageContent.includes('我的訂單') || pageContent.includes('my-orders'),
        'JavaScript功能': pageContent.includes('selectOrder') || pageContent.includes('driver')
      };
      
      console.log('📋 頁面內容檢查:');
      Object.entries(contentChecks).forEach(([key, value]) => {
        console.log(`   ${value ? '✅' : '❌'} ${key}`);
      });
      
      return true;
    } else {
      console.log('⚠️ 儀表板響應狀態:', dashboardResponse.status);
    }
    
  } catch (error) {
    console.error('❌ 儀表板測試失敗:', error.message);
  }
  
  return false;
}

async function testDriverAPIs(cookies) {
  console.log('\n🔌 測試外送員API端點...');
  
  const apiEndpoints = [
    '/api/driver/order-counts',
    '/api/driver/my-orders', 
    '/api/driver/stats',
    '/api/driver/area-orders/all'
  ];
  
  const results = {};
  
  for (const endpoint of apiEndpoints) {
    try {
      const response = await axios.get(
        `${RAILWAY_BASE_URL}${endpoint}`,
        {
          headers: {
            'Cookie': cookies ? cookies.join('; ') : ''
          },
          timeout: 10000
        }
      );
      
      if (response.status === 200) {
        console.log(`✅ ${endpoint}: 正常響應`);
        if (response.data) {
          console.log(`   📊 回傳資料: ${JSON.stringify(response.data).substring(0, 100)}...`);
        }
        results[endpoint] = { status: 'success', data: response.data };
      } else {
        console.log(`⚠️ ${endpoint}: 狀態 ${response.status}`);
        results[endpoint] = { status: 'warning', code: response.status };
      }
      
    } catch (error) {
      if (error.response) {
        console.log(`❌ ${endpoint}: 錯誤 ${error.response.status} - ${error.response.statusText}`);
        results[endpoint] = { status: 'error', code: error.response.status, message: error.response.statusText };
      } else {
        console.log(`❌ ${endpoint}: ${error.message}`);
        results[endpoint] = { status: 'error', message: error.message };
      }
    }
  }
  
  return results;
}

async function testOrderSelection(cookies) {
  console.log('\n📦 測試訂單勾選功能...');
  
  try {
    // 嘗試獲取可用訂單
    const ordersResponse = await axios.get(
      `${RAILWAY_BASE_URL}/api/driver/area-orders/all`,
      {
        headers: {
          'Cookie': cookies ? cookies.join('; ') : ''
        }
      }
    );
    
    if (ordersResponse.status === 200 && ordersResponse.data) {
      console.log('✅ 成功獲取訂單資料');
      
      if (Array.isArray(ordersResponse.data) && ordersResponse.data.length > 0) {
        console.log(`📋 找到 ${ordersResponse.data.length} 筆訂單`);
        
        // 檢查測試訂單
        const testOrders = ordersResponse.data.filter(order => 
          order.order_number && order.order_number.startsWith('TEST')
        );
        
        if (testOrders.length > 0) {
          console.log(`🎯 找到 ${testOrders.length} 筆測試訂單:`);
          testOrders.forEach(order => {
            console.log(`   - ${order.order_number}: ${order.customer_name} (${order.status})`);
          });
        } else {
          console.log('⚠️ 未找到測試訂單 (TEST001-003)');
        }
        
        return { hasOrders: true, testOrders: testOrders.length };
      } else {
        console.log('⚠️ 訂單資料為空或格式錯誤');
        return { hasOrders: false, testOrders: 0 };
      }
    } else {
      console.log('❌ 無法獲取訂單資料');
      return { hasOrders: false, testOrders: 0 };
    }
    
  } catch (error) {
    console.error('❌ 訂單勾選測試失敗:', error.message);
    return { hasOrders: false, testOrders: 0, error: error.message };
  }
}

async function generateReport(results) {
  console.log('\n📊 驗證結果報告');
  console.log('======================================');
  
  const {
    loginSuccess,
    dashboardSuccess,
    apiResults,
    orderResults
  } = results;
  
  // 計算總體成功率
  let totalTests = 0;
  let passedTests = 0;
  
  // 登入測試
  totalTests++;
  if (loginSuccess) passedTests++;
  console.log(`🔐 登入功能: ${loginSuccess ? '✅ 成功' : '❌ 失敗'}`);
  
  // 儀表板測試
  totalTests++;
  if (dashboardSuccess) passedTests++;
  console.log(`📊 儀表板: ${dashboardSuccess ? '✅ 成功' : '❌ 失敗'}`);
  
  // API測試
  console.log('🔌 API端點測試:');
  Object.entries(apiResults).forEach(([endpoint, result]) => {
    totalTests++;
    const success = result.status === 'success';
    if (success) passedTests++;
    console.log(`   ${success ? '✅' : '❌'} ${endpoint}: ${result.status}`);
  });
  
  // 訂單功能測試
  totalTests++;
  if (orderResults.hasOrders) passedTests++;
  console.log(`📦 訂單功能: ${orderResults.hasOrders ? '✅ 可用' : '❌ 不可用'}`);
  
  if (orderResults.testOrders > 0) {
    console.log(`🎯 測試訂單: ✅ 找到 ${orderResults.testOrders} 筆`);
  } else {
    console.log('🎯 測試訂單: ⚠️ 未找到 TEST001-003');
  }
  
  const successRate = ((passedTests / totalTests) * 100).toFixed(1);
  console.log('\n📈 總體狀況:');
  console.log(`   通過測試: ${passedTests}/${totalTests}`);
  console.log(`   成功率: ${successRate}%`);
  
  if (successRate >= 75) {
    console.log('🎉 外送員系統修復成功！');
    console.log('👨‍🚚 外送員可以正常登入並使用訂單勾選功能');
  } else if (successRate >= 50) {
    console.log('⚠️ 外送員系統部分修復成功');
    console.log('💡 仍有部分功能需要進一步調整');
  } else {
    console.log('❌ 外送員系統修復未完全成功');
    console.log('🔧 需要進一步診斷和修復');
  }
  
  console.log('\n📝 建議後續步驟:');
  if (!loginSuccess) {
    console.log('1. 檢查外送員認證系統');
  }
  if (!dashboardSuccess) {
    console.log('2. 檢查外送員儀表板頁面');
  }
  if (Object.values(apiResults).some(r => r.status === 'error')) {
    console.log('3. 檢查API端點和資料庫連接');
  }
  if (!orderResults.hasOrders || orderResults.testOrders === 0) {
    console.log('4. 檢查測試訂單是否正確建立');
  }
  
  return successRate;
}

async function main() {
  try {
    // 1. 測試登入
    const cookies = await testDriverLogin();
    const loginSuccess = !!cookies;
    
    // 2. 測試儀表板
    const dashboardSuccess = await testDriverDashboard(cookies);
    
    // 3. 測試API
    const apiResults = await testDriverAPIs(cookies);
    
    // 4. 測試訂單功能
    const orderResults = await testOrderSelection(cookies);
    
    // 5. 生成報告
    const successRate = await generateReport({
      loginSuccess,
      dashboardSuccess, 
      apiResults,
      orderResults
    });
    
    process.exit(successRate >= 75 ? 0 : 1);
    
  } catch (error) {
    console.error('💥 驗證過程發生異常:', error.message);
    process.exit(1);
  }
}

// 執行驗證
main();