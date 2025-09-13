/**
 * 測試線上系統實際的demoMode狀態
 */

const axios = require('axios');

const BASE_URL = 'https://chengyivegetable-production-7b4a.up.railway.app';

async function testDemoModeStatus() {
    console.log('🔍 測試線上系統demoMode實際狀態...');
    console.log('📅 執行時間:', new Date().toLocaleString('zh-TW'));
    
    try {
        // 測試一個受demoMode影響的路由
        console.log('\n📊 測試 /api/admin/orders...');
        const response = await axios.get(`${BASE_URL}/api/admin/orders`, {
            timeout: 10000,
            validateStatus: (status) => status < 500
        });
        
        if (response.status === 200) {
            console.log('✅ API回應成功');
            
            if (response.data && response.data.orders) {
                console.log(`📋 返回訂單數: ${response.data.orders.length} 筆`);
                
                if (response.data.orders.length > 0) {
                    console.log('\n📝 訂單樣本:');
                    response.data.orders.slice(0, 3).forEach((order, index) => {
                        console.log(`${index + 1}. ID: ${order.id}`);
                        console.log(`   客戶: ${order.contact_name}`);
                        console.log(`   狀態: ${order.status}`);
                        console.log('   ─────────────');
                    });
                    
                    // 檢查是否為示範數據
                    if (response.data.orders.some(order => order.contact_name === '示範客戶')) {
                        console.log('❌ 發現示範模式數據！demoMode可能仍為true');
                        return 'demo_mode_active';
                    } else {
                        console.log('✅ 看起來是真實數據');
                        return 'real_data';
                    }
                } else {
                    console.log('📭 返回0筆訂單（正確）');
                    return 'empty';
                }
            }
        } else if (response.status === 401) {
            console.log('🔐 需要管理員認證');
            return 'needs_auth';
        }
        
    } catch (error) {
        console.log('❌ 測試失敗:', error.message);
        return 'error';
    }
}

async function testAdminPageDirectly() {
    console.log('\n🌐 測試後台頁面直接訪問...');
    
    try {
        const response = await axios.get(`${BASE_URL}/admin/orders`, {
            timeout: 10000,
            maxRedirects: 0,
            validateStatus: (status) => status < 400
        });
        
        if (response.status === 302) {
            console.log('✅ 正確重定向到登入頁面');
        }
        
    } catch (error) {
        if (error.response && error.response.status === 302) {
            console.log('✅ 正確重定向到登入頁面');
        } else {
            console.log('❌ 測試失敗:', error.message);
        }
    }
}

async function main() {
    const result = await testDemoModeStatus();
    await testAdminPageDirectly();
    
    console.log('\n🎯 結論:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    if (result === 'demo_mode_active') {
        console.log('❌ demoMode仍在運行中');
        console.log('💡 可能原因: Railway部署沒有重啟或代碼沒有生效');
    } else if (result === 'empty') {
        console.log('✅ demoMode已關閉，系統正常');
        console.log('💡 您看到的訂單可能是瀏覽器緩存問題');
    } else if (result === 'needs_auth') {
        console.log('🔐 無法直接測試，需要登入');
        console.log('💡 建議檢查Railway部署狀態');
    }
}

main();