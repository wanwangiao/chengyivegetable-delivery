/**
 * 100筆訂單Google Maps API成本測試
 * 模擬外送員每次接15-30單不等，直到送完的API使用量和費用
 */

const GOOGLE_MAPS_PRICING = {
    // Google Maps API 定價 (USD)
    STATIC_MAPS: 0.002,       // $2 per 1000 requests
    GEOCODING: 0.005,         // $5 per 1000 requests
    DIRECTIONS: 0.005,        // $5 per 1000 requests
    JS_API_LOADS: 0.007,      // $7 per 1000 loads
    PLACES_API: 0.032         // $32 per 1000 requests (如果用到)
};

const FREE_MONTHLY_CREDIT = 200; // $200 USD免費額度

class GoogleMapsUsageCalculator {
    constructor() {
        this.totalUsage = {
            staticMaps: 0,
            geocoding: 0,
            directions: 0,
            jsApiLoads: 0,
            placesApi: 0
        };
        this.deliveryBatches = [];
        this.totalOrders = 0;
    }

    /**
     * 生成100筆測試訂單
     */
    generateTestOrders(count = 100) {
        const areas = ['三峽區', '樹林區', '鶯歌區', '土城區', '北大特區'];
        const customers = ['王小明', '李小華', '張小美', '陳小強', '林小芳', '黃大頭', '劉小花', '許志明', '楊淑芬', '吳建國'];
        const addresses = {
            '三峽區': [
                '新北市三峽區中山路123號', '新北市三峽區民權街45號', '新北市三峽區復興路67號',
                '新北市三峽區和平街89號', '新北市三峽區文化路101號', '新北市三峽區中正路234號'
            ],
            '樹林區': [
                '新北市樹林區中正路234號', '新北市樹林區民生街56號', '新北市樹林區文化路78號',
                '新北市樹林區保安街90號', '新北市樹林區中山路156號'
            ],
            '鶯歌區': [
                '新北市鶯歌區中山路345號', '新北市鶯歌區育英街67號', '新北市鶯歌區文化路123號',
                '新北市鶯歌區中正路78號'
            ],
            '土城區': [
                '新北市土城區中央路456號', '新北市土城區金城路89號', '新北市土城區學府路234號',
                '新北市土城區中山路167號'
            ],
            '北大特區': [
                '新北市三峽區大學路123號', '新北市三峽區北大路234號', '新北市三峽區學成路345號',
                '新北市三峽區學勤路456號', '新北市三峽區三樹路567號', '新北市三峽區學府路678號'
            ]
        };

        const orders = [];
        for (let i = 1; i <= count; i++) {
            const area = areas[Math.floor(Math.random() * areas.length)];
            const areaAddresses = addresses[area];
            const address = areaAddresses[Math.floor(Math.random() * areaAddresses.length)];
            
            orders.push({
                id: i,
                customer_name: customers[Math.floor(Math.random() * customers.length)],
                customer_phone: `09${String(Math.floor(Math.random() * 100000000)).padStart(8, '0')}`,
                address: address,
                area: area,
                delivery_fee: 50,
                created_at: new Date(Date.now() - Math.random() * 86400000 * 7), // 過去7天內
                items: [
                    { product_name: '高麗菜', quantity: Math.floor(Math.random() * 3) + 1, price: 30 },
                    { product_name: '白蘿蔔', quantity: Math.floor(Math.random() * 2) + 1, price: 25 }
                ]
            });
        }

        console.log(`✅ 已生成 ${count} 筆測試訂單`);
        return orders;
    }

    /**
     * 模擬外送員接單流程
     */
    simulateDeliveryProcess(orders) {
        let remainingOrders = [...orders];
        let batchNumber = 1;

        while (remainingOrders.length > 0) {
            // 隨機決定這次接單數量 (15-30單)
            const batchSize = Math.min(
                Math.floor(Math.random() * 16) + 15, // 15-30
                remainingOrders.length
            );
            
            const currentBatch = remainingOrders.splice(0, batchSize);
            
            console.log(`\n📦 第${batchNumber}批：外送員接取 ${currentBatch.length} 筆訂單`);
            console.log(`   剩餘訂單：${remainingOrders.length} 筆`);

            // 計算這批訂單的API使用量
            const batchUsage = this.calculateBatchApiUsage(currentBatch, batchNumber);
            
            this.deliveryBatches.push({
                batchNumber: batchNumber,
                orderCount: currentBatch.length,
                orders: currentBatch,
                apiUsage: batchUsage
            });

            // 累加總使用量
            Object.keys(batchUsage).forEach(key => {
                this.totalUsage[key] += batchUsage[key];
            });

            batchNumber++;
        }

        this.totalOrders = orders.length;
        console.log(`\n🎉 所有訂單處理完成！總共分 ${this.deliveryBatches.length} 批`);
    }

    /**
     * 計算單批次的API使用量
     */
    calculateBatchApiUsage(orders, batchNumber) {
        const usage = {
            staticMaps: 0,
            geocoding: 0,
            directions: 0,
            jsApiLoads: 0,
            placesApi: 0
        };

        // 1. 外送員查看地區訂單統計 (5個地區)
        usage.staticMaps += 0; // 不需要靜態地圖

        // 2. 外送員查看特定地區訂單
        const areas = [...new Set(orders.map(order => order.area))];
        console.log(`   📍 涉及地區: ${areas.join(', ')}`);

        // 3. 地理編碼 - 每個唯一地址需要geocoding
        const uniqueAddresses = [...new Set(orders.map(order => order.address))];
        usage.geocoding += uniqueAddresses.length;
        console.log(`   🗺️  地理編碼: ${uniqueAddresses.length} 個唯一地址`);

        // 4. 路線優化 - 使用Directions API
        // 假設使用Google Maps Directions API進行路線優化
        if (orders.length > 1) {
            // 基本路線規劃: 1次Directions API調用
            // 但Google Directions API限制最多25個waypoints
            const directionsRequests = Math.ceil(orders.length / 23); // 23個waypoints + 起終點
            usage.directions += directionsRequests;
            console.log(`   🧭 路線優化: ${directionsRequests} 次Directions API`);
        }

        // 5. 內嵌地圖顯示 - JavaScript API載入
        usage.jsApiLoads += 1; // 每批次載入一次
        console.log(`   💻 地圖載入: 1 次JavaScript API`);

        // 6. 靜態地圖URL生成 (用於分享或預覽)
        usage.staticMaps += 1;
        console.log(`   📷 靜態地圖: 1 張`);

        // 7. 外送員完成配送時可能需要的額外API
        // 例如：逆向地理編碼確認位置
        usage.geocoding += Math.floor(orders.length * 0.1); // 10%的訂單需要位置確認

        const batchTotal = 
            usage.staticMaps + usage.geocoding + 
            usage.directions + usage.jsApiLoads + usage.placesApi;
        
        console.log(`   📊 本批次API總調用: ${batchTotal} 次`);

        return usage;
    }

    /**
     * 計算總費用
     */
    calculateTotalCost() {
        const costs = {
            staticMaps: this.totalUsage.staticMaps * GOOGLE_MAPS_PRICING.STATIC_MAPS,
            geocoding: this.totalUsage.geocoding * GOOGLE_MAPS_PRICING.GEOCODING,
            directions: this.totalUsage.directions * GOOGLE_MAPS_PRICING.DIRECTIONS,
            jsApiLoads: this.totalUsage.jsApiLoads * GOOGLE_MAPS_PRICING.JS_API_LOADS,
            placesApi: this.totalUsage.placesApi * GOOGLE_MAPS_PRICING.PLACES_API
        };

        const totalCost = Object.values(costs).reduce((sum, cost) => sum + cost, 0);
        const netCost = Math.max(0, totalCost - FREE_MONTHLY_CREDIT);

        return { costs, totalCost, netCost };
    }

    /**
     * 生成詳細報告
     */
    generateReport() {
        console.log('\n' + '='.repeat(80));
        console.log('📊 Google Maps API 使用量和費用分析報告');
        console.log('='.repeat(80));

        console.log(`\n📦 測試概況:`);
        console.log(`   總訂單數: ${this.totalOrders} 筆`);
        console.log(`   外送批次: ${this.deliveryBatches.length} 批`);
        console.log(`   平均每批: ${Math.round(this.totalOrders / this.deliveryBatches.length)} 筆訂單`);

        console.log(`\n📊 API 使用統計:`);
        console.log(`   🗺️  Geocoding (地理編碼):     ${this.totalUsage.geocoding.toString().padStart(6)} 次`);
        console.log(`   🧭 Directions (路線規劃):     ${this.totalUsage.directions.toString().padStart(6)} 次`);
        console.log(`   💻 JavaScript API (地圖載入): ${this.totalUsage.jsApiLoads.toString().padStart(6)} 次`);
        console.log(`   📷 Static Maps (靜態地圖):    ${this.totalUsage.staticMaps.toString().padStart(6)} 次`);
        console.log(`   🔍 Places API (地點搜尋):     ${this.totalUsage.placesApi.toString().padStart(6)} 次`);

        const totalApiCalls = Object.values(this.totalUsage).reduce((sum, count) => sum + count, 0);
        console.log(`   📈 API 總調用次數:           ${totalApiCalls.toString().padStart(6)} 次`);

        const { costs, totalCost, netCost } = this.calculateTotalCost();

        console.log(`\n💰 費用明細 (USD):`);
        console.log(`   🗺️  Geocoding:     $${costs.geocoding.toFixed(4)} (${this.totalUsage.geocoding} × $0.005)`);
        console.log(`   🧭 Directions:     $${costs.directions.toFixed(4)} (${this.totalUsage.directions} × $0.005)`);
        console.log(`   💻 JavaScript API: $${costs.jsApiLoads.toFixed(4)} (${this.totalUsage.jsApiLoads} × $0.007)`);
        console.log(`   📷 Static Maps:    $${costs.staticMaps.toFixed(4)} (${this.totalUsage.staticMaps} × $0.002)`);
        console.log(`   🔍 Places API:     $${costs.placesApi.toFixed(4)} (${this.totalUsage.placesApi} × $0.032)`);
        
        console.log(`\n💵 費用總計:`);
        console.log(`   📊 總費用:         $${totalCost.toFixed(2)}`);
        console.log(`   🎁 免費額度:       -$${FREE_MONTHLY_CREDIT.toFixed(2)}`);
        console.log(`   💳 實際費用:       $${netCost.toFixed(2)} ${netCost === 0 ? '(免費!)' : ''}`);

        // 轉換為台幣 (假設匯率30)
        const twdRate = 30;
        console.log(`   🇹🇼 實際費用 (TWD): NT$${(netCost * twdRate).toFixed(0)}`);

        console.log(`\n📈 批次明細:`);
        this.deliveryBatches.forEach(batch => {
            const batchTotal = Object.values(batch.apiUsage).reduce((sum, count) => sum + count, 0);
            console.log(`   第${batch.batchNumber}批: ${batch.orderCount}筆訂單 → ${batchTotal}次API調用`);
        });

        console.log(`\n🎯 效率分析:`);
        console.log(`   平均每筆訂單API調用: ${(totalApiCalls / this.totalOrders).toFixed(2)} 次`);
        console.log(`   平均每筆訂單費用: $${(totalCost / this.totalOrders).toFixed(4)} (NT$${(totalCost * twdRate / this.totalOrders).toFixed(2)})`);

        console.log('\n' + '='.repeat(80));

        // 返回結果供進一步分析
        return {
            totalOrders: this.totalOrders,
            totalBatches: this.deliveryBatches.length,
            totalApiCalls,
            totalUsage: this.totalUsage,
            costs,
            totalCost,
            netCost,
            twdCost: netCost * twdRate
        };
    }
}

// 執行測試
async function runTest() {
    console.log('🚀 開始100筆訂單Google Maps API成本測試\n');
    
    const calculator = new GoogleMapsUsageCalculator();
    
    // 1. 生成100筆測試訂單
    const orders = calculator.generateTestOrders(100);
    
    // 2. 模擬外送員接單流程
    calculator.simulateDeliveryProcess(orders);
    
    // 3. 生成詳細報告
    const result = calculator.generateReport();
    
    // 4. 保存結果到檔案
    const fs = require('fs');
    const reportData = {
        timestamp: new Date().toISOString(),
        testConfig: {
            totalOrders: 100,
            batchSizeRange: '15-30',
            description: '外送員每次接15-30單不等，直到送完'
        },
        result: result,
        detailedBatches: calculator.deliveryBatches
    };
    
    fs.writeFileSync(
        'google_maps_api_cost_test_100_orders.json', 
        JSON.stringify(reportData, null, 2)
    );
    
    console.log('\n💾 測試結果已保存到: google_maps_api_cost_test_100_orders.json');
    
    return result;
}

// 如果直接執行此檔案
if (require.main === module) {
    runTest().catch(console.error);
}

module.exports = { GoogleMapsUsageCalculator, runTest };