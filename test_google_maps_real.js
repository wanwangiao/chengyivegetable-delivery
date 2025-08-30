// 測試真實的 Google Maps API
const GoogleMapsService = require('./src/services/GoogleMapsService');

async function testRealGoogleMaps() {
    console.log('🗺️ 開始測試真實的 Google Maps API\n');
    
    const gmapsService = new GoogleMapsService();
    
    // 測試1: 地址轉座標
    console.log('📍 測試 1: 地址解析');
    try {
        const result = await gmapsService.geocodeAddress('新北市三峽區中山路123號');
        console.log('✅ 地址解析成功:', {
            coordinates: result.coordinates,
            formatted_address: result.formatted_address?.substr(0, 50) + '...'
        });
    } catch (error) {
        console.log('❌ 地址解析失敗:', error.message);
    }
    
    console.log('');
    
    // 測試2: 計算距離
    console.log('📏 測試 2: 距離計算');
    try {
        const addresses = [
            '新北市三峽區中山路123號',
            '新北市三峽區復興路456號',
            '新北市三峽區民權街789號'
        ];
        
        const result = await gmapsService.calculateOptimalRoute(addresses);
        console.log('✅ 路線計算成功:', {
            total_distance: result.total_distance + ' km',
            total_duration: result.total_duration + ' 分鐘',
            optimized_addresses: result.optimized_addresses.length + ' 個地址'
        });
    } catch (error) {
        console.log('❌ 路線計算失敗:', error.message);
    }
    
    console.log('');
    
    // 測試3: 批量地理編碼
    console.log('📦 測試 3: 批量地址解析');
    try {
        const addresses = [
            '新北市三峽區中山路100號',
            '新北市三峽區復興路200號',
            '新北市三峽區民生路300號'
        ];
        
        const results = await gmapsService.batchGeocode(addresses);
        console.log('✅ 批量解析成功:', {
            成功解析: results.filter(r => r.success).length + '/' + addresses.length,
            總API調用: results.length + ' 次'
        });
        
        // 顯示第一個結果的詳細資訊
        if (results[0] && results[0].success) {
            console.log('   第一個地址結果:', {
                原始地址: results[0].address,
                座標: results[0].coordinates,
                格式化地址: results[0].formatted_address?.substr(0, 40) + '...'
            });
        }
    } catch (error) {
        console.log('❌ 批量解析失敗:', error.message);
    }
    
    console.log('\n🏁 Google Maps API 測試完成!');
}

if (require.main === module) {
    testRealGoogleMaps().catch(console.error);
}

module.exports = { testRealGoogleMaps };