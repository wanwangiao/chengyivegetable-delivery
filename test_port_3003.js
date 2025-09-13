const axios = require('axios');

async function testPort3003() {
  console.log('🌐 測試端口3003系統功能');
  console.log('=====================================');
  
  const baseUrl = 'http://localhost:3003';
  
  // 測試1: 基本頁面
  const pages = [
    { name: '前台首頁', url: '/', expectedContent: '誠憶鮮蔬' },
    { name: '外送員登錄', url: '/driver', expectedContent: '外送員' },
    { name: '管理後台', url: '/admin', expectedContent: '管理' }
  ];
  
  for (const page of pages) {
    try {
      console.log(`\n🔄 測試 ${page.name}: ${page.url}`);
      const response = await axios.get(`${baseUrl}${page.url}`, { timeout: 5000 });
      
      console.log(`  ✅ 狀態: ${response.status}`);
      console.log(`  📏 大小: ${response.data.length} 字符`);
      
      if (response.data.includes(page.expectedContent)) {
        console.log(`  🎯 包含預期內容: "${page.expectedContent}"`);
      } else {
        console.log(`  ⚠️ 未找到預期內容: "${page.expectedContent}"`);
      }
      
    } catch (error) {
      console.log(`  ❌ 錯誤: ${error.message}`);
    }
  }
  
  // 測試2: 外送員登錄API
  console.log('\n🚗 測試外送員登錄API');
  try {
    const loginData = {
      phone: '0912345678',
      password: 'driver123'
    };
    
    const response = await axios.post(`${baseUrl}/api/driver/login`, loginData, {
      timeout: 10000,
      validateStatus: status => status < 500
    });
    
    console.log(`  ✅ 登錄響應狀態: ${response.status}`);
    console.log(`  📄 響應內容:`, JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    console.log(`  ❌ 登錄API錯誤: ${error.message}`);
  }
  
  // 測試3: 外送員可用訂單API
  console.log('\n📦 測試外送員可用訂單API');
  try {
    const response = await axios.get(`${baseUrl}/api/driver/available-orders`, {
      timeout: 10000,
      validateStatus: status => status < 500
    });
    
    console.log(`  ✅ 訂單API響應狀態: ${response.status}`);
    
    if (Array.isArray(response.data)) {
      console.log(`  📦 訂單總數: ${response.data.length}`);
      
      const testOrders = response.data.filter(order => 
        order.order_id && order.order_id.startsWith('TEST')
      );
      console.log(`  🧪 測試訂單數: ${testOrders.length}`);
      
      if (testOrders.length > 0) {
        console.log('  🎯 測試訂單詳情:');
        testOrders.forEach(order => {
          console.log(`    ${order.order_id}: ${order.status} - ${order.customer_name || '無名稱'}`);
        });
      }
    } else {
      console.log(`  📄 非陣列響應:`, response.data);
    }
    
  } catch (error) {
    console.log(`  ❌ 訂單API錯誤: ${error.message}`);
  }
  
  // 測試4: 管理後台登錄API
  console.log('\n👨‍💼 測試管理後台登錄API');
  try {
    const adminData = {
      email: 'shnfred555283@gmail.com',
      password: 'admin123'
    };
    
    const response = await axios.post(`${baseUrl}/api/admin/login`, adminData, {
      timeout: 10000,
      validateStatus: status => status < 500
    });
    
    console.log(`  ✅ 管理登錄響應狀態: ${response.status}`);
    console.log(`  📄 響應內容:`, JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    console.log(`  ❌ 管理登錄API錯誤: ${error.message}`);
  }
  
  console.log('\n📊 測試完成');
  console.log('  系統網址: http://localhost:3003');
  console.log('  可以使用瀏覽器進行進一步測試');
}

testPort3003().catch(console.error);