const puppeteer = require('puppeteer');

async function testCartFunctionality() {
    console.log('?? ??皜祈岫鞈潛頠???..\n');
    
    const browser = await puppeteer.launch({ 
        headless: false,  // 憿舐內?汗?其誑靘輯?撖?
        defaultViewport: { width: 1200, height: 800 }
    });
    
    const page = await browser.newPage();
    
    try {
        // 1. 撠?啁雯蝡?
        console.log('? 撠?啗??園悅?祉雯蝡?..');
        await page.goto('https://chengyivegetable-production-7b4a.up.railway.app', { 
            waitUntil: 'networkidle2',
            timeout: 10000 
        });
        
        // 蝑??頛
        await page.waitForTimeout(3000);
        
        // 2. 瑼Ｘ鞈潛頠?璅?血???
        console.log('?? 瑼Ｘ鞈潛頠?璅?..');
        const cartIcon = await page.$('.cart-icon, #cart-icon, [class*="cart"]');
        if (cartIcon) {
            console.log('??鞈潛頠?璅???);
        } else {
            console.log('???芣?啗頃?抵???');
        }
        
        // 3. 撠?Ｗ?銝行葫閰行溶?鞈潛頠?
        console.log('?布 撠?舐?Ｗ?...');
        
        // 蝑??Ｗ?頛
        await page.waitForSelector('.product-item, .product-card, [class*="product"]', { timeout: 10000 });
        
        // ??????
        const products = await page.$$('.product-item, .product-card, [class*="product"]');
        console.log(`? ?曉 ${products.length} ??);
        
        if (products.length > 0) {
            // 4. 皜祈岫瘛餃?蝚砌???鞈潛頠?
            console.log('???岫瘛餃?蝚砌???鞈潛頠?..');
            
            // ?交"?鞈潛頠???
            const addToCartBtn = await page.$('button[onclick*="addToCart"], .add-to-cart, [class*="add-cart"]');
            
            if (addToCartBtn) {
                await addToCartBtn.click();
                console.log('????暺??鞈潛頠???);
                
                // 蝑?銝銝??摰?
                await page.waitForTimeout(2000);
                
                // 5. 瑼Ｘ鞈潛頠?行??賊?憿舐內
                const cartCount = await page.$('.cart-count, .cart-quantity, [class*="cart-num"]');
                if (cartCount) {
                    const count = await cartCount.textContent();
                    console.log(`??鞈潛頠＊蝷箸?? ${count}`);
                }
                
            } else {
                console.log('???芣?啣??亥頃?抵???');
            }
        }
        
        // 6. 皜祈岫??鞈潛頠?
        console.log('?? ?岫??鞈潛頠?..');
        if (cartIcon) {
            await cartIcon.click();
            await page.waitForTimeout(2000);
            
            // 瑼Ｘ鞈潛頠?踵?血??
            const cartModal = await page.$('.cart-modal, .shopping-cart, [class*="cart-panel"]');
            if (cartModal) {
                console.log('??鞈潛頠?踵?????);
                
                // 7. 瑼Ｘ鞈潛頠摰?
                const cartItems = await page.$$('.cart-item, [class*="cart-product"]');
                console.log(`?? 鞈潛頠葉??${cartItems.length} ???害);
                
            } else {
                console.log('??鞈潛頠?踵??');
            }
        }
        
        // 8. ?芸?靽?皜祈岫蝯?
        await page.screenshot({ path: 'cart_test_screenshot.png', fullPage: true });
        console.log('? 撌脖?摮葫閰行?? cart_test_screenshot.png');
        
    } catch (error) {
        console.error('??皜祈岫??銝剔?隤?', error.message);
    }
    
    console.log('\n?? 鞈潛頠??賣葫閰血???);
    await browser.close();
}

// ?瑁?皜祈岫
testCartFunctionality().catch(console.error);
