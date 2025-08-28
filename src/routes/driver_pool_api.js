const express = require('express');
const router = express.Router();

// 中間件：確保司機已登入
function ensureDriver(req, res, next) {
    if (!req.session.driverId) {
        return res.status(401).json({ 
            success: false, 
            message: '請先登入' 
        });
    }
    next();
}

// 獲取指定區域的公共池訂單
router.get('/pool-orders/:district', ensureDriver, async (req, res) => {
    const { district } = req.params;
    const driverId = req.session.driverId;
    
    try {
        if (req.app.locals.demoMode) {
            // 示範模式資料
            const demoOrders = {
                '三峽區': [
                    {
                        id: 1,
                        contact_name: '張先生',
                        contact_phone: '0912345678',
                        address: '新北市三峽區大學路1號',
                        total_amount: 350.00,
                        payment_method: '現金',
                        notes: '請按電鈴',
                        pool_entered_at: new Date(Date.now() - 30 * 60000),
                        is_selected: false,
                        selected_by_driver: null
                    }
                ],
                '樹林區': [
                    {
                        id: 2,
                        contact_name: '林小姐',
                        contact_phone: '0987654321',
                        address: '新北市樹林區中山路100號',
                        total_amount: 280.00,
                        payment_method: 'LINE Pay',
                        notes: '放門口即可',
                        pool_entered_at: new Date(Date.now() - 45 * 60000),
                        is_selected: false,
                        selected_by_driver: null
                    }
                ],
                '土城區': [
                    {
                        id: 3,
                        contact_name: '陳太太',
                        contact_phone: '0955123456',
                        address: '新北市土城區中央路88號',
                        total_amount: 420.00,
                        payment_method: '現金',
                        notes: '2樓',
                        pool_entered_at: new Date(Date.now() - 20 * 60000),
                        is_selected: false,
                        selected_by_driver: null
                    }
                ],
                '鶯歌區': [
                    {
                        id: 4,
                        contact_name: '黃先生',
                        contact_phone: '0933987654',
                        address: '新北市鶯歌區文化路55號',
                        total_amount: 195.00,
                        payment_method: '信用卡',
                        notes: '請勿按電鈴',
                        pool_entered_at: new Date(Date.now() - 60 * 60000),
                        is_selected: false,
                        selected_by_driver: null
                    }
                ],
                '其他區域': []
            };
            
            return res.json({
                success: true,
                orders: demoOrders[district] || []
            });
        }
        
        // 使用資料庫函數獲取指定區域的訂單
        const { rows } = await req.app.locals.pool.query(
            'SELECT * FROM get_pool_orders_by_district($1)',
            [district]
        );
        
        // 檢查每個訂單是否已被當前司機選擇
        const orderIds = rows.map(order => order.id);
        let selectedByCurrentDriver = [];
        
        if (orderIds.length > 0) {
            const selectionQuery = await req.app.locals.pool.query(`
                SELECT order_id 
                FROM driver_order_selections 
                WHERE driver_id = $1 AND order_id = ANY($2) AND is_active = true
            `, [driverId, orderIds]);
            
            selectedByCurrentDriver = selectionQuery.rows.map(row => row.order_id);
        }
        
        // 標記哪些訂單被當前司機選中
        const ordersWithSelectionStatus = rows.map(order => ({
            ...order,
            is_selected_by_current_driver: selectedByCurrentDriver.includes(order.id)
        }));
        
        res.json({
            success: true,
            orders: ordersWithSelectionStatus,
            district,
            count: ordersWithSelectionStatus.length
        });
        
    } catch (error) {
        console.error(`獲取${district}公共池訂單失敗:`, error);
        res.status(500).json({
            success: false,
            message: '獲取訂單失敗',
            error: error.message
        });
    }
});

// 切換訂單選擇狀態
router.post('/toggle-order-selection/:orderId', ensureDriver, async (req, res) => {
    const orderId = parseInt(req.params.orderId);
    const driverId = req.session.driverId;
    const { district, action } = req.body;
    
    if (!orderId || !district || !action) {
        return res.status(400).json({
            success: false,
            message: '缺少必要參數'
        });
    }
    
    try {
        if (req.app.locals.demoMode) {
            return res.json({
                success: true,
                message: `示範模式：訂單 ${orderId} ${action === 'select' ? '已選擇' : '已取消選擇'}`,
                action,
                orderId
            });
        }
        
        const client = await req.app.locals.pool.connect();
        
        try {
            await client.query('BEGIN');
            
            // 檢查訂單是否存在且可用
            const orderCheck = await client.query(`
                SELECT id, contact_name, pool_status, selected_by_driver
                FROM orders 
                WHERE id = $1 AND pool_district = $2 AND status IN ('packed', 'ready')
            `, [orderId, district]);
            
            if (orderCheck.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(404).json({
                    success: false,
                    message: '訂單不存在或不可選擇'
                });
            }
            
            const order = orderCheck.rows[0];
            
            if (action === 'select') {
                // 檢查訂單是否已被其他司機選擇
                if (order.selected_by_driver && order.selected_by_driver !== driverId) {
                    await client.query('ROLLBACK');
                    return res.status(409).json({
                        success: false,
                        message: '此訂單已被其他外送員選擇'
                    });
                }
                
                // 選擇訂單
                await client.query(`
                    INSERT INTO driver_order_selections (driver_id, order_id, district, selected_at, is_active)
                    VALUES ($1, $2, $3, NOW(), true)
                    ON CONFLICT (driver_id, order_id) 
                    DO UPDATE SET is_active = true, selected_at = NOW()
                `, [driverId, orderId, district]);
                
                // 更新訂單狀態
                await client.query(`
                    UPDATE orders 
                    SET pool_status = 'selected', selected_by_driver = $1, selected_at = NOW()
                    WHERE id = $2
                `, [driverId, orderId]);
                
            } else if (action === 'deselect') {
                // 檢查是否為當前司機選擇的訂單
                if (order.selected_by_driver !== driverId) {
                    await client.query('ROLLBACK');
                    return res.status(403).json({
                        success: false,
                        message: '您無法取消其他司機選擇的訂單'
                    });
                }
                
                // 取消選擇
                await client.query(`
                    UPDATE driver_order_selections 
                    SET is_active = false 
                    WHERE driver_id = $1 AND order_id = $2 AND is_active = true
                `, [driverId, orderId]);
                
                // 更新訂單狀態
                await client.query(`
                    UPDATE orders 
                    SET pool_status = 'available', selected_by_driver = NULL, selected_at = NULL
                    WHERE id = $1
                `, [orderId]);
            }
            
            await client.query('COMMIT');
            
            // 廣播更新給其他司機 (如果有WebSocket管理器)
            if (req.app.locals.webSocketManager) {
                req.app.locals.webSocketManager.broadcastToDrivers({
                    type: 'order_selection_update',
                    orderId,
                    district,
                    action,
                    driverId,
                    timestamp: new Date().toISOString()
                });
            }
            
            res.json({
                success: true,
                message: action === 'select' ? '訂單已選擇' : '已取消選擇',
                action,
                orderId,
                district
            });
            
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
        
    } catch (error) {
        console.error('切換訂單選擇狀態失敗:', error);
        res.status(500).json({
            success: false,
            message: '操作失敗',
            error: error.message
        });
    }
});

// 選擇區域內所有可用訂單
router.post('/select-district-orders/:district', ensureDriver, async (req, res) => {
    const { district } = req.params;
    const driverId = req.session.driverId;
    
    try {
        if (req.app.locals.demoMode) {
            return res.json({
                success: true,
                message: `示範模式：已選擇${district}的所有訂單`,
                selectedCount: 2
            });
        }
        
        const client = await req.app.locals.pool.connect();
        
        try {
            await client.query('BEGIN');
            
            // 獲取區域內所有可用訂單
            const availableOrders = await client.query(`
                SELECT id, contact_name
                FROM orders 
                WHERE pool_district = $1 
                  AND status IN ('packed', 'ready')
                  AND pool_status = 'available'
                  AND (selected_by_driver IS NULL OR selected_by_driver = $2)
            `, [district, driverId]);
            
            if (availableOrders.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.json({
                    success: true,
                    message: `${district}沒有可選擇的訂單`,
                    selectedCount: 0
                });
            }
            
            const orderIds = availableOrders.rows.map(row => row.id);
            
            // 批量插入選擇記錄
            for (const orderId of orderIds) {
                await client.query(`
                    INSERT INTO driver_order_selections (driver_id, order_id, district, selected_at, is_active)
                    VALUES ($1, $2, $3, NOW(), true)
                    ON CONFLICT (driver_id, order_id) 
                    DO UPDATE SET is_active = true, selected_at = NOW()
                `, [driverId, orderId, district]);
            }
            
            // 批量更新訂單狀態
            await client.query(`
                UPDATE orders 
                SET pool_status = 'selected', selected_by_driver = $1, selected_at = NOW()
                WHERE id = ANY($2)
            `, [driverId, orderIds]);
            
            await client.query('COMMIT');
            
            // 廣播更新
            if (req.app.locals.webSocketManager) {
                req.app.locals.webSocketManager.broadcastToDrivers({
                    type: 'district_bulk_selection',
                    district,
                    orderIds,
                    driverId,
                    timestamp: new Date().toISOString()
                });
            }
            
            res.json({
                success: true,
                message: `已選擇${district}內 ${orderIds.length} 個訂單`,
                selectedCount: orderIds.length,
                orderIds
            });
            
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
        
    } catch (error) {
        console.error('批量選擇訂單失敗:', error);
        res.status(500).json({
            success: false,
            message: '批量選擇失敗',
            error: error.message
        });
    }
});

// 清空當前司機的所有選擇
router.post('/clear-all-selections', ensureDriver, async (req, res) => {
    const driverId = req.session.driverId;
    
    try {
        if (req.app.locals.demoMode) {
            return res.json({
                success: true,
                message: '示範模式：已清空所有選擇',
                clearedCount: 3
            });
        }
        
        const client = await req.app.locals.pool.connect();
        
        try {
            await client.query('BEGIN');
            
            // 獲取當前司機選擇的所有訂單
            const selectedOrders = await client.query(`
                SELECT order_id 
                FROM driver_order_selections 
                WHERE driver_id = $1 AND is_active = true
            `, [driverId]);
            
            if (selectedOrders.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.json({
                    success: true,
                    message: '沒有需要清空的選擇',
                    clearedCount: 0
                });
            }
            
            const orderIds = selectedOrders.rows.map(row => row.order_id);
            
            // 取消所有選擇
            await client.query(`
                UPDATE driver_order_selections 
                SET is_active = false 
                WHERE driver_id = $1 AND is_active = true
            `, [driverId]);
            
            // 重置訂單狀態
            await client.query(`
                UPDATE orders 
                SET pool_status = 'available', selected_by_driver = NULL, selected_at = NULL
                WHERE id = ANY($1) AND selected_by_driver = $2
            `, [orderIds, driverId]);
            
            await client.query('COMMIT');
            
            // 廣播更新
            if (req.app.locals.webSocketManager) {
                req.app.locals.webSocketManager.broadcastToDrivers({
                    type: 'all_selections_cleared',
                    orderIds,
                    driverId,
                    timestamp: new Date().toISOString()
                });
            }
            
            res.json({
                success: true,
                message: `已清空 ${orderIds.length} 個選擇`,
                clearedCount: orderIds.length,
                orderIds
            });
            
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
        
    } catch (error) {
        console.error('清空所有選擇失敗:', error);
        res.status(500).json({
            success: false,
            message: '清空選擇失敗',
            error: error.message
        });
    }
});

// 獲取訂單詳細資訊
router.get('/order-detail/:orderId', ensureDriver, async (req, res) => {
    const orderId = parseInt(req.params.orderId);
    
    try {
        if (req.app.locals.demoMode) {
            return res.json({
                success: true,
                data: {
                    id: orderId,
                    contact_name: '張先生',
                    contact_phone: '0912345678',
                    address: '新北市三峽區大學路1號',
                    total_amount: 350.00,
                    payment_method: '現金',
                    notes: '請按電鈴',
                    created_at: new Date(Date.now() - 2 * 3600000),
                    pool_entered_at: new Date(Date.now() - 30 * 60000),
                    items: [
                        { product_name: '青江菜', quantity: 2, price: 80 },
                        { product_name: '白蘿蔔', quantity: 1, price: 120 },
                        { product_name: '紅蘿蔔', quantity: 3, price: 150 }
                    ]
                }
            });
        }
        
        // 獲取訂單基本資訊
        const orderQuery = await req.app.locals.pool.query(`
            SELECT o.*, u.line_user_id, u.line_display_name
            FROM orders o
            LEFT JOIN users u ON o.contact_phone = u.phone
            WHERE o.id = $1
        `, [orderId]);
        
        if (orderQuery.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: '訂單不存在'
            });
        }
        
        const order = orderQuery.rows[0];
        
        // 獲取訂單商品明細
        const itemsQuery = await req.app.locals.pool.query(`
            SELECT oi.*, p.name as product_name, p.image_url
            FROM order_items oi
            LEFT JOIN products p ON oi.product_id = p.id
            WHERE oi.order_id = $1
            ORDER BY oi.id
        `, [orderId]);
        
        const orderDetail = {
            ...order,
            items: itemsQuery.rows || []
        };
        
        res.json({
            success: true,
            data: orderDetail
        });
        
    } catch (error) {
        console.error('獲取訂單詳情失敗:', error);
        res.status(500).json({
            success: false,
            message: '獲取訂單詳情失敗',
            error: error.message
        });
    }
});

// 獲取當前司機的選擇統計
router.get('/selection-stats', ensureDriver, async (req, res) => {
    const driverId = req.session.driverId;
    
    try {
        if (req.app.locals.demoMode) {
            return res.json({
                success: true,
                stats: {
                    selectedCount: 3,
                    totalValue: 850.00,
                    districts: ['三峽區', '樹林區'],
                    estimatedTime: 36
                }
            });
        }
        
        const { rows } = await req.app.locals.pool.query(`
            SELECT 
                COUNT(dos.id) as selected_count,
                COALESCE(SUM(o.total_amount), 0) as total_value,
                COUNT(DISTINCT dos.district) as district_count,
                ARRAY_AGG(DISTINCT dos.district) as districts
            FROM driver_order_selections dos
            LEFT JOIN orders o ON dos.order_id = o.id
            WHERE dos.driver_id = $1 AND dos.is_active = true
        `, [driverId]);
        
        const stats = rows[0];
        const estimatedTime = parseInt(stats.selected_count) * 12; // 平均每單12分鐘
        
        res.json({
            success: true,
            stats: {
                selectedCount: parseInt(stats.selected_count),
                totalValue: parseFloat(stats.total_value),
                districts: stats.districts || [],
                districtCount: parseInt(stats.district_count),
                estimatedTime
            }
        });
        
    } catch (error) {
        console.error('獲取選擇統計失敗:', error);
        res.status(500).json({
            success: false,
            message: '獲取統計失敗',
            error: error.message
        });
    }
});

// 獲取公共池總體統計
router.get('/pool-stats', ensureDriver, async (req, res) => {
    try {
        if (req.app.locals.demoMode) {
            return res.json({
                success: true,
                stats: [
                    { district: '三峽區', total_orders: 5, available_orders: 3, total_value: 1250.00 },
                    { district: '樹林區', total_orders: 3, available_orders: 2, total_value: 680.00 },
                    { district: '土城區', total_orders: 4, available_orders: 4, total_value: 920.00 },
                    { district: '鶯歌區', total_orders: 2, available_orders: 1, total_value: 380.00 }
                ]
            });
        }
        
        const { rows } = await req.app.locals.pool.query(
            'SELECT * FROM public_pool_stats ORDER BY district'
        );
        
        res.json({
            success: true,
            stats: rows
        });
        
    } catch (error) {
        console.error('獲取公共池統計失敗:', error);
        res.status(500).json({
            success: false,
            message: '獲取統計失敗',
            error: error.message
        });
    }
});

// 一鍵路線優化
router.post('/optimize-route', ensureDriver, async (req, res) => {
    const driverId = req.session.driverId;
    const { orderIds, optimizationGoal, startLocation } = req.body;
    
    if (!orderIds || orderIds.length < 2) {
        return res.status(400).json({
            success: false,
            message: '至少需要選擇2個訂單才能進行路線優化'
        });
    }
    
    try {
        if (req.app.locals.demoMode) {
            // 示範模式返回模擬結果
            const demoRoute = orderIds.map((orderId, index) => ({
                orderId,
                customerName: `客戶${index + 1}`,
                address: `地址${index + 1}`,
                distanceFromPrevious: Math.random() * 5 + 1,
                estimatedArrival: new Date(Date.now() + (index + 1) * 15 * 60000).toLocaleTimeString('zh-TW', {
                    hour: '2-digit',
                    minute: '2-digit'
                }),
                amount: Math.floor(Math.random() * 300 + 150)
            }));
            
            return res.json({
                success: true,
                optimization: {
                    totalDistance: 12.5,
                    totalTime: orderIds.length * 15,
                    timeSaved: 8,
                    route: demoRoute
                }
            });
        }
        
        // 獲取司機選中的訂單詳細資訊
        const orderData = await req.app.locals.pool.query(
            'SELECT * FROM prepare_route_optimization($1)',
            [driverId]
        );
        
        if (orderData.rows.length === 0) {
            return res.status(400).json({
                success: false,
                message: '沒有找到選中的訂單'
            });
        }
        
        const orders = orderData.rows;
        const defaultStartLocation = startLocation || {
            address: '新北市三峽區民生街186號',
            lat: 24.934154,
            lng: 121.368540
        };
        
        // 準備路線優化數據
        const locations = [
            {
                id: 'start',
                name: '起始點',
                address: defaultStartLocation.address,
                lat: defaultStartLocation.lat,
                lng: defaultStartLocation.lng,
                isStart: true
            },
            ...orders.map(order => ({
                id: order.order_id,
                name: order.customer_name,
                address: order.address,
                lat: parseFloat(order.lat),
                lng: parseFloat(order.lng),
                amount: parseFloat(order.total_amount),
                phone: order.phone,
                paymentMethod: order.payment_method,
                notes: order.notes,
                district: order.district
            }))
        ];
        
        // 調用TSP優化算法
        const optimizedRoute = await optimizeDeliveryRoute(locations, optimizationGoal);
        
        // 計算路線統計
        const routeStats = calculateRouteStats(optimizedRoute, locations);
        
        // 保存優化結果到資料庫
        const batchId = await saveOptimizationBatch(driverId, optimizedRoute, routeStats, req.app.locals.pool);
        
        res.json({
            success: true,
            optimization: {
                batchId,
                totalDistance: routeStats.totalDistance,
                totalTime: routeStats.totalTime,
                timeSaved: routeStats.timeSaved,
                route: optimizedRoute.slice(1), // 排除起始點
                startLocation: defaultStartLocation
            }
        });
        
    } catch (error) {
        console.error('路線優化失敗:', error);
        res.status(500).json({
            success: false,
            message: '路線優化失敗',
            error: error.message
        });
    }
});

// 確認優化路線並開始配送
router.post('/confirm-route', ensureDriver, async (req, res) => {
    const driverId = req.session.driverId;
    
    try {
        if (req.app.locals.demoMode) {
            return res.json({
                success: true,
                message: '示範模式：路線已確認',
                batchId: 'demo-batch-001'
            });
        }
        
        const client = await req.app.locals.pool.connect();
        
        try {
            await client.query('BEGIN');
            
            // 獲取最新的優化批次
            const batchQuery = await client.query(`
                SELECT id, total_orders, status
                FROM route_optimization_batches
                WHERE driver_id = $1 AND status = 'planned'
                ORDER BY created_at DESC
                LIMIT 1
            `, [driverId]);
            
            if (batchQuery.rows.length === 0) {
                throw new Error('沒有找到待確認的路線');
            }
            
            const batch = batchQuery.rows[0];
            const batchId = batch.id;
            
            // 更新批次狀態為執行中
            await client.query(`
                UPDATE route_optimization_batches
                SET status = 'executing', started_at = NOW()
                WHERE id = $1
            `, [batchId]);
            
            // 獲取路線中的所有訂單
            const routeOrders = await client.query(`
                SELECT order_id
                FROM route_optimization_routes
                WHERE batch_id = $1
                ORDER BY route_sequence
            `, [batchId]);
            
            const orderIds = routeOrders.rows.map(row => row.order_id);
            
            // 將訂單狀態從公共池移到已分配
            await client.query(`
                UPDATE orders
                SET status = 'assigned', driver_id = $1, assigned_at = NOW(),
                    pool_status = 'executing'
                WHERE id = ANY($2)
            `, [driverId, orderIds]);
            
            // 更新司機狀態
            await client.query(`
                UPDATE drivers
                SET status = 'delivering'
                WHERE id = $1
            `, [driverId]);
            
            // 發送通知給客戶
            for (const orderId of orderIds) {
                const orderInfo = await client.query(`
                    SELECT contact_phone, contact_name
                    FROM orders
                    WHERE id = $1
                `, [orderId]);
                
                if (orderInfo.rows.length > 0) {
                    const customer = orderInfo.rows[0];
                    await client.query(`
                        INSERT INTO notifications (type, recipient_type, recipient_id, title, message, order_id)
                        VALUES ('route_optimized', 'customer', $1, '配送路線已優化', '您的訂單已納入優化路線，外送員將依最佳順序配送', $2)
                    `, [customer.contact_phone, orderId]);
                }
            }
            
            await client.query('COMMIT');
            
            res.json({
                success: true,
                message: '路線已確認，開始配送',
                batchId,
                orderCount: orderIds.length
            });
            
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
        
    } catch (error) {
        console.error('確認路線失敗:', error);
        res.status(500).json({
            success: false,
            message: '確認路線失敗',
            error: error.message
        });
    }
});

// TSP優化算法實現
async function optimizeDeliveryRoute(locations, optimizationGoal = 'time') {
    if (locations.length <= 2) {
        return locations;
    }
    
    const startPoint = locations.find(loc => loc.isStart);
    const deliveryPoints = locations.filter(loc => !loc.isStart);
    
    // 計算距離矩陣
    const distanceMatrix = await calculateDistanceMatrix(locations);
    
    // 應用最近鄰算法 (簡化版TSP)
    const optimizedSequence = nearestNeighborTSP(startPoint, deliveryPoints, distanceMatrix, optimizationGoal);
    
    return optimizedSequence;
}

// 最近鄰TSP算法
function nearestNeighborTSP(start, points, distanceMatrix, goal) {
    const route = [start];
    const remaining = [...points];
    let current = start;
    
    while (remaining.length > 0) {
        let nearest = null;
        let bestValue = Infinity;
        
        for (const point of remaining) {
            let value;
            if (goal === 'distance') {
                value = getDistance(current, point, distanceMatrix);
            } else {
                // 預設為時間優化，考慮距離和等待時間
                const distance = getDistance(current, point, distanceMatrix);
                const waitingTime = getWaitingTimePenalty(point);
                value = distance + waitingTime * 0.5; // 等待時間權重
            }
            
            if (value < bestValue) {
                bestValue = value;
                nearest = point;
            }
        }
        
        if (nearest) {
            route.push(nearest);
            remaining.splice(remaining.indexOf(nearest), 1);
            current = nearest;
        }
    }
    
    return route;
}

// 計算距離矩陣 (簡化版，使用直線距離)
async function calculateDistanceMatrix(locations) {
    const matrix = {};
    
    for (const from of locations) {
        matrix[from.id] = {};
        for (const to of locations) {
            if (from.id === to.id) {
                matrix[from.id][to.id] = 0;
            } else {
                matrix[from.id][to.id] = calculateHaversineDistance(
                    from.lat, from.lng, to.lat, to.lng
                );
            }
        }
    }
    
    return matrix;
}

// 計算兩點間直線距離 (Haversine公式)
function calculateHaversineDistance(lat1, lng1, lat2, lng2) {
    const R = 6371; // 地球半徑 (公里)
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;
    return distance;
}

// 獲取距離
function getDistance(from, to, distanceMatrix) {
    return distanceMatrix[from.id] && distanceMatrix[from.id][to.id] || 0;
}

// 計算等待時間懲罰
function getWaitingTimePenalty(point) {
    // 這裡可以根據訂單等待時間給予不同權重
    return 0; // 簡化版本
}

// 計算路線統計
function calculateRouteStats(route, allLocations) {
    let totalDistance = 0;
    let totalTime = 0;
    
    for (let i = 1; i < route.length; i++) {
        const from = route[i - 1];
        const to = route[i];
        const distance = calculateHaversineDistance(from.lat, from.lng, to.lat, to.lng);
        totalDistance += distance;
        totalTime += Math.round(distance * 4 + 8); // 假設4分鐘/公里 + 8分鐘配送時間
    }
    
    // 估算節省的時間 (與隨機順序比較)
    const randomTime = totalTime * 1.3; // 假設隨機順序多30%時間
    const timeSaved = Math.max(0, Math.round(randomTime - totalTime));
    
    return {
        totalDistance: Math.round(totalDistance * 10) / 10,
        totalTime: Math.round(totalTime),
        timeSaved
    };
}

// 保存優化批次到資料庫
async function saveOptimizationBatch(driverId, route, stats, pool) {
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        // 創建優化批次
        const batchResult = await client.query(`
            INSERT INTO route_optimization_batches 
            (driver_id, batch_name, total_orders, total_distance, estimated_total_time, optimization_method, status)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id
        `, [
            driverId,
            `優化路線_${new Date().toLocaleString('zh-TW')}`,
            route.length - 1, // 排除起始點
            stats.totalDistance,
            stats.totalTime,
            'tsp',
            'planned'
        ]);
        
        const batchId = batchResult.rows[0].id;
        
        // 保存路線詳細資訊
        for (let i = 1; i < route.length; i++) { // 從1開始，排除起始點
            const location = route[i];
            const estimatedArrival = new Date(Date.now() + i * 15 * 60000); // 每15分鐘一站
            
            await client.query(`
                INSERT INTO route_optimization_routes 
                (batch_id, order_id, route_sequence, estimated_travel_time, estimated_arrival_time, distance_from_previous)
                VALUES ($1, $2, $3, $4, $5, $6)
            `, [
                batchId,
                location.id,
                i,
                15, // 估算15分鐘每站
                estimatedArrival,
                i === 1 ? 0 : calculateHaversineDistance(route[i-1].lat, route[i-1].lng, location.lat, location.lng)
            ]);
        }
        
        await client.query('COMMIT');
        return batchId;
        
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

// 測試地址區域識別
router.post('/test-address-detection', ensureDriver, async (req, res) => {
    const { address } = req.body;
    
    if (!address) {
        return res.status(400).json({
            success: false,
            message: '請提供地址'
        });
    }
    
    try {
        if (req.app.locals.demoMode) {
            // 示範模式簡單識別
            let district = '其他區域';
            if (address.includes('三峽') || address.includes('北大')) district = '三峽區';
            else if (address.includes('樹林')) district = '樹林區';
            else if (address.includes('土城')) district = '土城區';
            else if (address.includes('鶯歌')) district = '鶯歌區';
            
            return res.json({
                success: true,
                address,
                detectedDistrict: district,
                confidence: 'high'
            });
        }
        
        // 使用資料庫函數進行識別
        const result = await req.app.locals.pool.query(
            'SELECT get_district_from_address($1) as district',
            [address]
        );
        
        const district = result.rows[0].district;
        
        // 獲取匹配的關鍵字詳細資訊
        const matchDetails = await getDistrictMatchDetails(address, req.app.locals.pool);
        
        res.json({
            success: true,
            address,
            detectedDistrict: district,
            matchDetails,
            confidence: matchDetails.length > 0 ? 'high' : 'low'
        });
        
    } catch (error) {
        console.error('地址區域識別失敗:', error);
        res.status(500).json({
            success: false,
            message: '識別失敗',
            error: error.message
        });
    }
});

// 批次更新訂單區域
router.post('/batch-update-districts', ensureDriver, async (req, res) => {
    try {
        if (req.app.locals.demoMode) {
            return res.json({
                success: true,
                message: '示範模式：已更新所有訂單區域',
                updatedCount: 10
            });
        }
        
        const client = await req.app.locals.pool.connect();
        
        try {
            await client.query('BEGIN');
            
            // 獲取所有沒有區域標記的訂單
            const ordersToUpdate = await client.query(`
                SELECT id, address
                FROM orders
                WHERE pool_district IS NULL OR pool_district = ''
                  AND status IN ('packed', 'ready', 'confirmed', 'preparing')
            `);
            
            let updatedCount = 0;
            
            // 批次更新區域
            for (const order of ordersToUpdate.rows) {
                const districtResult = await client.query(
                    'SELECT get_district_from_address($1) as district',
                    [order.address]
                );
                
                const district = districtResult.rows[0].district;
                
                await client.query(`
                    UPDATE orders 
                    SET pool_district = $1
                    WHERE id = $2
                `, [district, order.id]);
                
                updatedCount++;
            }
            
            await client.query('COMMIT');
            
            res.json({
                success: true,
                message: `已更新 ${updatedCount} 個訂單的區域標記`,
                updatedCount
            });
            
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
        
    } catch (error) {
        console.error('批次更新區域失敗:', error);
        res.status(500).json({
            success: false,
            message: '批次更新失敗',
            error: error.message
        });
    }
});

// 取得地址匹配詳細資訊
async function getDistrictMatchDetails(address, pool) {
    try {
        const result = await pool.query(`
            SELECT district, keywords, priority
            FROM address_district_mapping
            WHERE is_active = true
            ORDER BY priority ASC
        `);
        
        const matchDetails = [];
        
        for (const mapping of result.rows) {
            for (const keyword of mapping.keywords) {
                if (address.toLowerCase().includes(keyword.toLowerCase())) {
                    matchDetails.push({
                        district: mapping.district,
                        keyword: keyword,
                        priority: mapping.priority
                    });
                    break; // 每個區域只需要找到一個匹配關鍵字
                }
            }
        }
        
        return matchDetails;
        
    } catch (error) {
        console.error('獲取匹配詳細資訊失敗:', error);
        return [];
    }
}

// WebSocket 支援：獲取實時更新
router.get('/realtime-updates', ensureDriver, (req, res) => {
    // 設定Server-Sent Events
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
    });
    
    const driverId = req.session.driverId;
    
    // 發送初始連接確認
    res.write(`data: ${JSON.stringify({
        type: 'connection_established',
        driverId,
        timestamp: new Date().toISOString()
    })}\n\n`);
    
    // 註冊到WebSocket管理器（如果存在）
    if (req.app.locals.webSocketManager) {
        req.app.locals.webSocketManager.addDriverSSEConnection(driverId, res);
    }
    
    // 每30秒發送心跳
    const heartbeat = setInterval(() => {
        res.write(`data: ${JSON.stringify({
            type: 'heartbeat',
            timestamp: new Date().toISOString()
        })}\n\n`);
    }, 30000);
    
    // 清理連接
    req.on('close', () => {
        clearInterval(heartbeat);
        if (req.app.locals.webSocketManager) {
            req.app.locals.webSocketManager.removeDriverSSEConnection(driverId);
        }
    });
});

module.exports = router;