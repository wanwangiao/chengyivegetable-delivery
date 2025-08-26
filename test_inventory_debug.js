const axios = require('axios');

async function testInventoryPage() {
  const baseURL = 'https://chengyivegetable.vercel.app';
  const password = 'shnf830629';
  
  try {
    console.log('🧪 測試庫存管理頁面...');
    
    // 建立axios實例以保持cookies
    const client = axios.create({
      withCredentials: true,
      maxRedirects: 5,
      validateStatus: function (status) {
        return status < 500; // 接受重定向和客戶端錯誤
      }
    });
    
    // 1. 登入
    console.log('1. 🔐 先登入...');
    const loginResponse = await client.post(`${baseURL}/admin/login`, `password=${password}`, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
    
    const cookies = loginResponse.headers['set-cookie'];
    console.log('✅ 登入成功，獲得cookies');
    
    // 2. 測試庫存頁面
    console.log('2. 📦 訪問庫存管理頁面...');
    try {
      const inventoryResponse = await client.get(`${baseURL}/admin/inventory`, {
        headers: {
          'Cookie': cookies ? cookies.join('; ') : ''
        }
      });
      
      console.log('✅ 庫存頁面回應狀態:', inventoryResponse.status);
      
      if (inventoryResponse.status === 200) {
        console.log('✅ 庫存頁面載入成功');
        // 檢查頁面內容
        const content = inventoryResponse.data;
        if (content.includes('庫存管理')) {
          console.log('✅ 頁面包含庫存管理標題');
        }
        if (content.includes('error') || content.includes('Error')) {
          console.log('⚠️ 頁面可能包含錯誤訊息');
        }
      }
      
    } catch (error) {
      if (error.response) {
        console.error('❌ 庫存頁面錯誤:', error.response.status);
        console.error('錯誤內容:', error.response.data.substring(0, 500));
        
        if (error.response.status === 500) {
          console.log('🔍 這是服務器內部錯誤，可能是：');
          console.log('- 資料庫連線問題');
          console.log('- SQL查詢語法錯誤'); 
          console.log('- 缺少inventory資料表');
          console.log('- 缺少products資料表');
        }
      } else {
        console.error('❌ 請求失敗:', error.message);
      }
    }
    
    // 3. 檢查其他可用的管理頁面作為對照
    console.log('3. 🔍 檢查其他管理頁面作為對照...');
    const testPages = ['/admin/products', '/admin/reports'];
    
    for (const page of testPages) {
      try {
        const response = await client.get(`${baseURL}${page}`, {
          headers: {
            'Cookie': cookies ? cookies.join('; ') : ''
          }
        });
        console.log(`✅ ${page}: 狀態 ${response.status} (正常)`);
      } catch (error) {
        console.log(`❌ ${page}: 錯誤 ${error.response ? error.response.status : error.message}`);
      }
    }
    
  } catch (error) {
    console.error('❌ 測試過程出錯:', error.message);
  }
}

testInventoryPage();