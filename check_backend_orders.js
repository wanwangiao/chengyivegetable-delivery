/**
 * 檢查後台訂單數據狀態
 * 確認是否為假資料以及狀態修改功能
 */

const axios = require('axios');

const BASE_URL = 'https://chengyivegetable-production-7b4a.up.railway.app';

console.log('🔍 檢查後台訂單數據狀態');
console.log('📅 執行時間:', new Date().toLocaleString('zh-TW'));

/**
 * 檢查後台訂單API
 */
async function checkBackendOrders() {
    try {
        console.log('\n📋 檢查後台訂單API...');
        
        // 嘗試不帶認證訪問訂單API
        const response = await axios.get(`${BASE_URL}/api/admin/orders`, {
            timeout: 10000,
            validateStatus: function (status) {
                return status < 500; // 允許401等認證錯誤
            }
        });
        
        if (response.status === 401) {
            console.log('⚠️ 後台API需要管理員認證（這是正常的安全機制）');
            console.log('💡 需要管理員登入才能查看真實訂單數據');
            return 'needs_auth';
        } else if (response.status === 200) {
            console.log('✅ 成功獲取訂單數據');
            
            if (response.data && response.data.orders) {
                const orders = response.data.orders;
                console.log(`📊 後台顯示訂單數: ${orders.length} 筆`);
                
                if (orders.length > 0) {
                    console.log('\n📋 前5筆訂單樣本:');
                    orders.slice(0, 5).forEach((order, index) => {
                        console.log(`${index + 1}. 訂單 #${order.order_number || order.id}`);
                        console.log(`   客戶: ${order.contact_name || order.customer_name || '未知'}`);
                        console.log(`   狀態: ${order.status}`);
                        console.log(`   總金額: ${order.total_amount || order.total || '未知'}`);
                        console.log(`   建立時間: ${order.created_at || '未知'}`);
                        console.log('   ─────────────');
                    });
                    
                    // 分析訂單來源
                    const testOrderPatterns = [
                        '王小明', '李小華', '張小美', '陳大明', 
                        '測試客戶', 'test', '示範', 'demo'
                    ];
                    
                    let fakeOrderCount = 0;
                    orders.forEach(order => {
                        const customerName = order.contact_name || order.customer_name || '';
                        const isTestOrder = testOrderPatterns.some(pattern => 
                            customerName.includes(pattern)
                        );
                        if (isTestOrder) {
                            fakeOrderCount++;
                        }
                    });
                    
                    console.log(`\n🎭 疑似測試/假訂單: ${fakeOrderCount} 筆`);
                    console.log(`📝 可能真實訂單: ${orders.length - fakeOrderCount} 筆`);
                    
                    if (fakeOrderCount === orders.length) {
                        console.log('⚠️ 所有訂單都疑似為假資料');
                        return 'all_fake';
                    } else if (fakeOrderCount > orders.length * 0.8) {
                        console.log('⚠️ 大部分訂單疑似為假資料');
                        return 'mostly_fake';
                    } else {
                        console.log('✅ 包含真實訂單數據');
                        return 'mixed_data';
                    }
                }
                
                return 'empty';
            }
        }
        
    } catch (error) {
        console.error('❌ 檢查後台訂單失敗:', error.message);
        
        if (error.response && error.response.status === 401) {
            console.log('💡 這是正常的，後台需要管理員認證才能訪問');
            return 'needs_auth';
        }
        
        return 'error';
    }
}

/**
 * 檢查示範模式設定
 */
async function checkDemoMode() {
    try {
        console.log('\n🎭 檢查是否為示範模式...');
        
        // 檢查前台是否有示範模式提示
        const frontendResponse = await axios.get(BASE_URL, { timeout: 10000 });
        const content = frontendResponse.data;
        
        if (content.includes('示範模式') || content.includes('demo') || content.includes('測試資料')) {
            console.log('⚠️ 系統可能處於示範模式');
            console.log('💡 示範模式通常會顯示假的測試數據');
            return true;
        } else {
            console.log('✅ 系統不在示範模式');
            return false;
        }
        
    } catch (error) {
        console.log('⚠️ 無法確認示範模式狀態');
        return null;
    }
}

/**
 * 測試狀態修改流程
 */
async function testStatusUpdateFlow() {
    console.log('\n🧪 測試後台 → 外送員狀態同步...');
    
    console.log('📋 完整流程應該是:');
    console.log('1. 客戶在前台下訂單 (status = "placed")');
    console.log('2. 管理員在後台確認 (status = "confirmed")');  
    console.log('3. 管理員備貨完成 (status = "packed")');
    console.log('4. 外送員能看到可接訂單');
    console.log('5. 外送員接單 (status = "assigned" 或 "out_for_delivery")');
    
    console.log('\n💡 問題分析:');
    console.log('如果您修改訂單狀態為 "packed" 但外送員看不到，可能原因:');
    console.log('1. 後台的訂單是假資料，不在真實資料庫中');
    console.log('2. 狀態修改沒有真正保存到資料庫');
    console.log('3. 訂單的 driver_id 不是 NULL');
    console.log('4. 訂單的地址不符合外送員系統的區域過濾');
}

/**
 * 提供解決方案
 */
function provideSolutions(backendStatus, demoMode) {
    console.log('\n💡 解決方案建議:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    if (backendStatus === 'needs_auth') {
        console.log('🔑 需要管理員登入後台查看真實數據');
        console.log('📋 步驟:');
        console.log('1. 登入管理員後台');
        console.log('2. 查看訂單列表，確認是否為真實客戶訂單');
        console.log('3. 嘗試修改一筆訂單狀態為 "packed"');
        console.log('4. 檢查外送員系統是否能看到該訂單');
    }
    
    if (backendStatus === 'all_fake' || backendStatus === 'mostly_fake') {
        console.log('🎭 如果後台都是假資料，建議:');
        console.log('1. 清除所有測試數據');
        console.log('2. 建立真實的測試訂單');
        console.log('3. 或者讓真實客戶在前台下訂單測試');
    }
    
    if (demoMode) {
        console.log('⚠️ 如果系統在示範模式:');
        console.log('1. 關閉示範模式設定');
        console.log('2. 確保使用真實的資料庫數據');
    }
    
    console.log('\n🔧 立即測試建議:');
    console.log('1. 在前台建立一筆真實測試訂單');
    console.log('2. 在後台將該訂單改為 "packed"');
    console.log('3. 檢查外送員是否能看到並接取');
}

// 主執行函數
async function main() {
    console.log('🚀 開始檢查後台訂單狀態...\n');
    
    const backendStatus = await checkBackendOrders();
    const demoMode = await checkDemoMode();
    
    testStatusUpdateFlow();
    provideSolutions(backendStatus, demoMode);
    
    console.log('\n📊 檢查總結:');
    console.log(`後台狀態: ${backendStatus}`);
    console.log(`示範模式: ${demoMode ? '可能是' : '不是'}`);
}

main();