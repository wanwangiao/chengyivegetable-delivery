const fs = require('fs');
const axios = require('axios');

// Google Maps API 使用量測試
class GoogleMapsUsageTracker {
    constructor() {
        this.apiCalls = {
            geocoding: 0,          // 地址轉座標
            directions: 0,         // 路線規劃
            staticMaps: 0,         // 靜態地圖
            placesNearby: 0,       // 附近地點搜尋
            distanceMatrix: 0      // 距離矩陣
        };
        this.startTime = Date.now();
        this.callLog = [];
    }

    // 記錄API調用
    logApiCall(type, description, cost = 0) {
        this.apiCalls[type]++;
        this.callLog.push({
            timestamp: new Date().toISOString(),
            type: type,
            description: description,
            estimated_cost: cost,
            call_number: this.apiCalls[type]
        });
        console.log(`📡 API調用 #${this.apiCalls[type]} [${type}]: ${description}`);
    }

    // 模擬地址解析
    async simulateGeocoding(address) {
        this.logApiCall('geocoding', `解析地址: ${address}`, 0.005);
        
        // 模擬API延遲
        await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
        
        return {
            lat: 24.93 + (Math.random() - 0.5) * 0.1,
            lng: 121.37 + (Math.random() - 0.5) * 0.1,
            formatted_address: address
        };
    }

    // 模擬路線規劃
    async simulateDirections(waypoints, optimize = false) {
        const description = `路線規劃: ${waypoints.length}個點${optimize ? ' (最佳化)' : ''}`;
        this.logApiCall('directions', description, 0.005);
        
        await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 300));
        
        return {
            distance: Math.random() * 20 + 5, // 5-25km
            duration: Math.random() * 45 + 15, // 15-60 minutes
            optimized_order: optimize ? waypoints.sort(() => Math.random() - 0.5) : waypoints
        };
    }

    // 模擬靜態地圖生成
    simulateStaticMap(markers, description) {
        this.logApiCall('staticMaps', `靜態地圖: ${description}`, 0.002);
        return `https://maps.googleapis.com/maps/api/staticmap?markers=${markers.length}&key=API_KEY`;
    }

    // 模擬距離矩陣計算
    async simulateDistanceMatrix(origins, destinations) {
        const description = `距離矩陣: ${origins.length}×${destinations.length}`;
        this.logApiCall('distanceMatrix', description, 0.005);
        
        await new Promise(resolve => setTimeout(resolve, 150 + Math.random() * 250));
        
        return Array(origins.length).fill().map(() => 
            Array(destinations.length).fill().map(() => ({
                distance: Math.random() * 30 + 2,
                duration: Math.random() * 60 + 10
            }))
        );
    }

    // 生成使用報告
    generateReport() {
        const totalCalls = Object.values(this.apiCalls).reduce((sum, count) => sum + count, 0);
        const totalCost = this.callLog.reduce((sum, call) => sum + call.estimated_cost, 0);
        const duration = (Date.now() - this.startTime) / 1000;

        return {
            summary: {
                test_duration_seconds: duration,
                total_api_calls: totalCalls,
                estimated_cost_usd: totalCost,
                calls_per_second: (totalCalls / duration).toFixed(2)
            },
            api_breakdown: this.apiCalls,
            detailed_calls: this.callLog,
            cost_analysis: {
                geocoding_cost: this.apiCalls.geocoding * 0.005,
                directions_cost: this.apiCalls.directions * 0.005,
                static_maps_cost: this.apiCalls.staticMaps * 0.002,
                distance_matrix_cost: this.apiCalls.distanceMatrix * 0.005,
                total_cost: totalCost
            }
        };
    }
}

// 執行完整測試流程
async function runCompleteTest() {
    console.log('🚀 開始 Google Maps API 使用量壓力測試\n');
    
    // 載入測試數據
    const testData = JSON.parse(fs.readFileSync('test_orders_100.json', 'utf8'));
    const tracker = new GoogleMapsUsageTracker();
    
    console.log(`📦 載入了 ${testData.orders.length} 筆訂單，${testData.batches.length} 個配送批次\n`);

    // 階段1: 訂單創建階段 - 地址解析
    console.log('🏗️  階段1: 訂單創建 - 地址解析');
    for (let i = 0; i < testData.orders.length; i++) {
        const order = testData.orders[i];
        await tracker.simulateGeocoding(order.address);
        
        // 每10筆顯示進度
        if ((i + 1) % 10 === 0) {
            console.log(`   進度: ${i + 1}/100 筆訂單已處理`);
        }
    }
    console.log(`✅ 階段1完成: ${tracker.apiCalls.geocoding} 次地址解析\n`);

    // 階段2: 外送員接單 - 地圖載入與顯示
    console.log('🚛 階段2: 外送員接單 - 地圖載入');
    for (const batch of testData.batches) {
        // 外送員查看可接訂單的地圖
        tracker.simulateStaticMap(
            batch.orders, 
            `批次${batch.batchNumber} - 查看${batch.orderCount}筆訂單位置`
        );
        
        // 每次接單都會載入地圖
        tracker.simulateStaticMap(
            batch.orders,
            `批次${batch.batchNumber} - 接單確認地圖`
        );
        
        console.log(`   批次 ${batch.batchNumber}: 2次地圖載入 (${batch.orderCount}筆訂單)`);
    }
    console.log(`✅ 階段2完成: ${tracker.apiCalls.staticMaps} 次地圖載入\n`);

    // 階段3: 路線優化
    console.log('🗺️  階段3: 路線優化規劃');
    for (const batch of testData.batches) {
        // 批次路線優化
        const waypoints = batch.orders.map(order => ({
            lat: order.coordinates.lat,
            lng: order.coordinates.lng,
            address: order.address
        }));
        
        await tracker.simulateDirections(waypoints, true);
        
        // 生成優化路線的靜態地圖
        tracker.simulateStaticMap(
            waypoints,
            `批次${batch.batchNumber} - 優化路線地圖`
        );
        
        console.log(`   批次 ${batch.batchNumber}: 路線優化 ${batch.orderCount} 個點`);
    }
    console.log(`✅ 階段3完成: ${tracker.apiCalls.directions} 次路線規劃\n`);

    // 階段4: 配送過程 - 即時追蹤
    console.log('📱 階段4: 配送過程 - 客戶追蹤');
    for (const batch of testData.batches) {
        // 模擬客戶查看配送進度 (每筆訂單平均2-3次查看)
        for (const order of batch.orders) {
            const viewCount = Math.floor(Math.random() * 2) + 2; // 2-3次
            for (let i = 0; i < viewCount; i++) {
                tracker.simulateStaticMap(
                    [order],
                    `客戶追蹤 - ${order.customer_name} 查看配送位置`
                );
            }
        }
        
        console.log(`   批次 ${batch.batchNumber}: ${batch.orderCount}個客戶追蹤地圖`);
    }
    console.log(`✅ 階段4完成: 客戶追蹤地圖載入\n`);

    // 階段5: 後台管理 - 統計分析
    console.log('📊 階段5: 後台管理 - 統計分析');
    
    // 每日配送統計地圖
    tracker.simulateStaticMap(
        testData.orders,
        '每日配送統計 - 所有訂單分布圖'
    );
    
    // 地區熱點分析
    const areas = [...new Set(testData.orders.map(o => o.area))];
    for (const area of areas) {
        const areaOrders = testData.orders.filter(o => o.area === area);
        tracker.simulateStaticMap(
            areaOrders,
            `地區分析 - ${area} (${areaOrders.length}筆)`
        );
    }
    
    // 外送員績效分析
    for (const batch of testData.batches) {
        tracker.simulateStaticMap(
            batch.orders,
            `外送員 ${batch.driverId} 績效分析`
        );
    }
    
    console.log(`✅ 階段5完成: 後台分析圖表\n`);

    // 生成最終報告
    const report = tracker.generateReport();
    
    console.log('📋 測試完成! 生成使用報告...\n');
    console.log('==================== 測試結果 ====================');
    console.log(`測試時長: ${report.summary.test_duration_seconds.toFixed(1)} 秒`);
    console.log(`總API調用: ${report.summary.total_api_calls} 次`);
    console.log(`調用頻率: ${report.summary.calls_per_second} 次/秒`);
    console.log(`預估費用: $${report.summary.estimated_cost_usd.toFixed(4)} 美元`);
    console.log('====================================================\n');
    
    console.log('📊 API使用分解:');
    console.log(`  地址解析 (Geocoding): ${report.api_breakdown.geocoding} 次`);
    console.log(`  路線規劃 (Directions): ${report.api_breakdown.directions} 次`);
    console.log(`  靜態地圖 (Static Maps): ${report.api_breakdown.staticMaps} 次`);
    console.log(`  距離矩陣 (Distance Matrix): ${report.api_breakdown.distanceMatrix} 次`);
    console.log('');
    
    console.log('💰 費用分解:');
    console.log(`  地址解析費用: $${report.cost_analysis.geocoding_cost.toFixed(4)}`);
    console.log(`  路線規劃費用: $${report.cost_analysis.directions_cost.toFixed(4)}`);
    console.log(`  靜態地圖費用: $${report.cost_analysis.static_maps_cost.toFixed(4)}`);
    console.log(`  距離矩陣費用: $${report.cost_analysis.distance_matrix_cost.toFixed(4)}`);
    console.log(`  總費用: $${report.cost_analysis.total_cost.toFixed(4)}`);
    
    // 保存詳細報告
    fs.writeFileSync('google_maps_usage_report.json', JSON.stringify(report, null, 2));
    console.log('\n💾 詳細報告已保存到 google_maps_usage_report.json');
    
    return report;
}

// 執行測試
if (require.main === module) {
    runCompleteTest().catch(console.error);
}

module.exports = { GoogleMapsUsageTracker, runCompleteTest };