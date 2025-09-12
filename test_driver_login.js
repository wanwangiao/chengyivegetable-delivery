const puppeteer = require('puppeteer');

async function testDriverLogin() {
    console.log('🧪 开始测试外送员登录功能...\n');
    
    const browser = await puppeteer.launch({ 
        headless: false,
        slowMo: 1000,
        defaultViewport: { width: 1200, height: 800 }
    });
    
    try {
        const page = await browser.newPage();
        
        // 1. 访问登录页面
        console.log('1. 访问登录页面...');
        await page.goto('https://chengyivegetable-production-7b4a.up.railway.app/driver/login');
        await page.waitForSelector('input[name="phone"]', { timeout: 10000 });
        console.log('✅ 登录页面加载成功');
        
        // 2. 填写测试账号信息
        console.log('\n2. 填写登录信息...');
        await page.type('input[name="phone"]', '0912345678');
        await page.type('input[name="password"]', 'driver123');
        console.log('✅ 账号密码填写完成');
        
        // 3. 点击登录按钮
        console.log('\n3. 点击登录按钮...');
        await page.click('button[type="submit"]');
        
        // 4. 等待重定向并检查结果
        console.log('\n4. 等待登录结果...');
        await page.waitForNavigation({ timeout: 15000 });
        
        const currentUrl = page.url();
        console.log(`当前URL: ${currentUrl}`);
        
        if (currentUrl.includes('/driver') && !currentUrl.includes('/login')) {
            console.log('✅ 登录成功！已重定向到外送员界面');
            
            // 5. 检查订单勾选功能
            console.log('\n5. 检查订单列表...');
            await page.waitForSelector('.order-item, .available-order, [data-order-id]', { timeout: 10000 });
            
            const orders = await page.$$eval('.order-item, .available-order, [data-order-id]', elements => {
                return elements.map(el => ({
                    text: el.textContent.trim(),
                    hasCheckbox: !!el.querySelector('input[type="checkbox"], .order-checkbox'),
                    orderId: el.getAttribute('data-order-id') || el.id
                }));
            });
            
            console.log(`找到 ${orders.length} 个订单：`);
            orders.forEach((order, index) => {
                console.log(`  订单 ${index + 1}: ${order.hasCheckbox ? '✅' : '❌'} 有勾选框 - ${order.text.substring(0, 50)}...`);
            });
            
            // 6. 尝试勾选订单
            if (orders.length > 0 && orders[0].hasCheckbox) {
                console.log('\n6. 尝试勾选第一个订单...');
                const checkbox = await page.$('.order-item input[type="checkbox"], .available-order input[type="checkbox"], [data-order-id] input[type="checkbox"]');
                if (checkbox) {
                    await checkbox.click();
                    console.log('✅ 成功勾选订单');
                    
                    // 7. 检查"我的订单"栏
                    console.log('\n7. 检查我的订单栏...');
                    await page.waitForTimeout(2000);
                    
                    const myOrdersSection = await page.$('.my-orders, #my-orders, .selected-orders');
                    if (myOrdersSection) {
                        const myOrdersCount = await page.$$eval('.my-orders .order-item, #my-orders .order-item, .selected-orders .order-item', elements => elements.length);
                        console.log(`✅ 我的订单栏显示 ${myOrdersCount} 个订单`);
                    } else {
                        console.log('❌ 未找到"我的订单"栏');
                    }
                } else {
                    console.log('❌ 未找到可点击的勾选框');
                }
            } else {
                console.log('❌ 没有可勾选的订单');
            }
            
        } else if (currentUrl.includes('/login')) {
            console.log('❌ 登录失败，仍在登录页面');
            
            const errorMessage = await page.$eval('.error, .alert-danger', el => el.textContent.trim()).catch(() => '未找到错误信息');
            console.log(`错误信息: ${errorMessage}`);
        } else {
            console.log(`⚠️  重定向到意外的页面: ${currentUrl}`);
        }
        
        // 等待5秒让用户观察
        console.log('\n⏳ 等待5秒让您观察结果...');
        await page.waitForTimeout(5000);
        
    } catch (error) {
        console.error('❌ 测试过程出错:', error.message);
    } finally {
        await browser.close();
    }
}

// 执行测试
testDriverLogin().catch(console.error);