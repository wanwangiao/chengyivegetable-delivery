const puppeteer = require('puppeteer');

async function testCartFunctionality() {
    console.log('🛒 開始測試購物車功能...\n');
    
    const browser = await puppeteer.launch({ 
        headless: false,  // 顯示瀏覽器以便觀察
        defaultViewport: { width: 1200, height: 800 }
    });
    
    const page = await browser.newPage();
    
    try {
        // 1. 導航到網站
        console.log('📱 導航到誠憶鮮蔬網站...');
        await page.goto('https://chengyivegetable.vercel.app', { 
            waitUntil: 'networkidle2',
            timeout: 10000 
        });
        
        // 等待頁面載入
        await page.waitForTimeout(3000);
        
        // 2. 檢查購物車圖標是否存在
        console.log('🔍 檢查購物車圖標...');
        const cartIcon = await page.$('.cart-icon, #cart-icon, [class*="cart"]');
        if (cartIcon) {
            console.log('✅ 購物車圖標存在');
        } else {
            console.log('❌ 未找到購物車圖標');
        }
        
        // 3. 尋找產品並測試添加到購物車
        console.log('🥬 尋找可用產品...');
        
        // 等待產品載入
        await page.waitForSelector('.product-item, .product-card, [class*="product"]', { timeout: 10000 });
        
        // 取得所有產品
        const products = await page.$$('.product-item, .product-card, [class*="product"]');
        console.log(`📦 找到 ${products.length} 個產品`);
        
        if (products.length > 0) {
            // 4. 測試添加第一個產品到購物車
            console.log('➕ 嘗試添加第一個產品到購物車...');
            
            // 查找"加入購物車"按鈕
            const addToCartBtn = await page.$('button[onclick*="addToCart"], .add-to-cart, [class*="add-cart"]');
            
            if (addToCartBtn) {
                await addToCartBtn.click();
                console.log('✅ 成功點擊加入購物車按鈕');
                
                // 等待一下讓動畫完成
                await page.waitForTimeout(2000);
                
                // 5. 檢查購物車是否有數量顯示
                const cartCount = await page.$('.cart-count, .cart-quantity, [class*="cart-num"]');
                if (cartCount) {
                    const count = await cartCount.textContent();
                    console.log(`✅ 購物車顯示數量: ${count}`);
                }
                
            } else {
                console.log('❌ 未找到加入購物車按鈕');
            }
        }
        
        // 6. 測試打開購物車
        console.log('🛒 嘗試打開購物車...');
        if (cartIcon) {
            await cartIcon.click();
            await page.waitForTimeout(2000);
            
            // 檢查購物車面板是否出現
            const cartModal = await page.$('.cart-modal, .shopping-cart, [class*="cart-panel"]');
            if (cartModal) {
                console.log('✅ 購物車面板成功打開');
                
                // 7. 檢查購物車內容
                const cartItems = await page.$$('.cart-item, [class*="cart-product"]');
                console.log(`📋 購物車中有 ${cartItems.length} 個項目`);
                
            } else {
                console.log('❌ 購物車面板未打開');
            }
        }
        
        // 8. 截圖保存測試結果
        await page.screenshot({ path: 'cart_test_screenshot.png', fullPage: true });
        console.log('📸 已保存測試截圖: cart_test_screenshot.png');
        
    } catch (error) {
        console.error('❌ 測試過程中發生錯誤:', error.message);
    }
    
    console.log('\n🏁 購物車功能測試完成');
    await browser.close();
}

// 執行測試
testCartFunctionality().catch(console.error);