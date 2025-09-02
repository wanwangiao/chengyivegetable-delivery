#!/usr/bin/env node

const puppeteer = require('puppeteer');

async function testDriverLogin() {
  console.log('🔍 測試外送員登入流程...');
  
  let browser;
  try {
    browser = await puppeteer.launch({ 
      headless: false, // 設置為false以查看瀏覽器操作
      slowMo: 1000 // 減慢操作速度以便觀察
    });
    
    const page = await browser.newPage();
    
    // 1. 前往登入頁面
    console.log('📱 前往登入頁面...');
    await page.goto('https://veg-delivery-platform-j6p1gco7o-shi-jia-huangs-projects.vercel.app/driver/login', { waitUntil: 'networkidle2' });
    
    // 2. 輸入憑證
    console.log('🔐 輸入憑證...');
    await page.type('input[name="phone"]', '0912345678');
    await page.type('input[name="password"]', 'driver123');
    
    // 3. 點擊登入按鈕
    console.log('🚛 點擊登入按鈕...');
    await page.click('button[type="submit"]');
    
    // 4. 等待重定向完成
    await page.waitForNavigation({ waitUntil: 'networkidle2' });
    
    // 5. 檢查是否成功登入
    const currentUrl = page.url();
    console.log('📍 當前URL:', currentUrl);
    
    if (currentUrl.includes('/driver') && !currentUrl.includes('/login')) {
      console.log('✅ 成功登入外送員系統');
      
      // 6. 等待頁面完全載入
      await page.waitForTimeout(3000);
      
      // 7. 檢查是否有訂單載入錯誤
      const pageText = await page.evaluate(() => document.body.innerText);
      
      if (pageText.includes('載入全域訂單中...')) {
        console.log('⏳ 發現訂單載入狀態');
        
        // 等待訂單載入完成或超時
        try {
          await page.waitForFunction(
            () => !document.body.innerText.includes('載入全域訂單中...'),
            { timeout: 10000 }
          );
          console.log('✅ 訂單載入完成');
        } catch (error) {
          console.log('❌ 訂單載入超時，仍顯示載入中狀態');
        }
      }
      
      // 8. 檢查最終頁面狀態
      const finalPageText = await page.evaluate(() => document.body.innerText);
      
      if (finalPageText.includes('載入全域訂單中...')) {
        console.log('🔴 問題確認：系統仍卡在「載入全域訂單中...」');
        return false;
      } else if (finalPageText.includes('訂單') || finalPageText.includes('配送')) {
        console.log('✅ 成功載入外送員介面');
        return true;
      } else {
        console.log('⚠️ 頁面載入完成但狀態不明確');
        console.log('頁面內容片段:', finalPageText.substring(0, 200));
        return false;
      }
      
    } else {
      console.log('❌ 登入失敗，仍在登入頁面');
      return false;
    }
    
  } catch (error) {
    console.error('❌ 測試過程中發生錯誤:', error);
    return false;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// 執行測試
testDriverLogin().then(success => {
  if (success) {
    console.log('🎉 外送員系統測試成功');
    process.exit(0);
  } else {
    console.log('💥 外送員系統測試失敗');
    process.exit(1);
  }
}).catch(error => {
  console.error('💥 測試執行失敗:', error);
  process.exit(1);
});