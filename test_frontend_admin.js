const axios = require('axios');

async function testFrontendAndAdmin() {
  console.log('🌐 前台和管理後台測試');
  console.log('=====================================');
  
  const baseUrl = 'http://localhost:3003';
  
  // 測試1: 前台測試
  console.log('\n🛍️ 測試1: 前台客戶功能');
  
  const frontendPages = [
    { name: '前台首頁', url: '/', timeout: 10000 },
    { name: '商品目錄', url: '/products', timeout: 5000 },
    { name: '購物車', url: '/cart', timeout: 5000 },
    { name: '結帳頁面', url: '/checkout', timeout: 5000 }
  ];
  
  for (const page of frontendPages) {
    try {
      console.log(`\n  🔄 測試 ${page.name}: ${page.url}`);
      
      const response = await axios.get(`${baseUrl}${page.url}`, { 
        timeout: page.timeout,
        validateStatus: status => status < 500
      });
      
      console.log(`    ✅ 狀態: ${response.status}`);
      console.log(`    📏 大小: ${response.data.length} 字符`);
      
      // 檢查內容
      if (response.data.includes('誠憶鮮蔬')) {
        console.log('    🎯 包含品牌名稱');
      }
      
      if (page.name === '前台首頁' && response.data.includes('商品')) {
        console.log('    🛒 包含商品相關內容');
      }
      
    } catch (error) {
      if (error.code === 'ECONNABORTED') {
        console.log(`    ⏰ ${page.name} 請求超時`);
      } else {
        console.log(`    ❌ ${page.name} 錯誤: ${error.message}`);
      }
    }
  }
  
  // 測試2: 管理後台測試  
  console.log('\n👨‍💼 測試2: 管理後台功能');
  
  // 管理後台登錄
  console.log('\n  🔐 管理員登錄測試');
  let adminCookie = null;
  try {
    const adminData = new URLSearchParams();
    adminData.append('email', 'shnfred555283@gmail.com');
    adminData.append('password', 'admin123');
    
    const response = await axios.post(`${baseUrl}/admin/login`, adminData, {
      timeout: 10000,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      validateStatus: status => status < 500,
      maxRedirects: 0
    });
    
    console.log(`    ✅ 登錄響應狀態: ${response.status}`);
    
    if (response.status === 302 || response.headers['set-cookie']) {
      console.log('    🔄 管理員登錄成功');
      if (response.headers['set-cookie']) {
        adminCookie = response.headers['set-cookie'][0];
        console.log('    🍪 已獲取管理員 session');
      }
    }
    
  } catch (error) {
    if (error.response?.status === 302 && error.response.headers['set-cookie']) {
      console.log('    ✅ 管理員登錄成功（重定向）');
      adminCookie = error.response.headers['set-cookie'][0];
    } else {
      console.log(`    ❌ 管理員登錄錯誤: ${error.message}`);
    }
  }
  
  // 管理後台頁面測試
  const adminPages = [
    { name: '管理儀表板', url: '/admin/dashboard' },
    { name: '訂單管理', url: '/admin/orders' },
    { name: '商品管理', url: '/admin/products' },
    { name: '外送管理', url: '/admin/delivery' }
  ];
  
  for (const page of adminPages) {
    try {
      console.log(`\n  🔄 測試 ${page.name}: ${page.url}`);
      
      const headers = {};
      if (adminCookie) {
        headers.Cookie = adminCookie;
      }
      
      const response = await axios.get(`${baseUrl}${page.url}`, {
        headers,
        timeout: 5000,
        validateStatus: status => status < 500
      });
      
      console.log(`    ✅ 狀態: ${response.status}`);
      console.log(`    📏 大小: ${response.data.length} 字符`);
      
      if (response.status === 200) {
        if (response.data.includes('管理') || response.data.includes('儀表板')) {
          console.log('    🎯 成功進入管理頁面');
        }
      } else if (response.status === 302) {
        console.log('    🔄 被重定向，可能需要登錄');
      }
      
    } catch (error) {
      console.log(`    ❌ ${page.name} 錯誤: ${error.message}`);
    }
  }
  
  // 測試3: API健康檢查
  console.log('\n🔍 測試3: 系統API健康檢查');
  
  const healthEndpoints = [
    { name: '系統狀態', url: '/health' },
    { name: '版本資訊', url: '/version' },
    { name: 'API根路徑', url: '/api' }
  ];
  
  for (const endpoint of healthEndpoints) {
    try {
      const response = await axios.get(`${baseUrl}${endpoint.url}`, {
        timeout: 3000,
        validateStatus: status => status < 500
      });
      
      console.log(`  📡 ${endpoint.name}: 狀態 ${response.status}`);
      
      if (response.status === 200 && typeof response.data === 'object') {
        console.log(`    📊 JSON響應: ${Object.keys(response.data).length} 字段`);
      }
      
    } catch (error) {
      console.log(`  ❌ ${endpoint.name} 錯誤: ${error.message}`);
    }
  }
  
  console.log('\n📊 前台和後台測試總結');
  console.log('=====================================');
  console.log('  管理登錄:', adminCookie ? '✅ 成功' : '❌ 失敗');
  console.log('  系統模式: Demo模式（資料庫連接失敗）');
  console.log('  可用功能: 頁面渲染、用戶認證');
  console.log('  限制功能: 資料庫相關操作');
  
  console.log('\n🌐 完整系統網址：');
  console.log('  前台: http://localhost:3003/');
  console.log('  外送員: http://localhost:3003/driver');
  console.log('  管理後台: http://localhost:3003/admin');
}

testFrontendAndAdmin().catch(console.error);