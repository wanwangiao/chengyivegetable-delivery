const axios = require('axios');
const mapboxService = require('./src/services/mapboxService');

// Test Mapbox integration
async function testMapboxIntegration() {
    console.log('🗺️ 開始測試 Mapbox 整合...\n');
    
    // Test 1: Geocoding
    console.log('📍 測試 1: 地址轉座標 (Geocoding)');
    try {
        const geocodeResult = await mapboxService.geocode('新北市三峽區中山路123號');
        console.log('✅ 地址解析結果:', geocodeResult);
    } catch (error) {
        console.log('❌ 地址解析失敗:', error.message);
    }
    
    console.log('\n');
    
    // Test 2: Route optimization
    console.log('🛣️ 測試 2: 路線優化');
    const testAddresses = [
        '新北市三峽區中山路123號',
        '新北市三峽區民權街45號',
        '新北市三峽區復興路67號'
    ];
    
    try {
        const routeResult = await mapboxService.optimizeRoute(testAddresses);
        console.log('✅ 路線優化結果:', routeResult);
    } catch (error) {
        console.log('❌ 路線優化失敗:', error.message);
    }
    
    console.log('\n');
    
    // Test 3: Driver API endpoint
    console.log('🚛 測試 3: 外送員路線優化 API');
    try {
        const response = await axios.post('http://localhost:3004/api/driver/optimize-route', {
            orderIds: ['demo-1', 'demo-2', 'demo-3']
        }, {
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        console.log('✅ API 響應狀態:', response.status);
        console.log('✅ API 響應結果:');
        console.log('  - 成功:', response.data.success);
        console.log('  - 優化訂單數:', response.data.optimizedOrders?.length || 0);
        console.log('  - 路線URL:', response.data.routeUrl ? '已生成' : '未生成');
        console.log('  - 互動URL:', response.data.interactiveUrl ? '已生成' : '未生成');
        console.log('  - 預計節省時間:', response.data.timeSaved || 0, '分鐘');
        console.log('  - 訊息:', response.data.message);
    } catch (error) {
        console.log('❌ API 測試失敗:', error.message);
        if (error.response) {
            console.log('  - 狀態碼:', error.response.status);
            console.log('  - 錯誤訊息:', error.response.data?.message);
        }
    }
    
    console.log('\n');
    
    // Test 4: Map URL generation
    console.log('🌐 測試 4: 地圖URL生成');
    const mockCoordinates = [
        [121.37, 24.93],
        [121.38, 24.94],
        [121.36, 24.92]
    ];
    
    try {
        const staticMapUrl = mapboxService.generateMapboxUrl(mockCoordinates);
        const interactiveUrl = mapboxService.generateInteractiveMapUrl(mockCoordinates);
        
        console.log('✅ 靜態地圖URL:', staticMapUrl ? '已生成' : '生成失敗');
        console.log('✅ 互動地圖URL:', interactiveUrl ? '已生成' : '生成失敗');
    } catch (error) {
        console.log('❌ 地圖URL生成失敗:', error.message);
    }
    
    console.log('\n🏁 Mapbox 整合測試完成！');
}

// Run the test
if (require.main === module) {
    testMapboxIntegration().catch(console.error);
}

module.exports = testMapboxIntegration;