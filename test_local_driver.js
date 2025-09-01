const puppeteer = require('puppeteer');

async function testDriverInterface() {
    console.log('🔍 測試外送員介面功能...\n');
    
    const browser = await puppeteer.launch({
        headless: false, // 顯示瀏覽器
        defaultViewport: { width: 390, height: 844 } // iPhone 12 尺寸
    });
    
    const page = await browser.newPage();
    
    try {
        // 1. 開啟登入頁面
        console.log('1️⃣ 開啟外送員登入頁面...');
        await page.goto('http://localhost:3002/driver');
        await page.waitForTimeout(2000);
        
        // 2. 執行登入
        console.log('2️⃣ 執行登入...');
        await page.type('input[name="phone"]', '0912345678');
        await page.type('input[name="password"]', 'driver123');
        await page.click('button[type="submit"]');
        await page.waitForTimeout(3000);
        
        // 3. 檢查是否有記錄查詢按鈕
        console.log('3️⃣ 檢查介面元素...');
        
        const hasRecordButton = await page.evaluate(() => {
            const btn = document.querySelector('.record-query-btn');
            return btn !== null;
        });
        console.log(`   記錄查詢按鈕: ${hasRecordButton ? '✅ 有' : '❌ 無'}`);
        
        // 4. 檢查是否沒有收入顯示
        const hasIncome = await page.evaluate(() => {
            const text = document.body.innerText;
            return text.includes('今日收入') || text.includes('本日收入');
        });
        console.log(`   收入顯示: ${hasIncome ? '❌ 還在顯示（錯誤）' : '✅ 已移除（正確）'}`);
        
        // 5. 檢查訂單勾選框
        await page.waitForTimeout(2000);
        const hasCheckbox = await page.evaluate(() => {
            const checkbox = document.querySelector('.order-select-checkbox');
            return checkbox !== null;
        });
        console.log(`   訂單勾選框: ${hasCheckbox ? '✅ 有' : '❌ 無'}`);
        
        // 6. 測試勾選訂單
        console.log('\n4️⃣ 測試勾選訂單功能...');
        const orderExists = await page.evaluate(() => {
            const orderCard = document.querySelector('.order-card');
            if (orderCard) {
                orderCard.click();
                return true;
            }
            return false;
        });
        
        if (orderExists) {
            await page.waitForTimeout(1000);
            
            // 檢查確認接單按鈕
            const hasConfirmButton = await page.evaluate(() => {
                const btn = document.querySelector('.btn-confirm-orders');
                return btn && btn.style.display !== 'none';
            });
            console.log(`   確認接單按鈕: ${hasConfirmButton ? '✅ 顯示' : '❌ 未顯示'}`);
            
            // 檢查付款方式顯示
            const hasPaymentMethod = await page.evaluate(() => {
                const text = document.body.innerText;
                return text.includes('Line Pay') || text.includes('貨到付款') || text.includes('轉帳付款');
            });
            console.log(`   付款方式顯示: ${hasPaymentMethod ? '✅ 有' : '❌ 無'}`);
        }
        
        // 7. 測試記錄查詢彈窗
        console.log('\n5️⃣ 測試記錄查詢功能...');
        const recordButtonClicked = await page.evaluate(() => {
            const btn = document.querySelector('.record-query-btn');
            if (btn) {
                btn.click();
                return true;
            }
            return false;
        });
        
        if (recordButtonClicked) {
            await page.waitForTimeout(1000);
            const modalVisible = await page.evaluate(() => {
                const modal = document.querySelector('.stats-modal');
                return modal && modal.classList.contains('show');
            });
            console.log(`   統計記錄彈窗: ${modalVisible ? '✅ 顯示' : '❌ 未顯示'}`);
            
            // 檢查是否沒有收入相關內容
            const modalHasIncome = await page.evaluate(() => {
                const modal = document.querySelector('.stats-modal');
                if (modal) {
                    return modal.innerText.includes('收入');
                }
                return false;
            });
            console.log(`   彈窗內收入顯示: ${modalHasIncome ? '❌ 還在顯示（錯誤）' : '✅ 已移除（正確）'}`);
        }
        
        console.log('\n✅ 測試完成！');
        console.log('請手動檢查瀏覽器視窗確認介面是否正確。');
        console.log('按 Ctrl+C 結束測試...');
        
    } catch (error) {
        console.error('❌ 測試失敗:', error);
    }
}

// 執行測試
testDriverInterface();