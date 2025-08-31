// 完整的庫存管理和下單流程測試
const puppeteer = require('puppeteer');
const fs = require('fs');

// 測試配置
const BASE_URL = 'http://localhost:3003';
const ADMIN_PASSWORD = 'shnf830629';

// 測試數據
const testProducts = [
    {
        name: '高麗菜',
        unit: '斤',
        price_type: 'weight',
        price: 30,
        stock_before: 50,    // 斤
        stock_add: 30,       // 斤
        stock_after: 80,     // 斤
        order_quantity: 2,   // 斤
        final_stock: 78      // 斤
    },
    {
        name: '青江菜',
        unit: '公斤',
        price_type: 'weight',
        price: 45,
        stock_before: 20,    // 公斤
        stock_add: 15,       // 公斤
        stock_after: 35,     // 公斤
        order_quantity: 1.5, // 公斤
        final_stock: 33.5    // 公斤
    },
    {
        name: '地瓜葉',
        unit: '台斤',
        price_type: 'weight',
        price: 25,
        stock_before: 30,    // 台斤 (1台斤 = 0.6公斤)
        stock_add: 20,       // 台斤
        stock_after: 50,     // 台斤
        order_quantity: 3,   // 台斤
        final_stock: 47      // 台斤
    },
    {
        name: '蘋果',
        unit: '斤',
        price_type: 'fixed',
        price: 60,
        stock_before: 100,   // 斤
        stock_add: 50,       // 斤
        stock_after: 150,    // 斤
        order_quantity: 5,   // 斤
        final_stock: 145     // 斤
    }
];

// 單位換算測試數據
const unitConversionTests = [
    {
        product: '高麗菜',
        unit: '斤',
        quantity: 2,
        expectedKg: 1.2,  // 2斤 = 1.2公斤
        expectedTaiwan: 2  // 2斤 = 2台斤
    },
    {
        product: '青江菜',
        unit: '公斤',
        quantity: 1.5,
        expectedJin: 2.5,    // 1.5公斤 = 2.5斤
        expectedTaiwan: 2.5  // 1.5公斤 = 2.5台斤
    },
    {
        product: '地瓜葉',
        unit: '台斤',
        quantity: 3,
        expectedKg: 1.8,   // 3台斤 = 1.8公斤
        expectedJin: 3     // 3台斤 = 3斤
    }
];

let testResults = {
    timestamp: new Date().toISOString(),
    tests: [],
    summary: {
        total: 0,
        passed: 0,
        failed: 0
    }
};

async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTest() {
    const browser = await puppeteer.launch({
        headless: false,
        defaultViewport: null,
        args: ['--start-maximized']
    });

    const page = await browser.newPage();
    
    try {
        console.log('🔬 開始庫存管理和下單流程測試...\n');
        
        // 1. 登入後台
        console.log('📋 步驟 1: 登入後台管理系統');
        await page.goto(`${BASE_URL}/admin/login`);
        await page.waitForSelector('#password');
        await page.type('#password', ADMIN_PASSWORD);
        await page.click('button[type="submit"]');
        await delay(2000);
        
        // 2. 進入庫存管理頁面
        console.log('📋 步驟 2: 進入庫存管理頁面');
        await page.goto(`${BASE_URL}/admin/inventory`);
        await delay(2000);
        
        // 3. 記錄初始庫存
        console.log('📋 步驟 3: 記錄初始庫存狀態');
        const initialStocks = await page.evaluate(() => {
            const stocks = {};
            document.querySelectorAll('.inventory-card').forEach(card => {
                const name = card.querySelector('.product-name')?.textContent;
                const stockText = card.querySelector('.stock-quantity')?.textContent;
                if (name && stockText) {
                    const stock = parseFloat(stockText.match(/[\d.]+/)?.[0] || 0);
                    stocks[name] = stock;
                }
            });
            return stocks;
        });
        console.log('初始庫存:', initialStocks);
        
        // 4. 執行入庫操作
        console.log('\n📋 步驟 4: 執行入庫操作');
        for (const product of testProducts) {
            console.log(`  入庫: ${product.name} - 增加 ${product.stock_add} ${product.unit}`);
            
            // 點擊入庫按鈕
            await page.evaluate((productName) => {
                const cards = Array.from(document.querySelectorAll('.inventory-card'));
                const card = cards.find(c => c.querySelector('.product-name')?.textContent === productName);
                if (card) {
                    const addBtn = card.querySelector('.btn-success');
                    if (addBtn) addBtn.click();
                }
            }, product.name);
            
            await delay(1000);
            
            // 輸入入庫數量
            await page.waitForSelector('#addQuantity');
            await page.evaluate(() => {
                document.querySelector('#addQuantity').value = '';
            });
            await page.type('#addQuantity', product.stock_add.toString());
            
            // 確認入庫
            await page.click('#confirmAddStock');
            await delay(1500);
        }
        
        // 5. 驗證入庫後庫存
        console.log('\n📋 步驟 5: 驗證入庫後庫存');
        await page.reload();
        await delay(2000);
        
        const stocksAfterAdd = await page.evaluate(() => {
            const stocks = {};
            document.querySelectorAll('.inventory-card').forEach(card => {
                const name = card.querySelector('.product-name')?.textContent;
                const stockText = card.querySelector('.stock-quantity')?.textContent;
                if (name && stockText) {
                    const stock = parseFloat(stockText.match(/[\d.]+/)?.[0] || 0);
                    stocks[name] = stock;
                }
            });
            return stocks;
        });
        
        for (const product of testProducts) {
            const actualStock = stocksAfterAdd[product.name] || 0;
            const expectedStock = (initialStocks[product.name] || product.stock_before) + product.stock_add;
            const passed = Math.abs(actualStock - expectedStock) < 0.01;
            
            testResults.tests.push({
                name: `入庫測試 - ${product.name}`,
                expected: expectedStock,
                actual: actualStock,
                unit: product.unit,
                passed: passed
            });
            
            console.log(`  ${product.name}: 預期 ${expectedStock} ${product.unit}, 實際 ${actualStock} ${product.unit} - ${passed ? '✅ 通過' : '❌ 失敗'}`);
        }
        
        // 6. 前台下單測試
        console.log('\n📋 步驟 6: 前台客戶下單測試');
        const page2 = await browser.newPage();
        await page2.goto(BASE_URL);
        await delay(2000);
        
        // 添加商品到購物車
        for (const product of testProducts) {
            console.log(`  下單: ${product.name} - ${product.order_quantity} ${product.unit}`);
            
            // 搜尋商品
            await page2.evaluate((productName) => {
                const searchInput = document.querySelector('#searchInput');
                if (searchInput) {
                    searchInput.value = productName;
                    searchInput.dispatchEvent(new Event('input'));
                }
            }, product.name);
            
            await delay(1000);
            
            // 點擊商品
            await page2.evaluate((productName) => {
                const products = Array.from(document.querySelectorAll('.product-card'));
                const product = products.find(p => p.querySelector('.product-name')?.textContent.includes(productName));
                if (product) product.click();
            }, product.name);
            
            await delay(1000);
            
            // 設定數量並加入購物車
            if (product.price_type === 'weight') {
                await page2.evaluate((qty) => {
                    const weightInput = document.querySelector('#weightInput');
                    if (weightInput) {
                        weightInput.value = qty;
                        weightInput.dispatchEvent(new Event('input'));
                    }
                }, product.order_quantity);
            } else {
                await page2.evaluate((qty) => {
                    const quantityInput = document.querySelector('#quantityInput');
                    if (quantityInput) {
                        quantityInput.value = qty;
                        quantityInput.dispatchEvent(new Event('input'));
                    }
                }, product.order_quantity);
            }
            
            await delay(500);
            
            // 加入購物車
            await page2.click('#addToCartBtn');
            await delay(1000);
            
            // 關閉模態窗口
            await page2.evaluate(() => {
                const closeBtn = document.querySelector('.modal .close-btn');
                if (closeBtn) closeBtn.click();
            });
            await delay(500);
        }
        
        // 7. 結帳
        console.log('\n📋 步驟 7: 執行結帳');
        await page2.click('#cartIcon');
        await delay(1000);
        
        await page2.click('#checkoutBtn');
        await delay(1000);
        
        // 填寫客戶資料
        await page2.type('#customerName', '測試客戶');
        await page2.type('#customerPhone', '0912345678');
        await page2.type('#deliveryAddress', '測試地址');
        await delay(500);
        
        // 提交訂單
        await page2.click('#submitOrder');
        await delay(2000);
        
        // 8. 驗證庫存扣除
        console.log('\n📋 步驟 8: 驗證庫存扣除');
        await page.reload();
        await delay(2000);
        
        const finalStocks = await page.evaluate(() => {
            const stocks = {};
            document.querySelectorAll('.inventory-card').forEach(card => {
                const name = card.querySelector('.product-name')?.textContent;
                const stockText = card.querySelector('.stock-quantity')?.textContent;
                if (name && stockText) {
                    const stock = parseFloat(stockText.match(/[\d.]+/)?.[0] || 0);
                    stocks[name] = stock;
                }
            });
            return stocks;
        });
        
        for (const product of testProducts) {
            const actualStock = finalStocks[product.name] || 0;
            const expectedStock = stocksAfterAdd[product.name] - product.order_quantity;
            const passed = Math.abs(actualStock - expectedStock) < 0.01;
            
            testResults.tests.push({
                name: `庫存扣除測試 - ${product.name}`,
                expected: expectedStock,
                actual: actualStock,
                unit: product.unit,
                passed: passed
            });
            
            console.log(`  ${product.name}: 預期 ${expectedStock} ${product.unit}, 實際 ${actualStock} ${product.unit} - ${passed ? '✅ 通過' : '❌ 失敗'}`);
        }
        
        // 9. 單位換算測試
        console.log('\n📋 步驟 9: 單位換算測試');
        for (const test of unitConversionTests) {
            // 斤轉公斤
            if (test.unit === '斤') {
                const kg = test.quantity * 0.6;
                const passed = Math.abs(kg - test.expectedKg) < 0.01;
                testResults.tests.push({
                    name: `單位換算 - ${test.quantity}斤 → 公斤`,
                    expected: test.expectedKg,
                    actual: kg,
                    unit: '公斤',
                    passed: passed
                });
                console.log(`  ${test.quantity}斤 = ${kg}公斤 (預期: ${test.expectedKg}公斤) - ${passed ? '✅' : '❌'}`);
            }
            
            // 公斤轉斤
            if (test.unit === '公斤') {
                const jin = test.quantity / 0.6;
                const passed = Math.abs(jin - test.expectedJin) < 0.01;
                testResults.tests.push({
                    name: `單位換算 - ${test.quantity}公斤 → 斤`,
                    expected: test.expectedJin,
                    actual: jin,
                    unit: '斤',
                    passed: passed
                });
                console.log(`  ${test.quantity}公斤 = ${jin}斤 (預期: ${test.expectedJin}斤) - ${passed ? '✅' : '❌'}`);
            }
            
            // 台斤轉公斤
            if (test.unit === '台斤') {
                const kg = test.quantity * 0.6;
                const passed = Math.abs(kg - test.expectedKg) < 0.01;
                testResults.tests.push({
                    name: `單位換算 - ${test.quantity}台斤 → 公斤`,
                    expected: test.expectedKg,
                    actual: kg,
                    unit: '公斤',
                    passed: passed
                });
                console.log(`  ${test.quantity}台斤 = ${kg}公斤 (預期: ${test.expectedKg}公斤) - ${passed ? '✅' : '❌'}`);
            }
        }
        
        // 計算測試結果
        testResults.summary.total = testResults.tests.length;
        testResults.summary.passed = testResults.tests.filter(t => t.passed).length;
        testResults.summary.failed = testResults.summary.total - testResults.summary.passed;
        
        // 生成測試報告
        console.log('\n' + '='.repeat(60));
        console.log('📊 測試報告摘要');
        console.log('='.repeat(60));
        console.log(`總測試數: ${testResults.summary.total}`);
        console.log(`✅ 通過: ${testResults.summary.passed}`);
        console.log(`❌ 失敗: ${testResults.summary.failed}`);
        console.log(`成功率: ${((testResults.summary.passed / testResults.summary.total) * 100).toFixed(1)}%`);
        
        // 保存測試報告
        fs.writeFileSync('inventory_test_report.json', JSON.stringify(testResults, null, 2));
        console.log('\n📄 詳細測試報告已保存至 inventory_test_report.json');
        
    } catch (error) {
        console.error('❌ 測試過程中發生錯誤:', error);
        testResults.error = error.message;
    } finally {
        await browser.close();
        process.exit(testResults.summary.failed > 0 ? 1 : 0);
    }
}

// 執行測試
runTest().catch(console.error);