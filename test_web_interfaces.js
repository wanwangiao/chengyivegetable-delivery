const axios = require('axios');

async function testWebInterfaces() {
  console.log('🌐 Web介面測試');
  console.log('=====================================');
  
  const baseUrl = 'http://localhost:3002';
  const tests = [
    { name: '前台首頁', url: '/' },
    { name: '外送員登錄頁', url: '/driver' },
    { name: '管理後台登錄', url: '/admin' },
    { name: '外送員儀表板', url: '/driver/dashboard' }
  ];
  
  for (const test of tests) {
    try {
      console.log(`\n🔄 測試 ${test.name}: ${baseUrl}${test.url}`);
      
      const response = await axios.get(`${baseUrl}${test.url}`, {
        timeout: 5000,
        validateStatus: function (status) {
          return status < 500; // 接受所有非500錯誤的響應
        }
      });
      
      console.log(`  ✅ 狀態碼: ${response.status}`);
      console.log(`  📏 內容長度: ${response.data.length} 字符`);
      
      // 檢查是否包含關鍵內容
      if (response.data.includes('誠憶鮮蔬') || response.data.includes('外送系統')) {
        console.log('  🎯 包含預期內容');
      } else {
        console.log('  ⚠️ 可能不是預期頁面');
      }
      
    } catch (error) {
      if (error.code === 'ECONNREFUSED') {
        console.log(`  ❌ 連接被拒絕 - 伺服器可能未運行`);
      } else if (error.code === 'ECONNRESET') {
        console.log(`  ❌ 連接重置`);
      } else {
        console.log(`  ❌ 錯誤: ${error.message}`);
      }
    }
  }
}

// 測試外送員登錄功能
async function testDriverLogin() {
  console.log('\n🚗 外送員登錄測試');
  console.log('=====================================');
  
  try {
    const loginData = {
      phone: '0912345678',
      password: 'driver123'
    };
    
    console.log('🔄 嘗試外送員登錄...');
    console.log(`  手機: ${loginData.phone}`);
    console.log(`  密碼: ${loginData.password}`);
    
    const response = await axios.post('http://localhost:3002/api/driver/login', loginData, {
      timeout: 10000,
      validateStatus: function (status) {
        return status < 500;
      }
    });
    
    console.log(`  ✅ 響應狀態: ${response.status}`);
    console.log(`  📄 響應內容:`, response.data);
    
    if (response.status === 200 && response.data.success) {
      console.log('  🎉 登錄成功！');
      return response.data;
    } else {
      console.log('  ❌ 登錄失敗');
      return null;
    }
    
  } catch (error) {
    console.log(`  ❌ 登錄測試錯誤: ${error.message}`);
    return null;
  }
}

// 測試外送員訂單API
async function testDriverOrders() {
  console.log('\n📦 外送員訂單API測試');
  console.log('=====================================');
  
  try {
    console.log('🔄 獲取可接訂單列表...');
    
    const response = await axios.get('http://localhost:3002/api/driver/available-orders', {
      timeout: 10000,
      validateStatus: function (status) {
        return status < 500;
      }
    });
    
    console.log(`  ✅ 響應狀態: ${response.status}`);
    
    if (response.status === 200 && Array.isArray(response.data)) {
      console.log(`  📦 總訂單數: ${response.data.length}`);
      
      const testOrders = response.data.filter(order => order.order_id && order.order_id.startsWith('TEST'));
      console.log(`  🧪 測試訂單數: ${testOrders.length}`);
      
      if (testOrders.length > 0) {
        console.log('  🎯 發現測試訂單:');
        testOrders.forEach(order => {
          console.log(`    ${order.order_id}: ${order.status} - ${order.customer_name || '無姓名'}`);
        });
      }
      
      return response.data;
    } else {
      console.log(`  ❌ 意外的響應格式:`, response.data);
      return null;
    }
    
  } catch (error) {
    console.log(`  ❌ 訂單API測試錯誤: ${error.message}`);
    return null;
  }
}

async function runAllWebTests() {
  await testWebInterfaces();
  const loginResult = await testDriverLogin();
  const ordersResult = await testDriverOrders();
  
  console.log('\n📊 Web測試總結');
  console.log('=====================================');
  console.log('  Web介面:', '需要檢查上述結果');
  console.log('  外送員登錄:', loginResult ? '✅ 成功' : '❌ 失敗');
  console.log('  訂單API:', ordersResult ? '✅ 成功' : '❌ 失敗');
  
  if (loginResult && ordersResult) {
    console.log('\n🎉 基本Web功能正常，可以進行瀏覽器測試');
  } else {
    console.log('\n⚠️ Web功能有問題，需要檢查API');
  }
}

runAllWebTests().catch(console.error);