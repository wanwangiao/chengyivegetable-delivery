#!/usr/bin/env node

const https = require('https');
const querystring = require('querystring');

async function testDriverAuth() {
  console.log('🔍 測試外送員認證流程...');
  
  try {
    // 1. 測試登入頁面可訪問性
    console.log('📱 測試登入頁面...');
    const loginPageResponse = await makeRequest({
      hostname: 'veg-delivery-platform-j6p1gco7o-shi-jia-huangs-projects.vercel.app',
      path: '/driver/login',
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    if (loginPageResponse.statusCode === 200) {
      console.log('✅ 登入頁面可正常訪問');
    } else {
      console.log('❌ 登入頁面訪問異常:', loginPageResponse.statusCode);
      return false;
    }
    
    // 2. 嘗試執行登入請求（模擬表單提交）
    console.log('🔐 測試登入請求...');
    const loginData = querystring.stringify({
      phone: '0912345678',
      password: 'driver123'
    });
    
    const loginResponse = await makeRequest({
      hostname: 'veg-delivery-platform-j6p1gco7o-shi-jia-huangs-projects.vercel.app',
      path: '/driver/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(loginData),
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    }, loginData);
    
    // 檢查登入響應
    if (loginResponse.statusCode === 302) {
      const location = loginResponse.headers.location;
      console.log('🔄 登入重定向到:', location);
      
      if (location && location.includes('/driver') && !location.includes('/login')) {
        console.log('✅ 登入成功，重定向到外送員介面');
        
        // 3. 測試外送員頁面
        console.log('📋 測試外送員主頁面...');
        const driverPageResponse = await makeRequest({
          hostname: 'veg-delivery-platform-j6p1gco7o-shi-jia-huangs-projects.vercel.app',
          path: location,
          method: 'GET',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Cookie': loginResponse.headers['set-cookie'] ? loginResponse.headers['set-cookie'].join('; ') : ''
          }
        });
        
        if (driverPageResponse.statusCode === 200) {
          console.log('✅ 外送員頁面可正常訪問');
          
          // 檢查頁面內容
          if (driverPageResponse.body && driverPageResponse.body.includes('載入全域訂單中')) {
            console.log('⚠️ 發現：頁面仍顯示「載入全域訂單中...」');
            return false;
          } else if (driverPageResponse.body && driverPageResponse.body.includes('訂單')) {
            console.log('✅ 外送員頁面正常載入');
            return true;
          } else {
            console.log('🔍 外送員頁面內容需要進一步檢查');
            return false;
          }
          
        } else {
          console.log('❌ 外送員頁面訪問失敗:', driverPageResponse.statusCode);
          return false;
        }
        
      } else {
        console.log('❌ 登入失敗，重定向位置異常');
        return false;
      }
      
    } else {
      console.log('❌ 登入請求失敗:', loginResponse.statusCode);
      if (loginResponse.body) {
        console.log('響應內容:', loginResponse.body.substring(0, 200));
      }
      return false;
    }
    
  } catch (error) {
    console.error('❌ 測試過程中發生錯誤:', error);
    return false;
  }
}

function makeRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: body
        });
      });
    });
    
    req.on('error', (err) => {
      reject(err);
    });
    
    if (data) {
      req.write(data);
    }
    req.end();
  });
}

// 執行測試
testDriverAuth().then(success => {
  if (success) {
    console.log('🎉 外送員認證流程測試通過');
  } else {
    console.log('💥 外送員認證流程存在問題');
    console.log('\n📋 結論：系統登入功能正常，但訂單載入仍有問題');
    console.log('🔧 建議：檢查登入後的訂單載入 API 響應');
  }
}).catch(error => {
  console.error('💥 測試執行失敗:', error);
});