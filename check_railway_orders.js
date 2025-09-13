/**
 * 檢查Railway資料庫中訂單的實際狀態
 * 分析為什麼外送員看不到可接訂單
 */

const axios = require('axios');

const BASE_URL = 'https://chengyivegetable-production-7b4a.up.railway.app';

console.log('🔍 檢查Railway資料庫訂單狀態');
console.log('📅 執行時間:', new Date().toLocaleString('zh-TW'));

/**
 * 檢查所有訂單的詳細狀態
 */
async function checkAllOrders() {
    try {
        console.log('\n📋 檢查所有訂單狀態...');
        
        // 創建一個簡單的API測試來獲取訂單資訊
        const response = await axios.get(`${BASE_URL}/api/admin/orders`, {
            timeout: 10000
        });
        
        if (response.status === 200 && response.data) {
            console.log('✅ 成功獲取訂單數據');
            
            const orders = response.data.orders || response.data;
            console.log(`📊 總訂單數: ${orders.length}`);
            
            // 分析訂單狀態分布
            const statusCount = {};
            const driverCount = {};
            
            orders.forEach(order => {
                // 統計狀態
                statusCount[order.status] = (statusCount[order.status] || 0) + 1;
                
                // 統計外送員指派情況
                if (order.driver_id) {
                    driverCount['已指派'] = (driverCount['已指派'] || 0) + 1;
                } else {
                    driverCount['未指派'] = (driverCount['未指派'] || 0) + 1;
                }
            });
            
            console.log('\n📈 訂單狀態分布:');
            Object.entries(statusCount).forEach(([status, count]) => {
                console.log(`   ${status}: ${count}筆`);
            });
            
            console.log('\n👨‍🚚 外送員指派情況:');
            Object.entries(driverCount).forEach(([type, count]) => {
                console.log(`   ${type}: ${count}筆`);
            });
            
            // 檢查可接訂單條件
            const availableOrders = orders.filter(order => 
                order.status === 'packed' && !order.driver_id
            );
            
            console.log(`\n🎯 可接訂單數 (status='packed' AND driver_id=NULL): ${availableOrders.length}筆`);
            
            if (availableOrders.length > 0) {
                console.log('✅ 有可接訂單:');
                availableOrders.forEach(order => {
                    console.log(`   - 訂單 #${order.order_number}: ${order.address || '未知地址'}`);
                });
            } else {
                console.log('⚠️ 沒有可接訂單');
                
                // 分析原因
                const packedOrders = orders.filter(order => order.status === 'packed');
                const unassignedOrders = orders.filter(order => !order.driver_id);
                
                console.log('\n🔍 問題分析:');
                console.log(`   - status='packed'的訂單: ${packedOrders.length}筆`);
                console.log(`   - driver_id=NULL的訂單: ${unassignedOrders.length}筆`);
                
                if (packedOrders.length === 0) {
                    console.log('❌ 核心問題: 沒有訂單的狀態是 "packed"');
                    console.log('💡 需要檢查訂單狀態轉換流程');
                }
                
                if (unassignedOrders.length === 0) {
                    console.log('❌ 所有訂單都已指派給外送員');
                }
            }
            
            // 顯示前5筆訂單詳情作為樣本
            console.log('\n📋 前5筆訂單詳情:');
            orders.slice(0, 5).forEach((order, index) => {
                console.log(`${index + 1}. 訂單 #${order.order_number || order.id}`);
                console.log(`   狀態: ${order.status}`);
                console.log(`   外送員: ${order.driver_id || '未指派'}`);
                console.log(`   地址: ${order.address || '未知'}`);
                console.log(`   建立時間: ${order.created_at || '未知'}`);
                console.log('   ───────────────────');
            });
            
        } else {
            console.log('❌ 無法獲取訂單數據');
            return false;
        }
        
    } catch (error) {
        console.error('❌ 檢查訂單失敗:', error.message);
        
        if (error.response) {
            console.log(`HTTP狀態: ${error.response.status}`);
            console.log(`錯誤訊息: ${error.response.data?.message || '未知錯誤'}`);
        }
        
        return false;
    }
}

/**
 * 建議修復方案
 */
function suggestOrderFlowFix() {
    console.log('\n💡 訂單流程修復建議:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    console.log('\n🔧 方案1: 手動修改現有訂單狀態');
    console.log('   將一些訂單狀態改為 "packed" 供外送員接單測試');
    console.log('   SQL: UPDATE orders SET status = \'packed\', driver_id = NULL WHERE id IN (1,2,3);');
    
    console.log('\n🔧 方案2: 檢查訂單狀態轉換API');
    console.log('   確認管理員有將訂單標記為 "packed" 的功能');
    console.log('   檢查 /api/admin/orders/:id/status 端點');
    
    console.log('\n🔧 方案3: 建立完整訂單流程');
    console.log('   1. 客戶下單 → status = "pending"');
    console.log('   2. 商家確認 → status = "confirmed"');
    console.log('   3. 商家備貨完成 → status = "packed"');
    console.log('   4. 外送員接單 → status = "assigned", driver_id = 外送員ID');
    console.log('   5. 外送員送達 → status = "delivered"');
    
    console.log('\n🎯 立即行動:');
    console.log('1. 檢查是否有管理員介面可以修改訂單狀態');
    console.log('2. 或直接在資料庫修改幾筆訂單為 "packed" 狀態');
    console.log('3. 測試外送員是否能看到並接單');
}

// 主執行函數
async function main() {
    console.log('🚀 開始檢查Railway訂單狀態...');
    
    const success = await checkAllOrders();
    
    if (!success) {
        console.log('\n⚠️ 無法直接從API獲取訂單詳情');
        console.log('💡 可能需要:');
        console.log('1. 檢查是否有現成的管理員API');
        console.log('2. 或直接連接資料庫查詢');
        console.log('3. 查看server.js中的訂單管理路由');
    }
    
    suggestOrderFlowFix();
    
    console.log('\n📋 總結:');
    console.log('外送員API修復完成，但訂單狀態流程需要檢查');
    console.log('核心問題: 現有訂單狀態可能不是 "packed"');
    console.log('解決方案: 確保有訂單能達到 "packed" 狀態供外送員接單');
}

// 檢查axios是否可用
try {
    require('axios');
    main();
} catch (error) {
    console.log('❌ 缺少axios套件，請先安裝: npm install axios');
    suggestOrderFlowFix();
}