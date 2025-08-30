const fs = require('fs');

// 生成100筆真實的測試訂單數據
function generateTestOrders() {
    const areas = ['三峽區', '鶯歌區', '樹林區', '土城區', '板橋區'];
    const streets = [
        '中山路', '民權街', '復興路', '民生路', '中正路', 
        '文化路', '大學路', '學成路', '民族路', '建國路',
        '中華路', '光明路', '和平路', '自由路', '信義路'
    ];
    
    const customers = [
        '王小明', '李美華', '張志偉', '陳雅婷', '林建宏',
        '黃淑芬', '吳承恩', '劉怡君', '郭大偉', '蔡雅芳',
        '楊明智', '許文華', '謝淑媛', '游志強', '鄭美玲',
        '洪建成', '何雅真', '蕭志豪', '賴美珠', '薛文斌'
    ];
    
    const products = [
        { name: '有機高麗菜', price: 45, category: '葉菜類' },
        { name: '新鮮蘿蔔', price: 35, category: '根莖類' },
        { name: '當季蘋果', price: 120, category: '水果類' },
        { name: '香甜玉米', price: 25, category: '其他類' },
        { name: '青江菜', price: 30, category: '葉菜類' },
        { name: '紅蘿蔔', price: 40, category: '根莖類' },
        { name: '香蕉', price: 80, category: '水果類' },
        { name: '花椰菜', price: 55, category: '葉菜類' },
        { name: '地瓜', price: 45, category: '根莖類' },
        { name: '橘子', price: 90, category: '水果類' }
    ];
    
    const orders = [];
    
    for (let i = 1; i <= 100; i++) {
        const area = areas[Math.floor(Math.random() * areas.length)];
        const street = streets[Math.floor(Math.random() * streets.length)];
        const houseNumber = Math.floor(Math.random() * 500) + 1;
        const customer = customers[Math.floor(Math.random() * customers.length)];
        
        // 生成訂單商品 (1-5項)
        const itemCount = Math.floor(Math.random() * 5) + 1;
        const orderItems = [];
        let totalAmount = 0;
        
        for (let j = 0; j < itemCount; j++) {
            const product = products[Math.floor(Math.random() * products.length)];
            const quantity = Math.floor(Math.random() * 3) + 1;
            const itemTotal = product.price * quantity;
            
            orderItems.push({
                product_name: product.name,
                quantity: quantity,
                price: product.price,
                category: product.category,
                subtotal: itemTotal
            });
            
            totalAmount += itemTotal;
        }
        
        const order = {
            id: `test-order-${i.toString().padStart(3, '0')}`,
            customer_name: customer,
            phone: `09${Math.floor(Math.random() * 100000000).toString().padStart(8, '0')}`,
            address: `新北市${area}${street}${houseNumber}號`,
            area: area,
            coordinates: {
                lat: 24.93 + (Math.random() - 0.5) * 0.1,  // 三峽區附近
                lng: 121.37 + (Math.random() - 0.5) * 0.1
            },
            items: orderItems,
            total_amount: totalAmount,
            delivery_fee: 30,
            final_amount: totalAmount + 30,
            status: 'pending',
            created_at: new Date().toISOString(),
            priority: Math.floor(Math.random() * 3) + 1, // 1-3 優先級
            special_notes: Math.random() > 0.7 ? '請按電鈴' : '',
            delivery_time_preference: ['morning', 'afternoon', 'evening'][Math.floor(Math.random() * 3)]
        };
        
        orders.push(order);
    }
    
    return orders;
}

// 依據地區分組訂單
function groupOrdersByArea(orders) {
    const grouped = {};
    orders.forEach(order => {
        if (!grouped[order.area]) {
            grouped[order.area] = [];
        }
        grouped[order.area].push(order);
    });
    return grouped;
}

// 模擬外送員接單策略
function simulateDeliveryBatches(orders) {
    const batches = [];
    const groupedOrders = groupOrdersByArea(orders);
    
    console.log('\n📊 訂單地區分布:');
    Object.keys(groupedOrders).forEach(area => {
        console.log(`  ${area}: ${groupedOrders[area].length} 筆訂單`);
    });
    
    let remainingOrders = [...orders];
    let batchNumber = 1;
    
    while (remainingOrders.length > 0) {
        // 模擬外送員選擇策略：優先選擇同地區訂單
        const batchSize = Math.floor(Math.random() * 21) + 10; // 10-30單
        const batch = [];
        
        // 先選擇一個主要地區
        const availableAreas = [...new Set(remainingOrders.map(o => o.area))];
        const primaryArea = availableAreas[Math.floor(Math.random() * availableAreas.length)];
        
        // 優先從主要地區選擇訂單
        const primaryAreaOrders = remainingOrders.filter(o => o.area === primaryArea);
        const primaryCount = Math.min(primaryAreaOrders.length, Math.floor(batchSize * 0.7));
        
        for (let i = 0; i < primaryCount; i++) {
            const orderIndex = remainingOrders.findIndex(o => o.area === primaryArea);
            if (orderIndex !== -1) {
                batch.push(remainingOrders.splice(orderIndex, 1)[0]);
            }
        }
        
        // 再從其他地區補充訂單
        const remainingInBatch = Math.min(batchSize - batch.length, remainingOrders.length);
        for (let i = 0; i < remainingInBatch; i++) {
            batch.push(remainingOrders.splice(0, 1)[0]);
        }
        
        batches.push({
            batchNumber: batchNumber,
            driverId: `driver-${((batchNumber - 1) % 4) + 1}`, // 模擬4個外送員
            orders: batch,
            primaryArea: primaryArea,
            orderCount: batch.length,
            totalValue: batch.reduce((sum, order) => sum + order.final_amount, 0)
        });
        
        console.log(`\n🚛 批次 ${batchNumber}: ${batch.length} 筆訂單 (主要地區: ${primaryArea})`);
        
        batchNumber++;
        
        if (batchNumber > 10) break; // 防止無限迴圈
    }
    
    return batches;
}

// 主執行函數
function main() {
    console.log('🏭 開始生成100筆測試訂單...\n');
    
    const orders = generateTestOrders();
    const batches = simulateDeliveryBatches(orders);
    
    // 統計資訊
    const totalOrders = orders.length;
    const totalBatches = batches.length;
    const avgBatchSize = totalOrders / totalBatches;
    const totalValue = orders.reduce((sum, order) => sum + order.final_amount, 0);
    
    console.log('\n📈 測試數據統計:');
    console.log(`  總訂單數: ${totalOrders} 筆`);
    console.log(`  配送批次: ${totalBatches} 批`);
    console.log(`  平均批次大小: ${avgBatchSize.toFixed(1)} 筆/批`);
    console.log(`  訂單總價值: $${totalValue.toLocaleString()}`);
    
    // 保存數據
    const testData = {
        metadata: {
            generated_at: new Date().toISOString(),
            total_orders: totalOrders,
            total_batches: totalBatches,
            avg_batch_size: avgBatchSize,
            total_value: totalValue
        },
        orders: orders,
        batches: batches
    };
    
    fs.writeFileSync('test_orders_100.json', JSON.stringify(testData, null, 2));
    console.log('\n💾 測試數據已保存到 test_orders_100.json');
    
    return testData;
}

if (require.main === module) {
    main();
}

module.exports = { generateTestOrders, simulateDeliveryBatches };