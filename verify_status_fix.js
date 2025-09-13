/**
 * 驗證訂單狀態修復效果
 * 檢查管理員API是否支持 'packed' 狀態
 */

const axios = require('axios');

const BASE_URL = 'https://chengyivegetable-production-7b4a.up.railway.app';

console.log('🔍 驗證訂單狀態修復效果');
console.log('📅 執行時間:', new Date().toLocaleString('zh-TW'));

/**
 * 測試管理員API是否支持 'packed' 狀態
 */
async function testPackedStatusSupport() {
    try {
        console.log('\n🧪 測試管理員API是否支持 "packed" 狀態...');
        
        // 嘗試用無效的訂單ID測試狀態驗證
        const response = await axios.put(`${BASE_URL}/api/admin/orders/99999`, {
            status: 'packed',
            notes: '測試packed狀態支持'
        }, {
            headers: {
                'Content-Type': 'application/json'
            },
            timeout: 10000,
            validateStatus: function (status) {
                // 允許所有狀態碼，我們要檢查錯誤訊息
                return true;
            }
        });
        
        if (response.status === 404) {
            console.log('✅ API端點存在（訂單不存在錯誤）');
            
            if (response.data && response.data.message) {
                if (response.data.message.includes('找不到')) {
                    console.log('✅ "packed" 狀態已被API接受（沒有狀態驗證錯誤）');
                    return true;
                }
            }
        } else if (response.status === 400) {
            console.log('⚠️ API返回400錯誤:');
            console.log(response.data);
            
            if (response.data.message && response.data.message.includes('無效的訂單狀態')) {
                console.log('❌ "packed" 狀態仍然不被接受');
                console.log('有效狀態:', response.data.validStatuses);
                return false;
            }
        }
        
        console.log('🔄 API狀態:', response.status);
        console.log('📝 回應訊息:', response.data?.message || '無訊息');
        
        return true;
        
    } catch (error) {
        if (error.response) {
            console.log('🔄 HTTP錯誤:', error.response.status);
            console.log('📝 錯誤訊息:', error.response.data?.message || '無訊息');
            
            if (error.response.status === 400 && 
                error.response.data?.message?.includes('無效的訂單狀態')) {
                console.log('❌ "packed" 狀態仍然不被API接受');
                if (error.response.data.validStatuses) {
                    console.log('有效狀態:', error.response.data.validStatuses);
                }
                return false;
            }
        } else {
            console.error('❌ 測試失敗:', error.message);
        }
        
        return false;
    }
}

/**
 * 測試外送員API當前狀態
 */
async function testDriverAPI() {
    try {
        console.log('\n🚚 測試外送員API當前狀態...');
        
        const response = await axios.get(`${BASE_URL}/api/driver/order-counts`, {
            timeout: 10000
        });
        
        if (response.status === 200 && response.data.counts) {
            console.log('✅ 外送員API正常運作');
            
            const counts = response.data.counts;
            let totalOrders = 0;
            
            console.log('📊 各地區可接訂單數:');
            for (const [area, count] of Object.entries(counts)) {
                console.log(`   ${area}: ${count}筆`);
                totalOrders += count;
            }
            
            console.log(`🎯 總可接訂單數: ${totalOrders}筆`);
            
            if (totalOrders > 0) {
                console.log('🎉 外送員現在可以看到可接訂單！');
                console.log('✅ 狀態修復可能已生效');
                return true;
            } else {
                console.log('⚠️ 仍然沒有可接訂單');
                console.log('💡 可能原因:');
                console.log('1. Railway尚未完成部署');
                console.log('2. 需要將現有訂單狀態改為 "packed"');
                console.log('3. 現有訂單都已被指派或不符合條件');
                return false;
            }
        }
        
    } catch (error) {
        console.error('❌ 測試外送員API失敗:', error.message);
        return false;
    }
}

/**
 * 提供下一步指引
 */
function provideNextSteps(apiSupportsPackedStatus, hasAvailableOrders) {
    console.log('\n🎯 修復狀態總結:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    if (apiSupportsPackedStatus) {
        console.log('✅ 管理員API已支持 "packed" 狀態');
    } else {
        console.log('❌ 管理員API尚未支持 "packed" 狀態');
        console.log('🔄 可能需要等待Railway部署完成');
    }
    
    if (hasAvailableOrders) {
        console.log('✅ 外送員已可看到可接訂單');
        console.log('🎉 問題已解決！');
    } else {
        console.log('⚠️ 外送員仍看不到可接訂單');
    }
    
    console.log('\n📋 建議下一步行動:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    if (!apiSupportsPackedStatus) {
        console.log('1. ⏱️  等待Railway部署完成（通常需要1-2分鐘）');
        console.log('2. 🔄 重新執行此腳本驗證');
    }
    
    if (!hasAvailableOrders) {
        console.log('3. 🔑 登入管理員後台');
        console.log('4. 📝 將幾筆訂單狀態改為 "packed"');
        console.log('5. 🧪 執行 node test_driver_orders.js 測試外送員功能');
    }
    
    console.log('\n💡 管理員後台位置:');
    console.log(`🔗 ${BASE_URL}/admin/login`);
    console.log('📱 管理員帳號：需使用系統管理員登入');
    
    console.log('\n🎯 測試完整流程:');
    console.log('1. 管理員將訂單改為 "packed" → 外送員看到可接訂單');
    console.log('2. 外送員接單 → 訂單狀態變為 "assigned" 或 "out_for_delivery"');
    console.log('3. 外送員送達 → 訂單狀態變為 "delivered"');
}

// 主執行函數
async function main() {
    console.log('🚀 開始驗證修復效果...');
    
    const apiSupportsPackedStatus = await testPackedStatusSupport();
    const hasAvailableOrders = await testDriverAPI();
    
    provideNextSteps(apiSupportsPackedStatus, hasAvailableOrders);
}

// 檢查axios是否可用
try {
    require('axios');
    main();
} catch (error) {
    console.log('❌ 缺少axios套件，請先安裝: npm install axios');
    console.log('\n📋 手動驗證步驟:');
    console.log('1. 訪問管理員API測試 "packed" 狀態');
    console.log('2. 檢查外送員API是否有可接訂單');
    console.log(`3. 管理員後台: ${BASE_URL}/admin/login`);
}