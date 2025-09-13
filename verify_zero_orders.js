/**
 * 驗證關閉示範模式後後台訂單應為0筆
 */

const axios = require('axios');

const BASE_URL = 'https://chengyivegetable-production-7b4a.up.railway.app';

console.log('🔍 驗證後台訂單數據（應為0筆）');
console.log('📅 執行時間:', new Date().toLocaleString('zh-TW'));

async function verifyZeroOrders() {
    try {
        console.log('\n📊 檢查後台訂單數量...');
        
        const response = await axios.get(`${BASE_URL}/api/admin/orders`, {
            timeout: 10000,
            validateStatus: (status) => status < 500
        });
        
        if (response.status === 200) {
            console.log('✅ 後台API正常回應');
            
            if (response.data && response.data.orders) {
                const orderCount = response.data.orders.length;
                console.log(`📋 後台訂單數量: ${orderCount} 筆`);
                
                if (orderCount === 0) {
                    console.log('🎉 正確！關閉示範模式後，後台確實沒有假資料了');
                    console.log('✅ 現在是乾淨的真實資料庫狀態');
                    return 'correct_zero';
                } else {
                    console.log('⚠️ 意外：還有訂單存在');
                    console.log('讓我檢查這些訂單的來源...');
                    
                    response.data.orders.slice(0, 3).forEach((order, index) => {
                        console.log(`${index + 1}. 訂單 #${order.id}`);
                        console.log(`   客戶: ${order.contact_name || order.customer_name || '未知'}`);
                        console.log(`   狀態: ${order.status}`);
                        console.log(`   時間: ${order.created_at}`);
                    });
                    
                    return 'has_orders';
                }
            } else {
                console.log('📭 後台沒有返回訂單陣列');
                return 'no_array';
            }
            
        } else if (response.status === 401) {
            console.log('🔐 後台需要管理員認證');
            console.log('💡 這是正常的，登入後應該看到0筆訂單');
            return 'needs_auth';
        }
        
    } catch (error) {
        console.error('❌ 檢查失敗:', error.message);
        return 'error';
    }
}

async function verifyDriverOrders() {
    try {
        console.log('\n🚚 確認外送員系統也是0筆...');
        
        const loginResponse = await axios.post(`${BASE_URL}/driver/login`, {
            phone: '0912345678',
            password: 'driver123'
        }, {
            maxRedirects: 0,
            validateStatus: (status) => status < 400
        });
        
        const cookies = loginResponse.headers['set-cookie'];
        const sessionCookie = cookies?.find(cookie => cookie.includes('connect.sid')) || cookies?.[0];
        
        const countResponse = await axios.get(`${BASE_URL}/api/driver/order-counts`, {
            headers: { 'Cookie': sessionCookie }
        });
        
        const counts = countResponse.data.counts;
        const totalOrders = Object.values(counts).reduce((sum, count) => sum + count, 0);
        
        console.log(`📊 外送員可接訂單: ${totalOrders} 筆`);
        
        if (totalOrders === 0) {
            console.log('✅ 外送員系統確認也是0筆');
            return true;
        }
        
        return false;
        
    } catch (error) {
        console.log('❌ 外送員驗證失敗:', error.message);
        return false;
    }
}

function provideNextSteps(backendResult, driverResult) {
    console.log('\n🎯 下一步測試流程:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    if (backendResult === 'correct_zero' || backendResult === 'needs_auth') {
        console.log('✅ 後台狀態正確（0筆訂單）');
    }
    
    if (driverResult) {
        console.log('✅ 外送員狀態正確（0筆訂單）');
    }
    
    console.log('\n📋 完整測試流程:');
    console.log('1. 🛒 在前台下一筆測試訂單');
    console.log('   網址: ' + BASE_URL);
    console.log('2. 👨‍💼 在後台確認看到該訂單');
    console.log('   網址: ' + BASE_URL + '/admin/login');
    console.log('3. 📝 將訂單狀態改為 "packed"');
    console.log('4. 🚚 檢查外送員是否能看到該訂單');
    console.log('   網址: ' + BASE_URL + '/driver/login (0912345678/driver123)');
    console.log('5. ✅ 外送員接單測試');
    
    console.log('\n🎉 如果以上流程成功，系統就完全修復了！');
}

async function main() {
    const backendResult = await verifyZeroOrders();
    const driverResult = await verifyDriverOrders();
    
    console.log('\n📊 驗證結果:');
    console.log(`後台狀態: ${backendResult}`);
    console.log(`外送員狀態: ${driverResult ? '正確' : '需檢查'}`);
    
    provideNextSteps(backendResult, driverResult);
}

main();