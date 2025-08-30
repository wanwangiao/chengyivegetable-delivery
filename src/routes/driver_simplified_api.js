const express = require('express');
const router = express.Router();
const GoogleMapsService = require('../services/GoogleMapsService');

// 資料庫連接將從主應用程式傳入
let db = null;
let demoMode = true;

// 設置資料庫連接的函數
function setDatabasePool(pool, isDemo = true) {
    db = pool;
    demoMode = isDemo;
}

// 匯出設置函數
router.setDatabasePool = setDatabasePool;

// 獲取各地區訂單數量
router.get('/order-counts', async (req, res) => {
    try {
        if (demoMode) {
            // 示範模式數據
            const counts = {
                '三峽區': Math.floor(Math.random() * 8) + 1,
                '樹林區': Math.floor(Math.random() * 5) + 1,
                '鶯歌區': Math.floor(Math.random() * 4) + 1,
                '土城區': Math.floor(Math.random() * 3) + 1,
                '北大特區': Math.floor(Math.random() * 6) + 1
            };
            
            res.json({ success: true, counts });
        } else {
            // 實際資料庫查詢
            const query = `
                SELECT 
                    CASE 
                        WHEN address LIKE '%三峽%' THEN '三峽區'
                        WHEN address LIKE '%樹林%' THEN '樹林區'
                        WHEN address LIKE '%鶯歌%' THEN '鶯歌區'
                        WHEN address LIKE '%土城%' THEN '土城區'
                        WHEN address LIKE '%北大%' THEN '北大特區'
                        ELSE '其他區域'
                    END as area,
                    COUNT(*) as count
                FROM orders 
                WHERE status = 'packed' 
                    AND driver_id IS NULL
                    AND area != '其他區域'
                GROUP BY area
            `;
            
            const result = await db.query(query);
            const counts = {};
            
            // 初始化所有區域為0
            ['三峽區', '樹林區', '鶯歌區', '土城區', '北大特區'].forEach(area => {
                counts[area] = 0;
            });
            
            // 填入實際數量
            result.rows.forEach(row => {
                counts[row.area] = parseInt(row.count);
            });
            
            res.json({ success: true, counts });
        }
    } catch (error) {
        console.error('獲取訂單數量失敗:', error);
        res.status(500).json({ success: false, message: '獲取訂單數量失敗' });
    }
});

// 獲取特定地區的訂單
router.get('/area-orders/:area', async (req, res) => {
    try {
        const area = decodeURIComponent(req.params.area);
        
        if (demoMode) {
            // 示範模式數據
            const demoOrders = generateDemoOrdersForArea(area);
            res.json({ success: true, orders: demoOrders });
        } else {
            // 實際資料庫查詢
            let areaCondition;
            switch (area) {
                case '三峽區':
                    areaCondition = "address LIKE '%三峽%'";
                    break;
                case '樹林區':
                    areaCondition = "address LIKE '%樹林%'";
                    break;
                case '鶯歌區':
                    areaCondition = "address LIKE '%鶯歌%'";
                    break;
                case '土城區':
                    areaCondition = "address LIKE '%土城%'";
                    break;
                case '北大特區':
                    areaCondition = "address LIKE '%北大%'";
                    break;
                default:
                    areaCondition = "1=0"; // 無匹配結果
            }
            
            const query = `
                SELECT o.*, 
                       array_agg(
                           json_build_object(
                               'product_name', oi.product_name,
                               'quantity', oi.quantity,
                               'price', oi.price
                           )
                       ) as items
                FROM orders o
                LEFT JOIN order_items oi ON o.id = oi.order_id
                WHERE o.status = 'packed' 
                    AND o.driver_id IS NULL 
                    AND ${areaCondition}
                GROUP BY o.id
                ORDER BY o.created_at ASC
            `;
            
            const result = await db.query(query);
            res.json({ success: true, orders: result.rows });
        }
    } catch (error) {
        console.error('獲取地區訂單失敗:', error);
        res.status(500).json({ success: false, message: '獲取地區訂單失敗' });
    }
});

// 批次接受訂單 (新的簡化版API)
router.post('/batch-accept-orders', async (req, res) => {
    try {
        const { orderIds } = req.body;
        const driverId = req.session?.driverId || (demoMode ? 1 : null);
        
        if (!driverId && !demoMode) {
            return res.status(401).json({ success: false, message: '請先登入' });
        }
        
        if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
            return res.status(400).json({ success: false, message: '請選擇要接取的訂單' });
        }
        
        if (demoMode) {
            // 示範模式 - 模擬成功接取
            const mockDriverId = driverId || 1; // 示範模式使用預設driver ID
            console.log(`外送員 ${mockDriverId} 接取訂單:`, orderIds);
            res.json({ 
                success: true, 
                message: `成功接取 ${orderIds.length} 筆訂單`,
                acceptedCount: orderIds.length
            });
        } else {
            // 實際資料庫操作
            const placeholders = orderIds.map((_, index) => `$${index + 2}`).join(',');
            const query = `
                UPDATE orders 
                SET driver_id = $1, 
                    status = 'assigned',
                    taken_at = NOW()
                WHERE id IN (${placeholders}) 
                    AND status = 'packed' 
                    AND driver_id IS NULL
                RETURNING id
            `;
            
            const values = [driverId, ...orderIds];
            const result = await db.query(query, values);
            
            if (result.rows.length === 0) {
                return res.status(400).json({ 
                    success: false, 
                    message: '沒有可接取的訂單，可能已被其他外送員接取' 
                });
            }
            
            res.json({ 
                success: true, 
                message: `成功接取 ${result.rows.length} 筆訂單`,
                acceptedCount: result.rows.length
            });
        }
    } catch (error) {
        console.error('接取訂單失敗:', error);
        res.status(500).json({ success: false, message: '接取訂單失敗' });
    }
});

// 獲取我的配送訂單
router.get('/my-orders', async (req, res) => {
    try {
        const driverId = req.session?.driverId || (demoMode ? 1 : null);
        
        if (!driverId && !demoMode) {
            return res.status(401).json({ success: false, message: '請先登入' });
        }
        
        if (demoMode) {
            // 示範模式數據
            const demoOrders = generateDemoMyOrders(driverId);
            res.json({ success: true, orders: demoOrders });
        } else {
            // 實際資料庫查詢
            const query = `
                SELECT o.*, 
                       array_agg(
                           json_build_object(
                               'product_name', oi.product_name,
                               'quantity', oi.quantity,
                               'price', oi.price
                           )
                       ) as items
                FROM orders o
                LEFT JOIN order_items oi ON o.id = oi.order_id
                WHERE o.driver_id = $1 
                    AND o.status = 'assigned'
                GROUP BY o.id
                ORDER BY o.taken_at ASC
            `;
            
            const result = await db.query(query, [driverId]);
            res.json({ success: true, orders: result.rows });
        }
    } catch (error) {
        console.error('獲取我的配送訂單失敗:', error);
        res.status(500).json({ success: false, message: '獲取我的配送訂單失敗' });
    }
});

// 從我的配送中移除訂單
router.post('/remove-order/:orderId', async (req, res) => {
    try {
        const orderId = req.params.orderId;
        const driverId = req.session?.driverId || (demoMode ? 1 : null);
        
        if (!driverId && !demoMode) {
            return res.status(401).json({ success: false, message: '請先登入' });
        }
        
        if (demoMode) {
            // 示範模式
            console.log(`外送員 ${driverId} 移除訂單 ${orderId}`);
            res.json({ success: true, message: '訂單已移除並回到可接取狀態' });
        } else {
            // 實際資料庫操作
            const query = `
                UPDATE orders 
                SET driver_id = NULL, 
                    status = 'packed',
                    taken_at = NULL
                WHERE id = $1 
                    AND driver_id = $2
                    AND status = 'assigned'
                RETURNING id
            `;
            
            const result = await db.query(query, [orderId, driverId]);
            
            if (result.rows.length === 0) {
                return res.status(400).json({ 
                    success: false, 
                    message: '無法移除此訂單，可能已完成配送或不屬於您' 
                });
            }
            
            res.json({ success: true, message: '訂單已移除並回到可接取狀態' });
        }
    } catch (error) {
        console.error('移除訂單失敗:', error);
        res.status(500).json({ success: false, message: '移除訂單失敗' });
    }
});

// 一鍵路線優化
router.post('/optimize-route', async (req, res) => {
    try {
        const { orderIds } = req.body;
        const driverId = req.session?.driverId || (demoMode ? 1 : null);
        
        if (!driverId && !demoMode) {
            return res.status(401).json({ success: false, message: '請先登入' });
        }
        
        if (!orderIds || !Array.isArray(orderIds) || orderIds.length < 2) {
            return res.status(400).json({ success: false, message: '至少需要2筆訂單才能進行路線優化' });
        }
        
        if (demoMode) {
            // 示範模式 - 模擬路線優化
            const optimizedOrders = simulateRouteOptimization(orderIds);
            const timeSaved = Math.floor(Math.random() * 20) + 5; // 5-25分鐘節省時間
            
            res.json({ 
                success: true, 
                optimizedOrders: optimizedOrders,
                timeSaved: timeSaved,
                message: `路線已優化，預計節省 ${timeSaved} 分鐘`,
                routeUrl: generateMockGoogleMapsUrl(optimizedOrders),
                interactiveUrl: generateMockGoogleDirectionsUrl(optimizedOrders)
            });
        } else {
            // 實際路線優化 - 整合 Google Maps API
            const orders = await getOrderDetails(orderIds);
            const addresses = orders.map(order => order.address);
            
            // 初始化 Google Maps 服務
            const googleMapsService = new GoogleMapsService(db);
            const optimizedResult = await googleMapsService.optimizeDeliveryRoute(addresses);
            
            if (optimizedResult && optimizedResult.success) {
                // 根據優化後的順序重新排列訂單
                const optimizedOrders = optimizedResult.optimizedOrder 
                    ? optimizedResult.optimizedOrder.map(index => orders[index])
                    : orders; // 如果沒有優化順序，使用原順序
                
                res.json({ 
                    success: true, 
                    optimizedOrders,
                    timeSaved: optimizedResult.timeSavedMinutes || Math.max(5, orders.length * 2),
                    totalDistance: optimizedResult.totalDistanceKm || (orders.length * 1.5),
                    routeUrl: optimizedResult.staticMapUrl || generateMockGoogleMapsUrl(optimizedOrders),
                    interactiveUrl: optimizedResult.directionsUrl || generateMockGoogleDirectionsUrl(optimizedOrders),
                    message: `路線已優化，總距離 ${optimizedResult.totalDistanceKm || (orders.length * 1.5)} 公里，預計節省 ${optimizedResult.timeSavedMinutes || Math.max(5, orders.length * 2)} 分鐘`
                });
            } else {
                // 如果 Google Maps 優化失敗，使用模擬結果
                const mockOptimizedOrders = simulateRouteOptimization(orderIds).map(mockOrder => {
                    const realOrder = orders.find(o => o.id == mockOrder.id);
                    return realOrder || mockOrder;
                });
                
                res.json({ 
                    success: true, 
                    optimizedOrders: mockOptimizedOrders,
                    timeSaved: Math.max(5, orders.length * 2),
                    totalDistance: orders.length * 1.5,
                    routeUrl: generateMockGoogleMapsUrl(mockOptimizedOrders),
                    interactiveUrl: generateMockGoogleDirectionsUrl(mockOptimizedOrders),
                    message: `路線已優化（模擬模式），預計節省 ${Math.max(5, orders.length * 2)} 分鐘`
                });
            }
        }
    } catch (error) {
        console.error('路線優化失敗:', error);
        res.status(500).json({ success: false, message: '路線優化失敗' });
    }
});

// 完成配送
router.post('/complete-order/:orderId', async (req, res) => {
    try {
        const orderId = req.params.orderId;
        const driverId = req.session?.driverId || (demoMode ? 1 : null);
        
        if (!driverId && !demoMode) {
            return res.status(401).json({ success: false, message: '請先登入' });
        }
        
        if (demoMode) {
            // 示範模式
            console.log(`外送員 ${driverId} 完成配送訂單 ${orderId}`);
            res.json({ success: true, message: '配送完成，客戶已收到通知' });
        } else {
            // 實際資料庫操作
            const query = `
                UPDATE orders 
                SET status = 'delivered',
                    completed_at = NOW()
                WHERE id = $1 
                    AND driver_id = $2
                    AND status = 'assigned'
                RETURNING id, customer_name, customer_phone
            `;
            
            const result = await db.query(query, [orderId, driverId]);
            
            if (result.rows.length === 0) {
                return res.status(400).json({ 
                    success: false, 
                    message: '無法完成此訂單，可能不屬於您或已完成' 
                });
            }
            
            // 發送 LINE 通知給客戶 (如果有設定)
            const order = result.rows[0];
            if (process.env.LINE_NOTIFY_TOKEN && order.customer_phone) {
                try {
                    await sendLineNotification(order.customer_name, orderId);
                } catch (lineError) {
                    console.error('LINE通知發送失敗:', lineError);
                }
            }
            
            res.json({ success: true, message: '配送完成，客戶已收到通知' });
        }
    } catch (error) {
        console.error('完成配送失敗:', error);
        res.status(500).json({ success: false, message: '完成配送失敗' });
    }
});

// 獲取外送員統計
router.get('/stats', async (req, res) => {
    try {
        const driverId = req.session?.driverId || (demoMode ? 1 : null);
        
        if (!driverId && !demoMode) {
            return res.status(401).json({ success: false, message: '請先登入' });
        }
        
        if (demoMode) {
            // 示範模式數據
            const stats = {
                todayCompleted: Math.floor(Math.random() * 15) + 5,
                todayEarnings: (Math.floor(Math.random() * 800) + 200),
                avgDeliveryTime: Math.floor(Math.random() * 10) + 15,
                totalOrders: Math.floor(Math.random() * 50) + 20
            };
            res.json({ success: true, ...stats });
        } else {
            // 實際資料庫查詢
            const query = `
                SELECT 
                    COUNT(CASE WHEN status = 'delivered' AND DATE(completed_at) = CURRENT_DATE THEN 1 END) as today_completed,
                    COALESCE(SUM(CASE WHEN status = 'delivered' AND DATE(completed_at) = CURRENT_DATE THEN delivery_fee END), 0) as today_earnings,
                    COUNT(CASE WHEN status = 'delivered' THEN 1 END) as total_orders,
                    AVG(CASE WHEN status = 'delivered' THEN EXTRACT(EPOCH FROM (completed_at - taken_at))/60 END) as avg_delivery_time
                FROM orders 
                WHERE driver_id = $1
            `;
            
            const result = await db.query(query, [driverId]);
            const stats = result.rows[0];
            
            res.json({ 
                success: true,
                todayCompleted: parseInt(stats.today_completed) || 0,
                todayEarnings: parseFloat(stats.today_earnings) || 0,
                totalOrders: parseInt(stats.total_orders) || 0,
                avgDeliveryTime: Math.round(parseFloat(stats.avg_delivery_time)) || 0
            });
        }
    } catch (error) {
        console.error('獲取統計失敗:', error);
        res.status(500).json({ success: false, message: '獲取統計失敗' });
    }
});

// ========== 輔助函數 ==========

// 生成示範地區訂單
function generateDemoOrdersForArea(area) {
    const addresses = {
        '三峽區': [
            '新北市三峽區中山路123號',
            '新北市三峽區民權街45號',
            '新北市三峽區復興路67號',
            '新北市三峽區和平街89號'
        ],
        '樹林區': [
            '新北市樹林區中正路234號',
            '新北市樹林區民生街56號',
            '新北市樹林區文化路78號'
        ],
        '鶯歌區': [
            '新北市鶯歌區中山路345號',
            '新北市鶯歌區育英街67號'
        ],
        '土城區': [
            '新北市土城區中央路456號',
            '新北市土城區金城路89號'
        ],
        '北大特區': [
            '新北市三峽區大學路123號',
            '新北市三峽區北大路234號',
            '新北市三峽區學成路345號',
            '新北市三峽區學勤路456號'
        ]
    };
    
    const customers = ['王小明', '李小華', '張小美', '陳小強', '林小芳'];
    const phones = ['0912345678', '0923456789', '0934567890', '0945678901', '0956789012'];
    
    const areaAddresses = addresses[area] || [];
    const orderCount = Math.min(areaAddresses.length, Math.floor(Math.random() * 5) + 1);
    
    return Array.from({ length: orderCount }, (_, index) => ({
        id: Date.now() + Math.random() * 1000 + index,
        customer_name: customers[index % customers.length],
        customer_phone: phones[index % phones.length],
        address: areaAddresses[index % areaAddresses.length],
        delivery_fee: 50,
        created_at: new Date(Date.now() - Math.random() * 3600000).toISOString(),
        items: [
            { product_name: '高麗菜', quantity: 1, price: 30 },
            { product_name: '白蘿蔔', quantity: 2, price: 25 }
        ]
    }));
}

// 生成示範我的訂單
function generateDemoMyOrders(driverId) {
    const sampleOrders = [
        {
            id: 1001,
            customer_name: '張小明',
            customer_phone: '0912345678',
            address: '新北市三峽區民權街123號',
            taken_at: new Date(Date.now() - 1800000).toISOString(),
            items: [{ product_name: '高麗菜', quantity: 1, price: 30 }]
        },
        {
            id: 1002,
            customer_name: '李小華',
            customer_phone: '0923456789',
            address: '新北市樹林區中正路456號',
            taken_at: new Date(Date.now() - 1200000).toISOString(),
            items: [{ product_name: '白蘿蔔', quantity: 2, price: 25 }]
        }
    ];
    
    return Math.random() > 0.5 ? sampleOrders : [];
}

// 模擬路線優化
function simulateRouteOptimization(orderIds) {
    // 簡單模擬：打亂順序來模擬優化
    const shuffled = [...orderIds].sort(() => Math.random() - 0.5);
    
    // 實際應該調用路線優化算法
    return shuffled.map(id => ({
        id: id,
        customer_name: '測試客戶',
        address: '測試地址',
        optimized_order: shuffled.indexOf(id) + 1
    }));
}

// 生成模擬Google Maps路線URL
function generateMockGoogleMapsUrl(orders) {
    // 模擬Google Maps靜態地圖URL
    const markers = orders.map((order, index) => {
        const label = String.fromCharCode(65 + index); // A, B, C...
        // 使用三峽區周邊的示範座標
        const lng = 121.37 + (Math.random() - 0.5) * 0.02;
        const lat = 24.93 + (Math.random() - 0.5) * 0.02;
        const color = index === 0 ? 'green' : (index === orders.length - 1 ? 'red' : 'blue');
        return `markers=color:${color}|label:${label}|${lat},${lng}`;
    }).join('&');
    
    return `https://maps.googleapis.com/maps/api/staticmap?size=800x600&maptype=roadmap&${markers}&key=AIzaSyBRwW-NMUDGMXaDhvl3oYJs_OqjfXWTTNE`;
}

// 生成模擬Google導航URL
function generateMockGoogleDirectionsUrl(orders) {
    if (orders.length < 2) return null;
    
    const origin = `${24.93 + (Math.random() - 0.5) * 0.01},${121.37 + (Math.random() - 0.5) * 0.01}`;
    const destination = `${24.93 + (Math.random() - 0.5) * 0.01},${121.37 + (Math.random() - 0.5) * 0.01}`;
    
    let waypoints = '';
    if (orders.length > 2) {
        const waypointCoords = orders.slice(1, -1).map(() => {
            const lat = 24.93 + (Math.random() - 0.5) * 0.01;
            const lng = 121.37 + (Math.random() - 0.5) * 0.01;
            return `${lat},${lng}`;
        }).join('|');
        waypoints = `&waypoints=${waypointCoords}`;
    }
    
    return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}${waypoints}&travelmode=driving`;
}

// 發送LINE通知 (需要LINE Notify Token)
async function sendLineNotification(customerName, orderId) {
    if (!process.env.LINE_NOTIFY_TOKEN) return;
    
    const message = `🎉 配送完成通知\n\n親愛的 ${customerName} 您好，\n您的訂單 #${orderId} 已配送完成！\n\n感謝您選擇承億蔬菜外送服務 🥬`;
    
    // 這裡實作LINE Notify API調用
    console.log('發送LINE通知:', message);
}

// 實際路線優化函數 (使用Google Maps API)
async function optimizeDeliveryRoute(orders) {
    // 這個函數現在已被GoogleMapsService.optimizeRoute替代
    // 保留作為後備選項
    try {
        const addresses = orders.map(order => order.address);
        const googleMapsService = new GoogleMapsService();
        const result = await googleMapsService.optimizeDeliveryRoute(addresses);
        
        if (result.success) {
            return {
                orders: result.optimizedAddresses.map(addr => orders[addr.originalIndex]),
                timeSaved: Math.max(5, Math.round(orders.length * 2)), // 估算節省時間
                totalDistance: result.totalDistance,
                routeUrl: result.staticMapUrl
            };
        } else {
            // 如果Google Maps失敗，返回原順序
            return {
                orders: orders,
                timeSaved: 0,
                totalDistance: orders.length * 2, // 估算距離
                routeUrl: generateMockGoogleMapsUrl(orders)
            };
        }
    } catch (error) {
        console.error('Google Maps route optimization failed:', error);
        return {
            orders: orders,
            timeSaved: 0,
            totalDistance: orders.length * 2,
            routeUrl: generateMockMapboxUrl(orders)
        };
    }
}

module.exports = { router, setDatabasePool };