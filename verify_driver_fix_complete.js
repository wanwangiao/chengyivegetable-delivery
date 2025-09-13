
/**
 * 驗證外送員訂單修復結果
 */
const axios = require('axios');

const BASE_URL = 'https://chengyivegetable-production-7b4a.up.railway.app';

async function verifyFix() {
    try {
        console.log('🔍 驗證修復結果...');
        
        // 1. 登錄外送員
        const loginResponse = await axios.post(`${BASE_URL}/driver/login`, {
            phone: '0912345678',
            password: 'driver123'
        }, {
            maxRedirects: 0,
            validateStatus: (status) => status < 400
        });
        
        const cookies = loginResponse.headers['set-cookie'];
        const sessionCookie = cookies?.find(cookie => cookie.includes('connect.sid')) || cookies?.[0];
        
        if (!sessionCookie) {
            throw new Error('登錄失敗');
        }
        
        console.log('✅ 外送員登錄成功');
        
        // 2. 檢查訂單數量
        const countResponse = await axios.get(`${BASE_URL}/api/driver/order-counts`, {
            headers: { 'Cookie': sessionCookie }
        });
        
        const counts = countResponse.data.counts || {};
        const totalOrders = Object.values(counts).reduce((sum, count) => sum + count, 0);
        
        console.log('📊 訂單數量檢查:', JSON.stringify(counts, null, 2));
        console.log(`總訂單數: ${totalOrders} 筆`);
        
        if (totalOrders >= 11) {
            console.log('✅ 成功！外送員可以看到11筆或更多訂單');
        } else if (totalOrders > 0) {
            console.log(`⚠️ 部分成功：看到 ${totalOrders} 筆訂單，少於預期的11筆`);
        } else {
            console.log('❌ 失敗：仍然看不到任何訂單');
        }
        
        // 3. 測試地區訂單載入
        const areas = ['三峽區', '樹林區', '鶯歌區', '土城區', '北大特區'];
        
        for (const area of areas) {
            try {
                const areaResponse = await axios.post(`${BASE_URL}/api/driver/area-orders-by-name`, {
                    area: area
                }, {
                    headers: { 
                        'Cookie': sessionCookie,
                        'Content-Type': 'application/json'
                    }
                });
                
                const areaOrders = areaResponse.data.orders || [];
                const status = areaOrders.length > 0 ? '✅' : '❌';
                console.log(`${status} ${area}: ${areaOrders.length} 筆訂單`);
                
                if (areaOrders.length > 0) {
                    // 測試接取第一筆訂單
                    const firstOrderId = areaOrders[0].id;
                    console.log(`  🎯 測試接取訂單 #${firstOrderId}`);
                    
                    const acceptResponse = await axios.post(`${BASE_URL}/api/driver/batch-accept-orders`, {
                        orderIds: [firstOrderId]
                    }, {
                        headers: { 
                            'Cookie': sessionCookie,
                            'Content-Type': 'application/json'
                        }
                    });
                    
                    if (acceptResponse.data.success) {
                        console.log(`  ✅ 成功接取訂單 #${firstOrderId}`);
                        
                        // 檢查我的訂單
                        const myOrdersResponse = await axios.get(`${BASE_URL}/api/driver/my-orders`, {
                            headers: { 'Cookie': sessionCookie }
                        });
                        
                        const myOrders = myOrdersResponse.data.orders || [];
                        console.log(`  📦 我的訂單數量: ${myOrders.length} 筆`);
                        
                        if (myOrders.some(order => order.id == firstOrderId)) {
                            console.log(`  🎉 訂單 #${firstOrderId} 已成功加入我的訂單欄！`);
                            return true; // 修復成功
                        }
                    }
                    
                    break; // 只測試第一個有訂單的地區
                }
            } catch (areaError) {
                console.log(`❌ ${area} 載入失敗: ${areaError.response?.data?.message || areaError.message}`);
            }
        }
        
        return totalOrders > 0;
        
    } catch (error) {
        console.error('❌ 驗證失敗:', error.message);
        return false;
    }
}

// 如果直接執行此腳本
if (require.main === module) {
    verifyFix().then(success => {
        if (success) {
            console.log('\n🎉 修復驗證成功！外送員訂單功能正常運作');
            process.exit(0);
        } else {
            console.log('\n💥 修復驗證失敗，需要進一步檢查');
            process.exit(1);
        }
    });
}

module.exports = { verifyFix };
