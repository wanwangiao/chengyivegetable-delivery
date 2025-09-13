/**
 * 檢查系統示範模式狀態
 */

const axios = require('axios');

const BASE_URL = 'https://chengyivegetable-production-7b4a.up.railway.app';

console.log('🎭 檢查系統示範模式狀態');
console.log('📅 執行時間:', new Date().toLocaleString('zh-TW'));

async function checkDemoModeStatus() {
    try {
        console.log('\n🔍 檢查系統狀態...');
        
        // 檢查後台API是否在示範模式
        const adminResponse = await axios.get(`${BASE_URL}/api/admin/orders`, {
            timeout: 10000,
            validateStatus: (status) => status < 500
        });
        
        console.log(`📊 後台API狀態碼: ${adminResponse.status}`);
        
        if (adminResponse.status === 200) {
            const data = adminResponse.data;
            
            // 檢查回應是否包含示範模式標記
            if (data.mode === 'demo') {
                console.log('⚠️ 後台確實在示範模式');
            } else if (data.orders && data.orders.length > 0) {
                console.log(`📋 後台返回 ${data.orders.length} 筆訂單`);
                
                // 檢查訂單內容
                const sampleOrder = data.orders[0];
                console.log('📝 第一筆訂單樣本:');
                console.log(`   ID: ${sampleOrder.id}`);
                console.log(`   客戶: ${sampleOrder.contact_name || sampleOrder.customer_name || '未知'}`);
                console.log(`   狀態: ${sampleOrder.status}`);
                console.log(`   總額: ${sampleOrder.total_amount || sampleOrder.total || '未知'}`);
                
                // 判斷是否為假資料
                const fakeDataIndicators = [
                    '王小明', '李小華', '張小美', '陳大明',
                    '測試客戶', 'test', 'demo', '示範'
                ];
                
                const customerName = sampleOrder.contact_name || sampleOrder.customer_name || '';
                const isFakeData = fakeDataIndicators.some(indicator => 
                    customerName.includes(indicator)
                );
                
                if (isFakeData) {
                    console.log('🎭 確認：這是示範/假資料');
                    return 'demo_data';
                } else {
                    console.log('✅ 可能是真實資料');
                    return 'real_data';
                }
            } else {
                console.log('📭 後台沒有訂單');
                return 'no_orders';
            }
        } else if (adminResponse.status === 401) {
            console.log('🔐 後台需要認證（正常安全機制）');
            return 'needs_auth';
        }
        
    } catch (error) {
        console.error('❌ 檢查失敗:', error.message);
        return 'error';
    }
}

async function checkDatabaseConnection() {
    try {
        console.log('\n🗄️ 檢查資料庫連線狀態...');
        
        // 嘗試一個簡單的查詢來判斷資料庫是否連線
        const driverResponse = await axios.get(`${BASE_URL}/api/driver/order-counts`);
        
        if (driverResponse.status === 200) {
            console.log('✅ 資料庫查詢成功（外送員API正常）');
            console.log('💡 這表示資料庫連線應該是正常的');
            return true;
        }
        
    } catch (error) {
        console.log('❌ 資料庫查詢失敗:', error.message);
        return false;
    }
}

function provideSolution(demoStatus, dbConnected) {
    console.log('\n💡 解決方案:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    if (demoStatus === 'demo_data') {
        console.log('🎭 系統確實在示範模式，需要切換到真實模式');
        console.log('');
        console.log('🔧 方法1: 檢查資料庫連線');
        console.log('   - Railway資料庫環境變數可能沒有正確設定');
        console.log('   - 需要確保 DATABASE_URL 環境變數正確');
        console.log('');
        console.log('🔧 方法2: 手動關閉示範模式');
        console.log('   - 在server.js中將 demoMode 改為 false');
        console.log('   - 重新部署系統');
        console.log('');
        console.log('🔧 方法3: 建立真實測試訂單');
        console.log('   - 在前台實際下一筆訂單');
        console.log('   - 確認該訂單出現在後台');
        console.log('   - 將訂單狀態改為 "packed"');
        console.log('   - 測試外送員是否能接到');
    }
    
    console.log('\n🎯 建議立即行動:');
    console.log('1. 手動將 demoMode 設為 false');
    console.log('2. 在前台建立一筆真實測試訂單');
    console.log('3. 在後台確認看到真實訂單');
    console.log('4. 修改狀態為 "packed" 測試外送員功能');
}

async function main() {
    const demoStatus = await checkDemoModeStatus();
    const dbConnected = await checkDatabaseConnection();
    
    console.log('\n📊 檢查結果:');
    console.log(`示範模式狀態: ${demoStatus}`);
    console.log(`資料庫連線: ${dbConnected ? '正常' : '異常'}`);
    
    provideSolution(demoStatus, dbConnected);
}

main();