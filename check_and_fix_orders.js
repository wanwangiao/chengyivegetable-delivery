/**
 * 檢查並修復訂單狀態，確保外送員有訂單可接
 */

const axios = require('axios');

const BASE_URL = 'https://chengyivegetable-production-7b4a.up.railway.app';

console.log('🔍 檢查當前訂單狀態');
console.log('📅 執行時間:', new Date().toLocaleString('zh-TW'));

/**
 * 檢查訂單數量和狀態
 */
async function checkOrderStatus() {
    try {
        console.log('\n📊 檢查訂單數量API...');
        
        const response = await axios.get(`${BASE_URL}/api/driver/order-counts`);
        
        if (response.status === 200) {
            console.log('✅ 訂單數量API正常');
            console.log('📋 各地區訂單數量:');
            
            const counts = response.data.counts;
            let totalOrders = 0;
            
            for (const [area, count] of Object.entries(counts)) {
                console.log(`   ${area}: ${count}筆`);
                totalOrders += count;
            }
            
            console.log(`📊 可接訂單總數: ${totalOrders}筆`);
            
            if (totalOrders === 0) {
                console.log('\n⚠️ 沒有可接訂單 (status=packed且driver_id=NULL)');
                console.log('💡 可能原因:');
                console.log('1. 現有的11筆訂單狀態不是 "packed"');
                console.log('2. 現有的11筆訂單已經指派給其他外送員');
                console.log('3. 需要手動將一些訂單狀態改為 "packed"');
                
                return false;
            } else {
                console.log('✅ 有可接訂單，外送員系統正常');
                return true;
            }
            
        } else {
            console.log('❌ 訂單數量API失敗，狀態碼:', response.status);
            return false;
        }
        
    } catch (error) {
        console.error('❌ 檢查訂單狀態失敗:', error.message);
        return false;
    }
}

/**
 * 建議修復方案
 */
function suggestSolutions() {
    console.log('\n💡 修復建議:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    console.log('\n🔧 方案1: 手動修改訂單狀態');
    console.log('   在Railway資料庫中執行:');
    console.log('   UPDATE orders SET status = \'packed\', driver_id = NULL WHERE id IN (SELECT id FROM orders LIMIT 3);');
    
    console.log('\n🔧 方案2: 建立新的測試訂單');
    console.log('   使用 railway_database_repair.js 腳本');
    
    console.log('\n🔧 方案3: 檢查現有訂單狀態');
    console.log('   查詢: SELECT id, order_number, status, driver_id, address FROM orders;');
    
    console.log('\n📋 外送員期望看到的訂單條件:');
    console.log('   - status = \'packed\'');
    console.log('   - driver_id IS NULL (未指派給外送員)');
    console.log('   - address 包含區域資訊 (三峽、樹林、鶯歌、土城、北大)');
}

// 主執行函數
async function main() {
    console.log('🚀 開始檢查外送員訂單狀況...');
    
    const hasOrders = await checkOrderStatus();
    
    if (!hasOrders) {
        suggestSolutions();
        
        console.log('\n🎯 下一步行動:');
        console.log('1. 確認現有11筆訂單的實際狀態');
        console.log('2. 選擇適合的修復方案');
        console.log('3. 執行修復後重新測試外送員功能');
    } else {
        console.log('\n🎉 外送員系統訂單狀態正常！');
        console.log('👨‍🚚 外送員現在可以正常接單');
    }
}

// 檢查axios是否可用
try {
    require('axios');
    main();
} catch (error) {
    console.log('❌ 缺少axios套件，請先安裝: npm install axios');
    console.log('\n📋 或手動檢查:');
    console.log(`🔗 訪問: ${BASE_URL}/api/driver/order-counts`);
    console.log('🔑 查看返回的訂單數量是否大於0');
}