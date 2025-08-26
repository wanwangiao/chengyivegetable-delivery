const axios = require('axios');

async function testAdminLogin() {
  const baseURL = 'https://chengyivegetable.vercel.app';
  const password = 'shnf830629';
  
  try {
    console.log('🧪 開始測試管理員登入流程...');
    
    // 建立axios實例以保持cookies
    const client = axios.create({
      withCredentials: true,
      maxRedirects: 0,
      validateStatus: function (status) {
        return status < 400; // 接受重定向
      }
    });
    
    // 1. 取得登入頁面
    console.log('1. 📄 取得登入頁面...');
    const loginPageResponse = await client.get(`${baseURL}/admin/login`);
    console.log('✅ 登入頁面狀態:', loginPageResponse.status);
    
    // 提取cookies
    const setCookieHeader = loginPageResponse.headers['set-cookie'];
    console.log('🍪 收到的cookies:', setCookieHeader);
    
    // 2. 提交登入
    console.log('2. 🔐 提交登入憑證...');
    const loginResponse = await client.post(`${baseURL}/admin/login`, {
      password: password
    }, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': setCookieHeader ? setCookieHeader.join('; ') : ''
      },
      data: `password=${password}`
    });
    
    console.log('✅ 登入回應狀態:', loginResponse.status);
    console.log('📍 登入後重定向到:', loginResponse.headers.location || '無重定向');
    
    const loginSetCookies = loginResponse.headers['set-cookie'];
    console.log('🍪 登入後cookies:', loginSetCookies);
    
    // 3. 嘗試訪問管理頁面
    console.log('3. 📊 測試管理頁面訪問...');
    const testPages = [
      '/admin/dashboard',
      '/admin/products', 
      '/admin/inventory',
      '/admin/delivery',
      '/admin/reports',
      '/admin/basic-settings'
    ];
    
    for (const page of testPages) {
      try {
        const pageResponse = await client.get(`${baseURL}${page}`, {
          headers: {
            'Cookie': loginSetCookies ? loginSetCookies.join('; ') : ''
          }
        });
        
        if (pageResponse.status === 200) {
          console.log(`✅ ${page}: 成功載入 (${pageResponse.status})`);
        } else {
          console.log(`⚠️ ${page}: 狀態 ${pageResponse.status}`);
        }
      } catch (error) {
        if (error.response && error.response.status === 302) {
          console.log(`❌ ${page}: 重定向到 ${error.response.headers.location}`);
        } else {
          console.log(`❌ ${page}: 錯誤 - ${error.message}`);
        }
      }
    }
    
  } catch (error) {
    console.error('❌ 測試失敗:', error.response ? error.response.status : error.message);
    if (error.response) {
      console.error('回應內容:', error.response.data.substring(0, 200));
    }
  }
}

// 執行測試
testAdminLogin();