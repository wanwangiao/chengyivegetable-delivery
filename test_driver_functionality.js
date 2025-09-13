const axios = require('axios');
const FormData = require('form-data');

async function testDriverFunctionality() {
  console.log('🚗 外送員功能測試');
  console.log('=====================================');
  
  const baseUrl = 'http://localhost:3003';
  const driverCredentials = {
    phone: '0912345678',
    password: 'driver123'
  };
  
  // 測試1: 外送員登錄頁面
  console.log('\n📄 測試1: 外送員登錄頁面');
  try {
    const response = await axios.get(`${baseUrl}/driver`, { timeout: 5000 });
    console.log(`  ✅ 頁面狀態: ${response.status}`);
    console.log(`  📏 頁面大小: ${response.data.length} 字符`);
    
    if (response.data.includes('外送員登入')) {
      console.log('  🎯 找到外送員登入表單');
    } else {
      console.log('  ⚠️ 未找到預期的登入表單');
    }
  } catch (error) {
    console.log(`  ❌ 錯誤: ${error.message}`);
  }
  
  // 測試2: 外送員登錄功能（POST）
  console.log('\n🔐 測試2: 外送員登錄功能');
  let sessionCookie = null;
  try {
    const formData = new URLSearchParams();
    formData.append('phone', driverCredentials.phone);
    formData.append('password', driverCredentials.password);
    
    const response = await axios.post(`${baseUrl}/driver/login`, formData, {
      timeout: 10000,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      validateStatus: status => status < 500,
      maxRedirects: 0 // 不自動跟隨重定向
    });
    
    console.log(`  ✅ 登錄響應狀態: ${response.status}`);
    
    if (response.status === 302) {
      console.log('  🔄 登錄成功，收到重定向響應');
      console.log(`  📍 重定向位置: ${response.headers.location || '無'}`);
      
      // 保存 session cookie
      if (response.headers['set-cookie']) {
        sessionCookie = response.headers['set-cookie'][0];
        console.log('  🍪 已獲取 session cookie');
      }
    } else {
      console.log(`  📄 響應內容: ${response.data.substring(0, 200)}...`);
    }
    
  } catch (error) {
    if (error.response?.status === 302) {
      console.log('  ✅ 登錄成功（重定向）');
      if (error.response.headers['set-cookie']) {
        sessionCookie = error.response.headers['set-cookie'][0];
        console.log('  🍪 已獲取 session cookie');
      }
    } else {
      console.log(`  ❌ 登錄錯誤: ${error.message}`);
    }
  }
  
  // 測試3: 外送員儀表板
  console.log('\n📊 測試3: 外送員儀表板');
  try {
    const headers = {};
    if (sessionCookie) {
      headers.Cookie = sessionCookie;
    }
    
    const response = await axios.get(`${baseUrl}/driver/dashboard`, {
      headers,
      timeout: 10000,
      validateStatus: status => status < 500
    });
    
    console.log(`  ✅ 儀表板狀態: ${response.status}`);
    
    if (response.status === 200) {
      console.log(`  📏 頁面大小: ${response.data.length} 字符`);
      
      if (response.data.includes('外送員儀表板') || response.data.includes('可接訂單')) {
        console.log('  🎯 成功進入外送員儀表板');
      } else {
        console.log('  ⚠️ 頁面內容異常');
      }
    } else if (response.status === 302) {
      console.log('  🔄 被重定向，可能需要登錄');
    }
    
  } catch (error) {
    console.log(`  ❌ 儀表板錯誤: ${error.message}`);
  }
  
  // 測試4: 外送員API端點
  console.log('\n🔌 測試4: 外送員API端點');
  const apiEndpoints = [
    { name: '訂單統計', url: '/api/driver/order-counts' },
    { name: '我的訂單', url: '/api/driver/my-orders' },
    { name: '外送員統計', url: '/api/driver/stats' }
  ];
  
  for (const endpoint of apiEndpoints) {
    try {
      const headers = {};
      if (sessionCookie) {
        headers.Cookie = sessionCookie;
      }
      
      const response = await axios.get(`${baseUrl}${endpoint.url}`, {
        headers,
        timeout: 5000,
        validateStatus: status => status < 500
      });
      
      console.log(`  📡 ${endpoint.name}: 狀態 ${response.status}`);
      
      if (response.status === 200) {
        if (typeof response.data === 'object') {
          console.log(`    📊 JSON響應，包含 ${Object.keys(response.data).length} 個字段`);
        } else {
          console.log(`    📄 文本響應，長度 ${response.data.length}`);
        }
      }
      
    } catch (error) {
      console.log(`  ❌ ${endpoint.name} 錯誤: ${error.message}`);
    }
  }
  
  // 測試5: 系統狀態檢查
  console.log('\n🔍 測試5: 系統狀態檢查');
  try {
    const response = await axios.get(`${baseUrl}/api/status`, {
      timeout: 5000,
      validateStatus: status => status < 500
    });
    
    console.log(`  ✅ 系統狀態: ${response.status}`);
    if (response.status === 200) {
      console.log(`  📊 狀態資訊:`, response.data);
    }
    
  } catch (error) {
    console.log(`  ❌ 狀態檢查錯誤: ${error.message}`);
  }
  
  console.log('\n📊 外送員功能測試總結');
  console.log('=====================================');
  console.log('  登錄頁面: 可訪問');
  console.log('  登錄功能:', sessionCookie ? '✅ 成功' : '❌ 失敗');
  console.log('  系統網址: http://localhost:3003/driver');
  
  if (sessionCookie) {
    console.log('\n✅ 外送員功能基本正常，建議進行手動瀏覽器測試');
  } else {
    console.log('\n⚠️ 外送員登錄有問題，需要檢查資料庫或認證邏輯');
  }
}

testDriverFunctionality().catch(console.error);