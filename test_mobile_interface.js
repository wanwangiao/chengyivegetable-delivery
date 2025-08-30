const axios = require('axios');

// 測試移動端外送員介面
async function testMobileInterface() {
    console.log('📱 開始測試移動端外送員介面...\\n');
    
    const baseUrl = 'http://localhost:3007';
    
    // Test 1: 測試API連通性
    console.log('🔌 測試 1: API 連通性檢查');
    try {
        const healthResponse = await axios.get(`${baseUrl}/`);
        console.log('✅ 服務器連通性:', healthResponse.status === 200 ? '正常' : '異常');
    } catch (error) {
        console.log('❌ 服務器連接失敗:', error.message);
        console.log('⚠️ 繼續執行 API 測試...');
    }
    
    console.log('\\n');
    
    // Test 2: 測試配送狀態 API
    console.log('📋 測試 2: 獲取配送狀態');
    try {
        const statusResponse = await axios.get(`${baseUrl}/api/driver-mobile/delivery-status`);
        console.log('✅ 配送狀態 API:', statusResponse.status);
        console.log('  - 當前訂單:', statusResponse.data.currentOrder?.customer || '無');
        console.log('  - 待配送訂單:', statusResponse.data.acceptedOrders?.length || 0, '筆');
        console.log('  - 已完成訂單:', statusResponse.data.completedOrders?.length || 0, '筆');
        console.log('  - 統計資料:', JSON.stringify(statusResponse.data.stats));
    } catch (error) {
        console.log('❌ 配送狀態 API 失敗:', error.response?.data?.message || error.message);
    }
    
    console.log('\\n');
    
    // Test 3: 測試路線計算 API
    console.log('🗺️ 測試 3: 路線計算');
    try {
        const routeResponse = await axios.post(`${baseUrl}/api/driver-mobile/calculate-route`, {
            currentLocation: {
                lat: 24.9342,
                lng: 121.3706
            },
            destination: '新北市三峽區中山路123號'
        });
        
        console.log('✅ 路線計算 API:', routeResponse.status);
        console.log('  - 距離:', routeResponse.data.distance || '未計算');
        console.log('  - 時間:', routeResponse.data.duration || '未計算');
    } catch (error) {
        console.log('❌ 路線計算 API 失敗:', error.response?.data?.message || error.message);
    }
    
    console.log('\\n');
    
    // Test 4: 測試完成配送 API
    console.log('✅ 測試 4: 完成配送功能');
    try {
        const completeResponse = await axios.post(`${baseUrl}/api/driver-mobile/complete-delivery/order-001`, {
            driverId: 'test-driver-001'
        });
        
        console.log('✅ 完成配送 API:', completeResponse.status);
        console.log('  - 成功:', completeResponse.data.success);
        console.log('  - 訊息:', completeResponse.data.message);
        console.log('  - 下一筆訂單:', completeResponse.data.nextOrder?.customer || '無');
        console.log('  - 還有更多訂單:', completeResponse.data.hasMoreOrders);
    } catch (error) {
        console.log('❌ 完成配送 API 失敗:', error.response?.data?.message || error.message);
    }
    
    console.log('\\n');
    
    // Test 5: 測試路線優化 API
    console.log('🧠 測試 5: AI 路線優化');
    try {
        const optimizeResponse = await axios.post(`${baseUrl}/api/driver-mobile/optimize-delivery-route`, {
            currentLocation: {
                lat: 24.9342,
                lng: 121.3706
            },
            orderIds: ['order-002', 'order-003']
        });
        
        console.log('✅ 路線優化 API:', optimizeResponse.status);
        console.log('  - 成功:', optimizeResponse.data.success);
        console.log('  - 優化訂單數:', optimizeResponse.data.optimizedRoute?.length || 0);
        console.log('  - 總距離:', optimizeResponse.data.totalDistance || 0, 'km');
        console.log('  - 總時間:', optimizeResponse.data.totalDuration || 0, 'min');
        console.log('  - 訊息:', optimizeResponse.data.message);
    } catch (error) {
        console.log('❌ 路線優化 API 失敗:', error.response?.data?.message || error.message);
    }
    
    console.log('\\n');
    
    // Test 6: 測試外送員統計 API
    console.log('📊 測試 6: 外送員統計資訊');
    try {
        const statsResponse = await axios.get(`${baseUrl}/api/driver-mobile/driver-stats/test-driver-001`);
        console.log('✅ 統計資訊 API:', statsResponse.status);
        console.log('  - 外送員ID:', statsResponse.data.stats.driverId);
        console.log('  - 今日總訂單:', statsResponse.data.stats.today.totalOrders);
        console.log('  - 已完成訂單:', statsResponse.data.stats.today.completedOrders);
        console.log('  - 剩餘訂單:', statsResponse.data.stats.today.remainingOrders);
        console.log('  - 今日收入:', statsResponse.data.stats.today.earnings, '元');
        console.log('  - 平均配送時間:', statsResponse.data.stats.today.averageTime);
        console.log('  - 當前狀態:', statsResponse.data.stats.currentStatus);
    } catch (error) {
        console.log('❌ 統計資訊 API 失敗:', error.response?.data?.message || error.message);
    }
    
    console.log('\\n');
    
    // Test 7: 測試位置更新 API
    console.log('📍 測試 7: 位置更新功能');
    try {
        const locationResponse = await axios.post(`${baseUrl}/api/driver-mobile/update-location`, {
            driverId: 'test-driver-001',
            location: {
                lat: 24.9350,
                lng: 121.3720
            },
            timestamp: new Date().toISOString()
        });
        
        console.log('✅ 位置更新 API:', locationResponse.status);
        console.log('  - 成功:', locationResponse.data.success);
        console.log('  - 訊息:', locationResponse.data.message);
    } catch (error) {
        console.log('❌ 位置更新 API 失敗:', error.response?.data?.message || error.message);
    }
    
    console.log('\\n');
    
    // Test 8: 測試訂單詳情 API
    console.log('📋 測試 8: 訂單詳情功能');
    try {
        const orderResponse = await axios.get(`${baseUrl}/api/driver-mobile/order-details/order-002`);
        console.log('✅ 訂單詳情 API:', orderResponse.status);
        console.log('  - 訂單ID:', orderResponse.data.order.id);
        console.log('  - 客戶姓名:', orderResponse.data.order.customer);
        console.log('  - 配送地址:', orderResponse.data.order.address);
        console.log('  - 聯絡電話:', orderResponse.data.order.phone);
        console.log('  - 商品項目:', orderResponse.data.order.items.join(', '));
        console.log('  - 訂單狀態:', orderResponse.data.order.status);
    } catch (error) {
        console.log('❌ 訂單詳情 API 失敗:', error.response?.data?.message || error.message);
    }
    
    console.log('\\n');
    
    // 流暢度測試
    console.log('⚡ 流暢度測試: 連續 API 調用');
    const startTime = Date.now();
    try {
        const promises = [
            axios.get(`${baseUrl}/api/driver-mobile/delivery-status`),
            axios.get(`${baseUrl}/api/driver-mobile/driver-stats/test-driver-001`),
            axios.get(`${baseUrl}/api/driver-mobile/order-details/order-003`)
        ];
        
        await Promise.all(promises);
        const endTime = Date.now();
        const totalTime = endTime - startTime;
        
        console.log(`✅ 並行 API 調用完成，總耗時: ${totalTime}ms`);
        console.log(`📈 平均響應時間: ${Math.round(totalTime / promises.length)}ms`);
        
        if (totalTime < 1000) {
            console.log('🚀 流暢度: 優秀 (<1秒)');
        } else if (totalTime < 3000) {
            console.log('⚡ 流暢度: 良好 (<3秒)');
        } else {
            console.log('⚠️ 流暢度: 需要優化 (>3秒)');
        }
        
    } catch (error) {
        console.log('❌ 流暢度測試失敗:', error.message);
    }
    
    console.log('\\n🏁 移動端介面測試完成！');
    console.log('🌐 前台訪問: http://localhost:3007/driver/mobile');
    console.log('💡 提示: 請在移動設備或開發者工具的移動模式下測試最佳體驗');
}

// Run the test
if (require.main === module) {
    testMobileInterface().catch(console.error);
}

module.exports = testMobileInterface;