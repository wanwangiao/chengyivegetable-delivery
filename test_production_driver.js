const axios = require('axios');

const BASE_URL = 'https://chengyivegetable.vercel.app';

async function testDriverInterface() {
    console.log('🔍 測試外送員介面功能...\n');
    
    try {
        // 1. 測試登入頁面
        console.log('1️⃣ 測試登入頁面...');
        const loginPageResponse = await axios.get(`${BASE_URL}/driver`);
        
        if (loginPageResponse.data.includes('driver-login') || 
            loginPageResponse.data.includes('登入')) {
            console.log('✅ 登入頁面正常顯示');
        } else if (loginPageResponse.data.includes('getPaymentMethodDisplay')) {
            console.log('✅ 已經是登入狀態，顯示主介面');
            console.log('✅ 找到 getPaymentMethodDisplay 函數');
        }
        
        // 2. 檢查是否有新功能
        const hasPaymentFunction = loginPageResponse.data.includes('getPaymentMethodDisplay');
        const hasCheckbox = loginPageResponse.data.includes('order-checkbox');
        const hasSelectCheckbox = loginPageResponse.data.includes('order-select-checkbox');
        
        console.log('\n2️⃣ 功能檢查：');
        console.log(`   付款方式顯示函數: ${hasPaymentFunction ? '✅ 有' : '❌ 無'}`);
        console.log(`   訂單勾選框樣式: ${hasCheckbox ? '✅ 有' : '❌ 無'}`);
        console.log(`   勾選框元素: ${hasSelectCheckbox ? '✅ 有' : '❌ 無'}`);
        
        // 3. 測試API端點
        console.log('\n3️⃣ 測試API端點...');
        try {
            const apiResponse = await axios.get(`${BASE_URL}/api/driver/area-orders/三峽區`);
            if (apiResponse.data.success) {
                const order = apiResponse.data.orders[0];
                if (order) {
                    console.log('✅ API返回訂單資料：');
                    console.log(`   - payment_method: ${order.payment_method || '未設定'}`);
                    console.log(`   - total_amount: ${order.total_amount || '未設定'}`);
                }
            }
        } catch (apiError) {
            console.log('⚠️ API需要登入驗證');
        }
        
        console.log('\n📊 測試總結：');
        if (hasPaymentFunction && hasCheckbox) {
            console.log('✅ 新功能已成功部署！');
        } else {
            console.log('⚠️ 部分功能可能尚未更新，請檢查：');
            console.log('   1. 清除瀏覽器快取');
            console.log('   2. 使用無痕模式');
            console.log('   3. 等待CDN更新（1-2分鐘）');
        }
        
    } catch (error) {
        console.error('❌ 測試失敗:', error.message);
    }
}

// 執行測試
testDriverInterface();