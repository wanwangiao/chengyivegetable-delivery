/**
 * 外送員API端點測試腳本
 * 直接測試所有API端點是否正常運作
 * 2025-09-02 - 診斷訂單載入卡住問題
 */

const https = require('https');
const http = require('http');

const BASE_URL = 'https://chengyivegetable.vercel.app';

// 測試用的HTTP請求函數
function makeRequest(url, options = {}) {
    return new Promise((resolve, reject) => {
        const protocol = url.startsWith('https') ? https : http;
        
        const req = protocol.request(url, options, (res) => {
            let data = '';
            
            res.on('data', chunk => {
                data += chunk;
            });
            
            res.on('end', () => {
                try {
                    const result = {
                        statusCode: res.statusCode,
                        statusMessage: res.statusMessage,
                        headers: res.headers,
                        data: data
                    };
                    
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        try {
                            result.json = JSON.parse(data);
                        } catch (e) {
                            // 不是JSON回應
                        }
                        resolve(result);
                    } else {
                        reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
                    }
                } catch (error) {
                    reject(error);
                }
            });
        });
        
        req.on('error', reject);
        
        if (options.method === 'POST' && options.body) {
            req.write(options.body);
        }
        
        req.end();
    });
}

// 測試函數集合
async function testAPI() {
    console.log('🔍 === 外送員API端點測試開始 ===\n');
    
    const tests = [];
    
    // 測試 1: 訂單數量統計
    tests.push(async () => {
        console.log('📊 測試 1: 訂單數量統計');
        console.log(`   URL: ${BASE_URL}/api/driver/order-counts`);
        
        try {
            const result = await makeRequest(`${BASE_URL}/api/driver/order-counts`);
            console.log(`   ✅ 狀態: ${result.statusCode}`);
            
            if (result.json) {
                console.log(`   📊 回應: ${JSON.stringify(result.json, null, 2)}`);
                if (result.json.success && result.json.counts) {
                    console.log('   ✅ API 正常，包含訂單統計數據');
                    return true;
                } else {
                    console.log('   ❌ API 回應格式錯誤');
                    return false;
                }
            } else {
                console.log('   ❌ 非JSON回應');
                return false;
            }
        } catch (error) {
            console.log(`   ❌ 錯誤: ${error.message}`);
            return false;
        }
    });
    
    // 測試 2: 三峽區訂單 (GET方式)
    tests.push(async () => {
        console.log('\n📍 測試 2: 三峽區訂單 (GET方式)');
        console.log(`   URL: ${BASE_URL}/api/driver/area-orders/三峽區`);
        
        try {
            const result = await makeRequest(`${BASE_URL}/api/driver/area-orders/${encodeURIComponent('三峽區')}`);
            console.log(`   ✅ 狀態: ${result.statusCode}`);
            
            if (result.json) {
                console.log(`   📦 訂單數量: ${result.json.orders ? result.json.orders.length : 0}`);
                if (result.json.success && Array.isArray(result.json.orders)) {
                    console.log('   ✅ API 正常，返回訂單陣列');
                    return true;
                } else {
                    console.log('   ❌ API 回應格式錯誤');
                    return false;
                }
            } else {
                console.log('   ❌ 非JSON回應');
                return false;
            }
        } catch (error) {
            console.log(`   ❌ 錯誤: ${error.message}`);
            return false;
        }
    });
    
    // 測試 3: 三峽區訂單 (POST方式 - 備用)
    tests.push(async () => {
        console.log('\n📍 測試 3: 三峽區訂單 (POST備用方式)');
        console.log(`   URL: ${BASE_URL}/api/driver/area-orders-by-name`);
        
        try {
            const result = await makeRequest(`${BASE_URL}/api/driver/area-orders-by-name`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ area: '三峽區' })
            });
            console.log(`   ✅ 狀態: ${result.statusCode}`);
            
            if (result.json) {
                console.log(`   📦 訂單數量: ${result.json.orders ? result.json.orders.length : 0}`);
                if (result.json.success && Array.isArray(result.json.orders)) {
                    console.log('   ✅ POST API 正常，返回訂單陣列');
                    return true;
                } else {
                    console.log('   ❌ POST API 回應格式錯誤');
                    return false;
                }
            } else {
                console.log('   ❌ 非JSON回應');
                return false;
            }
        } catch (error) {
            console.log(`   ❌ POST 錯誤: ${error.message}`);
            return false;
        }
    });
    
    // 測試 4: 外送員統計
    tests.push(async () => {
        console.log('\n📈 測試 4: 外送員統計');
        console.log(`   URL: ${BASE_URL}/api/driver/stats`);
        
        try {
            const result = await makeRequest(`${BASE_URL}/api/driver/stats`);
            console.log(`   ✅ 狀態: ${result.statusCode}`);
            
            if (result.json) {
                console.log(`   📈 統計: ${JSON.stringify(result.json, null, 2)}`);
                if (result.json.success) {
                    console.log('   ✅ 統計API 正常');
                    return true;
                } else {
                    console.log('   ❌ 統計API 回應錯誤');
                    return false;
                }
            } else {
                console.log('   ❌ 非JSON回應');
                return false;
            }
        } catch (error) {
            console.log(`   ❌ 錯誤: ${error.message}`);
            return false;
        }
    });
    
    // 執行所有測試
    const results = [];
    for (const test of tests) {
        const result = await test();
        results.push(result);
    }
    
    // 總結
    console.log('\n🎯 === 測試總結 ===');
    const passed = results.filter(r => r).length;
    const total = results.length;
    console.log(`✅ 通過: ${passed}/${total} 個測試`);
    
    if (passed === total) {
        console.log('🎉 所有API端點正常運作！');
        console.log('⚠️  如果前端仍卡在載入狀態，問題可能在：');
        console.log('   1. 前端JavaScript執行錯誤');
        console.log('   2. 非同步函數異常');
        console.log('   3. DOM更新邏輯問題');
    } else {
        console.log('❌ 部分API端點有問題，需要修復');
    }
    
    console.log('\n💡 建議下一步：');
    console.log('   1. 檢查瀏覽器開發者工具console');
    console.log('   2. 確認loadUnifiedOrderPool()函數執行狀況');
    console.log('   3. 檢查Promise處理邏輯');
}

// 執行測試
if (require.main === module) {
    testAPI().catch(console.error);
}

module.exports = { testAPI, makeRequest };