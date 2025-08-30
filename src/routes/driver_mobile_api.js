const express = require('express');
const router = express.Router();
const GoogleMapsService = require('../services/GoogleMapsService');

// 模擬訂單資料（實際應從資料庫獲取）
const mockOrders = [
    {
        id: 'order-001',
        customer: '張小明',
        address: '新北市三峽區中山路123號 4樓',
        phone: '0912-345-678',
        items: ['高麗菜 1顆', '白蘿蔔 1條'],
        status: 'delivering', // pending, accepted, delivering, completed
        coordinates: { lat: 24.9342, lng: 121.3706 },
        completedTime: null
    },
    {
        id: 'order-002',
        customer: '陳志明',
        address: '新北市三峽區學成路89號',
        phone: '0923-456-789',
        items: ['青江菜 2把', '番茄 3顆'],
        status: 'accepted',
        coordinates: { lat: 24.9385, lng: 121.3652 },
        completedTime: null
    },
    {
        id: 'order-003',
        customer: '林雅婷',
        address: '新北市三峽區中華路156號 2樓',
        phone: '0934-567-890',
        items: ['菠菜 1把', '胡蘿蔔 2條'],
        status: 'accepted',
        coordinates: { lat: 24.9298, lng: 121.3758 },
        completedTime: null
    },
    {
        id: 'order-004',
        customer: '王大華',
        address: '新北市三峽區民權街45號',
        phone: '0945-678-901',
        items: ['大白菜 1顆', '洋蔥 2顆'],
        status: 'completed',
        coordinates: { lat: 24.9315, lng: 121.3689 },
        completedTime: '2025-08-30T10:30:00Z'
    },
    {
        id: 'order-005',
        customer: '李美玲',
        address: '新北市三峽區復興路67號',
        phone: '0956-789-012',
        items: ['韭菜 1把', '茄子 2條'],
        status: 'completed',
        coordinates: { lat: 24.9376, lng: 121.3725 },
        completedTime: '2025-08-30T09:45:00Z'
    }
];

/**
 * 獲取外送員當前配送狀態
 */
router.get('/delivery-status', (req, res) => {
    try {
        const currentOrder = mockOrders.find(order => order.status === 'delivering');
        const acceptedOrders = mockOrders.filter(order => order.status === 'accepted');
        const completedOrders = mockOrders.filter(order => order.status === 'completed')
            .sort((a, b) => new Date(b.completedTime) - new Date(a.completedTime));
        
        const stats = {
            total: mockOrders.length,
            completed: completedOrders.length,
            remaining: acceptedOrders.length + (currentOrder ? 1 : 0)
        };
        
        res.json({
            success: true,
            currentOrder: currentOrder || null,
            acceptedOrders,
            completedOrders,
            stats
        });
    } catch (error) {
        console.error('獲取配送狀態錯誤:', error);
        res.status(500).json({ success: false, message: '無法獲取配送狀態' });
    }
});

/**
 * 計算到目標地址的距離和時間
 */
router.post('/calculate-route', async (req, res) => {
    try {
        const { currentLocation, destination } = req.body;
        
        if (!currentLocation || !destination) {
            return res.status(400).json({ 
                success: false, 
                message: '缺少位置資訊' 
            });
        }
        
        // 使用 Google Maps 計算路線
        const routeResult = await GoogleMapsService.calculateRoute(
            `${currentLocation.lat},${currentLocation.lng}`,
            destination
        );
        
        if (routeResult.success) {
            res.json({
                success: true,
                distance: routeResult.distance,
                duration: routeResult.duration,
                route: routeResult.route
            });
        } else {
            res.status(400).json({
                success: false,
                message: '無法計算路線'
            });
        }
    } catch (error) {
        console.error('路線計算錯誤:', error);
        res.status(500).json({ 
            success: false, 
            message: '路線計算失敗' 
        });
    }
});

/**
 * 完成當前配送訂單
 */
router.post('/complete-delivery/:orderId', (req, res) => {
    try {
        const { orderId } = req.params;
        const { driverId = 'demo-driver' } = req.body;
        
        const orderIndex = mockOrders.findIndex(order => order.id === orderId);
        
        if (orderIndex === -1) {
            return res.status(404).json({
                success: false,
                message: '找不到該訂單'
            });
        }
        
        const order = mockOrders[orderIndex];
        
        if (order.status !== 'delivering') {
            return res.status(400).json({
                success: false,
                message: '該訂單不在配送狀態'
            });
        }
        
        // 更新訂單狀態
        mockOrders[orderIndex].status = 'completed';
        mockOrders[orderIndex].completedTime = new Date().toISOString();
        mockOrders[orderIndex].completedBy = driverId;
        
        // 檢查是否有待配送訂單，自動開始下一筆
        const nextOrder = mockOrders.find(order => order.status === 'accepted');
        let nextOrderInfo = null;
        
        if (nextOrder) {
            nextOrder.status = 'delivering';
            nextOrderInfo = {
                id: nextOrder.id,
                customer: nextOrder.customer,
                address: nextOrder.address,
                coordinates: nextOrder.coordinates
            };
        }
        
        res.json({
            success: true,
            message: '配送完成！',
            completedOrder: {
                id: order.id,
                customer: order.customer
            },
            nextOrder: nextOrderInfo,
            hasMoreOrders: !!nextOrder
        });
        
    } catch (error) {
        console.error('完成配送錯誤:', error);
        res.status(500).json({
            success: false,
            message: '完成配送失敗'
        });
    }
});

/**
 * 獲取優化後的配送路線
 */
router.post('/optimize-delivery-route', async (req, res) => {
    try {
        const { currentLocation, orderIds } = req.body;
        
        if (!currentLocation) {
            return res.status(400).json({
                success: false,
                message: '缺少當前位置資訊'
            });
        }
        
        // 獲取指定的訂單
        const ordersToOptimize = orderIds ? 
            mockOrders.filter(order => orderIds.includes(order.id)) :
            mockOrders.filter(order => order.status === 'accepted' || order.status === 'delivering');
        
        if (ordersToOptimize.length === 0) {
            return res.json({
                success: true,
                optimizedRoute: [],
                totalDistance: 0,
                totalDuration: 0,
                message: '沒有需要優化的訂單'
            });
        }
        
        // 準備地址陣列（包含當前位置）
        const addresses = [
            `${currentLocation.lat},${currentLocation.lng}`, // 起點
            ...ordersToOptimize.map(order => order.address)
        ];
        
        // 使用 Google Maps 優化路線
        const optimizationResult = await GoogleMapsService.optimizeRoute(addresses);
        
        if (optimizationResult.success) {
            // 根據優化結果重新排序訂單
            const optimizedOrders = optimizationResult.optimizedAddresses
                .slice(1) // 移除起點
                .map((addressInfo, index) => {
                    const originalIndex = addressInfo.originalIndex - 1; // 扣除起點
                    return ordersToOptimize[originalIndex];
                });
            
            res.json({
                success: true,
                optimizedRoute: optimizedOrders,
                totalDistance: optimizationResult.totalDistance,
                totalDuration: optimizationResult.totalDuration,
                mapboxUrl: optimizationResult.mapboxUrl,
                message: `路線已優化，預計節省 ${Math.round(optimizationResult.totalDuration * 0.2)} 分鐘`
            });
        } else {
            res.status(400).json({
                success: false,
                message: '路線優化失敗'
            });
        }
        
    } catch (error) {
        console.error('路線優化錯誤:', error);
        res.status(500).json({
            success: false,
            message: '路線優化失敗'
        });
    }
});

/**
 * 更新外送員位置
 */
router.post('/update-location', (req, res) => {
    try {
        const { driverId = 'demo-driver', location, timestamp } = req.body;
        
        if (!location) {
            return res.status(400).json({
                success: false,
                message: '缺少位置資訊'
            });
        }
        
        // 在實際應用中，這裡會更新資料庫中的外送員位置
        console.log(`外送員 ${driverId} 位置更新:`, {
            lat: location.lat,
            lng: location.lng,
            timestamp: timestamp || new Date().toISOString()
        });
        
        res.json({
            success: true,
            message: '位置更新成功'
        });
        
    } catch (error) {
        console.error('位置更新錯誤:', error);
        res.status(500).json({
            success: false,
            message: '位置更新失敗'
        });
    }
});

/**
 * 獲取客戶訂單詳情
 */
router.get('/order-details/:orderId', (req, res) => {
    try {
        const { orderId } = req.params;
        const order = mockOrders.find(order => order.id === orderId);
        
        if (!order) {
            return res.status(404).json({
                success: false,
                message: '找不到該訂單'
            });
        }
        
        res.json({
            success: true,
            order: {
                id: order.id,
                customer: order.customer,
                address: order.address,
                phone: order.phone,
                items: order.items,
                status: order.status,
                coordinates: order.coordinates,
                completedTime: order.completedTime
            }
        });
        
    } catch (error) {
        console.error('獲取訂單詳情錯誤:', error);
        res.status(500).json({
            success: false,
            message: '無法獲取訂單詳情'
        });
    }
});

/**
 * 外送員統計資訊
 */
router.get('/driver-stats/:driverId?', (req, res) => {
    try {
        const { driverId = 'demo-driver' } = req.params;
        const today = new Date().toISOString().split('T')[0];
        
        // 計算今日統計
        const todayOrders = mockOrders.filter(order => {
            if (!order.completedTime) return order.status !== 'completed';
            return order.completedTime.startsWith(today);
        });
        
        const completedToday = todayOrders.filter(order => order.status === 'completed');
        const totalEarnings = completedToday.length * 50; // 假設每筆50元
        
        const stats = {
            driverId,
            today: {
                totalOrders: todayOrders.length,
                completedOrders: completedToday.length,
                remainingOrders: todayOrders.length - completedToday.length,
                earnings: totalEarnings,
                averageTime: '12分鐘'
            },
            currentStatus: mockOrders.find(order => order.status === 'delivering') ? 'delivering' : 'available'
        };
        
        res.json({
            success: true,
            stats
        });
        
    } catch (error) {
        console.error('獲取統計資訊錯誤:', error);
        res.status(500).json({
            success: false,
            message: '無法獲取統計資訊'
        });
    }
});

module.exports = router;