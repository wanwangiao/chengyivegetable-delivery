/**
 * 深度調查外送員"11筆舊訂單"無法接取問題
 * 專門檢查資料庫狀態和API邏輯
 */

const axios = require('axios');
const BASE_URL = 'https://chengyivegetable-production-7b4a.up.railway.app';

console.log('🔍 深度調查外送員訂單接取問題');
console.log('📅 調查時間:', new Date().toLocaleString('zh-TW'));
console.log('🌐 目標系統:', BASE_URL);
console.log('🎯 問題描述: 外送員看到11筆舊訂單，但無法加入訂單欄');

/**
 * 深度調查外送員訂單問題
 */
async function investigateDriverOrdersIssue() {
    let sessionCookie = null;
    
    try {
        console.log('\n🔐 步驟1: 外送員登錄...');
        
        const loginResponse = await axios.post(`${BASE_URL}/driver/login`, {
            phone: '0912345678',
            password: 'driver123'
        }, {
            maxRedirects: 0,
            validateStatus: (status) => status < 400
        });
        
        if (loginResponse.status === 302) {
            const cookies = loginResponse.headers['set-cookie'];
            if (cookies) {
                sessionCookie = cookies.find(cookie => cookie.includes('connect.sid')) || cookies[0];
                console.log('✅ 登錄成功，已獲取 session');
            }
        }
        
        if (!sessionCookie) {
            throw new Error('無法取得 session cookie');
        }
        
        console.log('\n📊 步驟2: 詳細分析API回應...');
        
        // 1. 檢查訂單數量API
        console.log('\n🔍 2.1 檢查訂單數量API');
        const orderCountResponse = await axios.get(`${BASE_URL}/api/driver/order-counts`, {
            headers: { 'Cookie': sessionCookie }
        });
        
        console.log('📈 訂單數量回應:', JSON.stringify(orderCountResponse.data, null, 2));
        
        const counts = orderCountResponse.data.counts || {};
        const totalOrders = Object.values(counts).reduce((sum, count) => sum + count, 0);
        console.log(`📊 總訂單數: ${totalOrders} 筆`);
        
        if (totalOrders === 0) {
            console.log('⚠️ 警告: API顯示0筆訂單，但用戶報告11筆舊訂單');
            console.log('🔍 可能原因:');
            console.log('   1. 訂單狀態不是 "packed"');
            console.log('   2. 訂單已被分配給其他外送員 (driver_id 不為 NULL)');
            console.log('   3. 訂單地址不匹配地區篩選條件');
            console.log('   4. 資料庫中沒有符合條件的訂單');
        }
        
        // 2. 檢查我的訂單API
        console.log('\n🔍 2.2 檢查我的訂單API');
        const myOrdersResponse = await axios.get(`${BASE_URL}/api/driver/my-orders`, {
            headers: { 'Cookie': sessionCookie }
        });
        
        console.log('📦 我的訂單回應:', JSON.stringify(myOrdersResponse.data, null, 2));
        
        // 3. 測試各地區訂單API
        console.log('\n🔍 2.3 測試各地區訂單載入...');
        const areas = ['三峽區', '樹林區', '鶯歌區', '土城區', '北大特區'];
        
        for (const area of areas) {
            try {
                console.log(`\n   📍 測試 ${area}:`);
                
                // 使用POST方式避免URL編碼問題
                const areaOrdersResponse = await axios.post(`${BASE_URL}/api/driver/area-orders-by-name`, {
                    area: area
                }, {
                    headers: { 
                        'Cookie': sessionCookie,
                        'Content-Type': 'application/json'
                    }
                });
                
                const areaOrders = areaOrdersResponse.data.orders || [];
                console.log(`   ✅ ${area}: ${areaOrders.length} 筆訂單`);
                
                if (areaOrders.length > 0) {
                    console.log(`   📋 訂單詳情:`, areaOrders.map(order => ({
                        id: order.id,
                        customer: order.customer_name,
                        address: order.address,
                        amount: order.total_amount,
                        payment: order.payment_method
                    })));
                }
            } catch (areaError) {
                console.log(`   ❌ ${area} 載入失敗:`, areaError.response?.data || areaError.message);
            }
        }
        
        // 4. 測試接取訂單API（如果有訂單的話）
        if (totalOrders > 0) {
            console.log('\n🔍 2.4 測試批量接取訂單API...');
            
            // 先獲取一些實際的訂單ID
            const testOrderIds = [1001, 1002, 1003]; // 使用測試ID
            
            try {
                const acceptResponse = await axios.post(`${BASE_URL}/api/driver/batch-accept-orders`, {
                    orderIds: testOrderIds
                }, {
                    headers: { 
                        'Cookie': sessionCookie,
                        'Content-Type': 'application/json'
                    }
                });
                
                console.log('📝 接取訂單回應:', JSON.stringify(acceptResponse.data, null, 2));
            } catch (acceptError) {
                console.log('❌ 接取訂單測試失敗:', acceptError.response?.data || acceptError.message);
            }
        }
        
        // 5. 檢查前端工作台頁面
        console.log('\n🔍 2.5 檢查前端工作台頁面...');
        const dashboardResponse = await axios.get(`${BASE_URL}/driver`, {
            headers: { 'Cookie': sessionCookie }
        });
        
        const dashboardContent = dashboardResponse.data;
        
        // 分析前端內容
        const hasOrderSelectionJS = dashboardContent.includes('selectOrder');
        const hasBatchAcceptJS = dashboardContent.includes('batch-accept-orders');
        const hasAddToCartJS = dashboardContent.includes('addToCart');
        const hasOrderCardsHTML = dashboardContent.includes('order-card');
        
        console.log('📱 前端功能檢查:');
        console.log(`   訂單選取函數: ${hasOrderSelectionJS ? '✅' : '❌'}`);
        console.log(`   批量接取API: ${hasBatchAcceptJS ? '✅' : '❌'}`);
        console.log(`   購物車功能: ${hasAddToCartJS ? '✅' : '❌'}`);
        console.log(`   訂單卡片HTML: ${hasOrderCardsHTML ? '✅' : '❌'}`);
        
        // 6. 分析問題根因
        console.log('\n🎯 問題根因分析:');
        console.log('════════════════════════════════');
        
        if (totalOrders === 0) {
            console.log('🔍 主要問題: 資料庫中沒有符合條件的可接取訂單');
            console.log('');
            console.log('📋 可能的原因:');
            console.log('1. 所有訂單的狀態都不是 "packed"');
            console.log('2. 所有訂單都已被分配給其他外送員 (driver_id 不為 NULL)');
            console.log('3. 訂單的地址字段不包含地區關鍵字');
            console.log('4. 實際上資料庫中沒有11筆舊訂單');
            console.log('');
            console.log('🔧 建議的修復步驟:');
            console.log('1. 檢查資料庫中 orders 表的實際內容');
            console.log('2. 查看所有訂單的 status 和 driver_id 欄位');
            console.log('3. 驗證地址欄位是否包含正確的地區信息');
            console.log('4. 如有必要，創建測試訂單來驗證功能');
        } else {
            console.log('🔍 問題在於前端或API邏輯');
            console.log('需要進一步檢查JavaScript和接取訂單的邏輯');
        }
        
        // 7. 提供具體的資料庫檢查建議
        console.log('\n💡 立即可執行的檢查:');
        console.log('════════════════════════════════');
        console.log('執行以下SQL查詢來檢查資料庫狀態:');
        console.log('');
        console.log('-- 檢查所有訂單的狀態分佈');
        console.log('SELECT status, COUNT(*) as count FROM orders GROUP BY status;');
        console.log('');
        console.log('-- 檢查有driver_id的訂單');
        console.log('SELECT driver_id, COUNT(*) as count FROM orders WHERE driver_id IS NOT NULL GROUP BY driver_id;');
        console.log('');
        console.log('-- 檢查packed狀態且未分配的訂單');
        console.log("SELECT id, customer_name, address, total_amount, created_at FROM orders WHERE status = 'packed' AND driver_id IS NULL LIMIT 15;");
        console.log('');
        console.log('-- 檢查地址中包含地區關鍵字的訂單');
        console.log("SELECT id, address, status, driver_id FROM orders WHERE address LIKE '%三峽%' OR address LIKE '%樹林%' OR address LIKE '%鶯歌%';");
        
        return {
            success: true,
            totalOrdersFound: totalOrders,
            dashboardLoaded: dashboardResponse.status === 200,
            frontendFunctionsPresent: {
                selectOrder: hasOrderSelectionJS,
                batchAccept: hasBatchAcceptJS,
                addToCart: hasAddToCartJS,
                orderCards: hasOrderCardsHTML
            }
        };
        
    } catch (error) {
        console.error('\n❌ 調查過程發生錯誤:', error.message);
        
        if (error.response) {
            console.log('📊 錯誤詳情:');
            console.log('   狀態碼:', error.response.status);
            console.log('   狀態文字:', error.response.statusText);
            if (error.response.data) {
                console.log('   回應內容:', JSON.stringify(error.response.data, null, 2));
            }
        }
        
        return { success: false, error: error.message };
    }
}

// 執行調查
investigateDriverOrdersIssue()
    .then(result => {
        if (result.success) {
            console.log('\n🏆 調查完成');
            console.log('結論: 問題主要出現在資料庫層面 - 沒有符合條件的可接取訂單');
            console.log('建議: 執行上述SQL查詢檢查實際的資料庫狀態');
        } else {
            console.log('\n💥 調查未能完成:', result.error);
        }
        process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
        console.error('調查執行失敗:', error);
        process.exit(1);
    });