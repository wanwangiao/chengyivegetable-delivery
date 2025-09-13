/**
 * 檢查管理員後台訂單的數據來源
 */

const axios = require('axios');

const BASE_URL = 'https://chengyivegetable-production-7b4a.up.railway.app';

console.log('🔍 檢查管理員後台訂單數據來源');
console.log('📅 執行時間:', new Date().toLocaleString('zh-TW'));

/**
 * 測試後台頁面訂單渲染
 */
async function checkAdminOrdersPage() {
    try {
        console.log('\n🔐 測試後台訂單頁面...');
        
        // 先訪問登入頁面
        const loginPageResponse = await axios.get(`${BASE_URL}/admin/login`, {
            timeout: 10000
        });
        
        if (loginPageResponse.status === 200) {
            console.log('✅ 管理員登入頁面正常');
        }
        
        // 嘗試直接訪問訂單頁面（應該重定向到登入）
        const ordersPageResponse = await axios.get(`${BASE_URL}/admin/orders`, {
            timeout: 10000,
            maxRedirects: 0,
            validateStatus: (status) => status < 400
        });
        
        if (ordersPageResponse.status === 302) {
            console.log('✅ 訂單頁面需要認證（正常安全機制）');
            console.log('🔗 重定向到:', ordersPageResponse.headers.location);
        }
        
    } catch (error) {
        if (error.response && error.response.status === 302) {
            console.log('✅ 訂單頁面需要認證（正常安全機制）');
        } else {
            console.log('❌ 測試後台頁面失敗:', error.message);
        }
    }
}

/**
 * 檢查API端點的返回數據
 */
async function checkAdminOrdersAPI() {
    try {
        console.log('\n📊 測試管理員訂單API...');
        
        const response = await axios.get(`${BASE_URL}/api/admin/orders`, {
            timeout: 10000,
            validateStatus: (status) => status < 500
        });
        
        if (response.status === 200) {
            console.log('✅ API返回成功');
            
            if (response.data) {
                let orders = [];
                
                if (Array.isArray(response.data)) {
                    orders = response.data;
                } else if (response.data.orders) {
                    orders = response.data.orders;
                } else if (response.data.data) {
                    orders = response.data.data;
                }
                
                console.log(`📋 API返回訂單數: ${orders.length} 筆`);
                
                if (orders.length > 0) {
                    console.log('\n📝 前3筆訂單樣本:');
                    orders.slice(0, 3).forEach((order, index) => {
                        console.log(`${index + 1}. ID: ${order.id}`);
                        console.log(`   客戶: ${order.contact_name || order.customer_name || '未知'}`);
                        console.log(`   電話: ${order.contact_phone || order.customer_phone || '未知'}`);
                        console.log(`   狀態: ${order.status}`);
                        console.log('   ─────────────');
                    });
                    
                    // 檢查是否為示範模式數據
                    const demoIndicators = ['示範', 'demo', '測試'];
                    const hasDemoData = orders.some(order => {
                        const name = order.contact_name || order.customer_name || '';
                        return demoIndicators.some(indicator => name.includes(indicator));
                    });
                    
                    if (hasDemoData) {
                        console.log('⚠️ 發現示範模式數據！');
                        console.log('💡 這表示demoMode可能沒有完全關閉');
                        return 'demo_data';
                    } else {
                        console.log('✅ 看起來是真實數據');
                        return 'real_data';
                    }
                } else {
                    console.log('📭 API返回0筆訂單（正確狀態）');
                    return 'empty';
                }
            }
            
        } else if (response.status === 401) {
            console.log('🔐 API需要管理員認證');
            return 'needs_auth';
        }
        
    } catch (error) {
        console.log('❌ API測試失敗:', error.message);
        return 'error';
    }
}

/**
 * 檢查系統當前的demo模式狀態
 */
async function checkDemoModeStatus() {
    try {
        console.log('\n🎭 檢查系統demo模式狀態...');
        
        // 嘗試多個API端點來判斷demo模式
        const endpoints = [
            '/api/admin/orders',
            '/api/driver/order-counts'  
        ];
        
        for (const endpoint of endpoints) {
            try {
                const response = await axios.get(`${BASE_URL}${endpoint}`, {
                    timeout: 5000,
                    validateStatus: (status) => status < 500
                });
                
                console.log(`${endpoint}: ${response.status}`);
                
                if (response.data && response.data.mode) {
                    console.log(`   模式: ${response.data.mode}`);
                }
            } catch (err) {
                console.log(`${endpoint}: 錯誤 (${err.message})`);
            }
        }
        
    } catch (error) {
        console.log('❌ 檢查demo模式失敗:', error.message);
    }
}

function provideDiagnosis(apiResult) {
    console.log('\n🎯 診斷結果:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    if (apiResult === 'demo_data') {
        console.log('❌ 問題確認：後台仍有示範模式數據');
        console.log('');
        console.log('🔧 可能原因:');
        console.log('1. demoMode設定沒有生效');
        console.log('2. 資料庫中確實有這些測試訂單');  
        console.log('3. 其他路由還在返回假數據');
        console.log('');
        console.log('💡 解決方案:');
        console.log('1. 確認demoMode確實為false');
        console.log('2. 清理資料庫中的測試訂單');
        console.log('3. 檢查其他可能的mock數據來源');
    } else if (apiResult === 'empty') {
        console.log('✅ API返回正確：0筆訂單');
        console.log('💡 但您在瀏覽器看到訂單，可能原因:');
        console.log('1. 瀏覽器緩存問題');
        console.log('2. 不同的API端點返回不同數據');
        console.log('3. 前端JavaScript顯示假數據');
    } else if (apiResult === 'needs_auth') {
        console.log('🔐 API需要認證，無法直接檢查');
        console.log('💡 建議用管理員帳號登入後台查看實際狀況');
    }
}

async function main() {
    await checkAdminOrdersPage();
    const apiResult = await checkAdminOrdersAPI();
    await checkDemoModeStatus();
    provideDiagnosis(apiResult);
}

main();