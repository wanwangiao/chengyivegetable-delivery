/**
 * 測試訂單狀態更新
 */

const axios = require('axios');

const BASE_URL = 'https://chengyivegetable-production-7b4a.up.railway.app';

async function updateOrderStatus(orderId, status) {
    try {
        console.log(`🔄 更新訂單 ${orderId} 狀態為 ${status}...`);
        
        const response = await axios.put(`${BASE_URL}/api/admin/orders/${orderId}`, {
            status: status,
            notes: '測試狀態更新'
        }, {
            headers: {
                'Content-Type': 'application/json',
                // 這裡需要添加管理員認證
                'Cookie': 'admin_session=...' // 需要實際的管理員session
            }
        });
        
        if (response.status === 200) {
            console.log(`✅ 訂單 ${orderId} 狀態已更新為 ${status}`);
            return true;
        }
        
    } catch (error) {
        console.error(`❌ 更新訂單 ${orderId} 失敗:`, error.message);
        return false;
    }
}

async function testDriverAPI() {
    try {
        console.log('\n🧪 測試外送員API...');
        
        const response = await axios.get(`${BASE_URL}/api/driver/order-counts`);
        
        if (response.status === 200) {
            console.log('✅ 外送員API正常');
            console.log('📊 可接訂單數:', response.data.counts);
            
            const totalOrders = Object.values(response.data.counts).reduce((sum, count) => sum + count, 0);
            console.log(`🎯 總可接訂單: ${totalOrders}筆`);
            
            if (totalOrders > 0) {
                console.log('🎉 外送員現在可以看到可接訂單了！');
            } else {
                console.log('⚠️ 仍然沒有可接訂單，請檢查訂單狀態');
            }
        }
        
    } catch (error) {
        console.error('❌ 測試外送員API失敗:', error.message);
    }
}

async function main() {
    console.log('🧪 測試訂單狀態修復...');
    
    // 這裡需要實際的訂單ID，可以從資料庫查詢前幾筆
    // const testOrderIds = [1, 2, 3]; 
    
    console.log('\n💡 手動測試步驟:');
    console.log('1. 登入管理員後台');
    console.log('2. 找到幾筆訂單');
    console.log('3. 將狀態改為 "packed"');
    console.log('4. 執行 node test_driver_orders.js 確認外送員能看到');
    
    await testDriverAPI();
}

main();
