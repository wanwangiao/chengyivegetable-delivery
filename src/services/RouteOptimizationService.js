/**
 * 路線優化管理服務
 * 整合地理聚類和TSP優化，提供完整的配送路線解決方案
 */

const GeoClustering = require('./GeoClustering');
const TSPOptimizer = require('./TSPOptimizer');

class RouteOptimizationService {
  constructor(pool) {
    this.pool = pool;
    this.geoClustering = new GeoClustering();
    this.tspOptimizer = new TSPOptimizer();
    
    // 配送中心預設位置 (可從設定檔或資料庫載入)
    this.defaultDepot = {
      lat: 25.0330,
      lng: 121.5654,
      name: '承億蔬菜配送中心',
      address: '台北市信義區'
    };
    
    // 🚀 自動優化配置
    this.autoOptimizationConfig = {
      enabled: true,
      triggerStatuses: ['ready', 'paid'],
      minOrdersForOptimization: 2,
      optimizationInterval: 300000, // 5分鐘間隔
      maxRetries: 3
    };
    
    // 上次優化時間記錄
    this.lastOptimizationTime = null;
    this.isOptimizing = false;
  }

  /**
   * 為準備配送的訂單生成優化路線
   */
  async generateOptimizedRoutes(options = {}) {
    const {
      includeStatuses = ['ready'],
      maxClusters = null,
      optimizationMethod = 'hybrid',
      clusteringMethod = 'kmeans',
      depot = null
    } = options;

    console.log('🚀 開始生成優化配送路線...');

    try {
      // 1. 載入需要配送的訂單
      const orders = await this.loadOrdersForDelivery(includeStatuses);
      
      if (orders.length === 0) {
        return {
          success: true,
          message: '沒有需要配送的訂單',
          routes: [],
          stats: { totalOrders: 0, totalClusters: 0 }
        };
      }

      console.log(`📦 載入了 ${orders.length} 筆待配送訂單`);

      // 2. 地理聚類分組
      const clusterResult = await this.performClustering(orders, clusteringMethod, maxClusters);
      
      // 3. 為每個聚類優化路線
      const optimizedRoutes = await this.optimizeClusterRoutes(
        clusterResult.clusters, 
        optimizationMethod, 
        depot || this.defaultDepot
      );

      // 4. 計算總體統計
      const overallStats = this.calculateOverallStats(clusterResult, optimizedRoutes);

      console.log('✅ 路線優化完成');

      return {
        success: true,
        routes: optimizedRoutes,
        clusterStats: clusterResult.stats,
        overallStats,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('❌ 路線優化失敗:', error);
      return {
        success: false,
        error: error.message,
        routes: []
      };
    }
  }

  /**
   * 載入需要配送的訂單
   */
  async loadOrdersForDelivery(includeStatuses) {
    const statusPlaceholders = includeStatuses.map((_, index) => `$${index + 1}`).join(',');
    
    const query = `
      SELECT 
        o.id, o.contact_name, o.contact_phone, o.address,
        o.total_amount, o.status, o.created_at, o.notes,
        o.lat, o.lng
      FROM orders o
      WHERE o.status IN (${statusPlaceholders})
        AND o.lat IS NOT NULL 
        AND o.lng IS NOT NULL
      ORDER BY o.created_at ASC
    `;

    const result = await this.pool.query(query, includeStatuses);
    return result.rows.map(order => ({
      ...order,
      lat: parseFloat(order.lat),
      lng: parseFloat(order.lng)
    }));
  }

  /**
   * 執行聚類分析
   */
  async performClustering(orders, method, maxClusters) {
    console.log(`🎯 執行${method}聚類分析...`);

    switch (method) {
      case 'adaptive':
        return this.geoClustering.adaptiveCluster(orders, 5); // 5km範圍內為一組
        
      case 'density':
        return this.geoClustering.adaptiveCluster(orders, 3); // 3km範圍內為一組
        
      case 'kmeans':
      default:
        const k = maxClusters || this.geoClustering.determineOptimalK(orders);
        return this.geoClustering.kMeansCluster(orders, k);
    }
  }

  /**
   * 為每個聚類優化路線
   */
  async optimizeClusterRoutes(clusters, optimizationMethod, depot) {
    console.log(`🔧 為 ${clusters.length} 個聚類優化路線...`);

    const optimizedRoutes = [];

    for (let i = 0; i < clusters.length; i++) {
      const cluster = clusters[i];
      
      if (cluster.length === 0) continue;

      console.log(`  處理聚類 ${i + 1}: ${cluster.length} 個訂單`);

      // TSP優化
      const optimizationResult = this.tspOptimizer.optimizeRoute(
        cluster, 
        depot, 
        optimizationMethod
      );

      const route = {
        routeId: `route_${Date.now()}_${i}`,
        clusterId: i,
        orders: optimizationResult.route,
        totalDistance: optimizationResult.totalDistance,
        estimatedTime: this.estimateDeliveryTime(optimizationResult.totalDistance, cluster.length),
        optimizationMethod: optimizationResult.method,
        routeDetails: optimizationResult.routeDetails,
        depot: depot,
        googleMapsUrl: '',
        stats: {
          orderCount: cluster.length,
          totalValue: cluster.reduce((sum, order) => sum + parseFloat(order.total_amount), 0),
          averageDistance: optimizationResult.totalDistance / cluster.length,
          createdAt: new Date().toISOString()
        }
      };

      // 生成Google Maps URL
      route.googleMapsUrl = this.generateGoogleMapsUrl(route);

      optimizedRoutes.push(route);
    }

    return optimizedRoutes;
  }

  /**
   * 估算配送時間
   */
  estimateDeliveryTime(totalDistance, orderCount) {
    const drivingTime = (totalDistance / 30) * 60; // 假設30km/h
    const stopTime = orderCount * 5; // 每個訂單5分鐘
    const totalMinutes = drivingTime + stopTime + 15; // 加緩衝時間

    return {
      totalMinutes: Math.round(totalMinutes),
      drivingMinutes: Math.round(drivingTime),
      stopMinutes: stopTime,
      estimatedHours: Math.round(totalMinutes / 60 * 10) / 10
    };
  }

  /**
   * 計算總體統計
   */
  calculateOverallStats(clusterResult, optimizedRoutes) {
    const totalOrders = optimizedRoutes.reduce((sum, route) => sum + route.orders.length, 0);
    const totalDistance = optimizedRoutes.reduce((sum, route) => sum + route.totalDistance, 0);
    const totalValue = optimizedRoutes.reduce((sum, route) => sum + route.stats.totalValue, 0);
    const totalTime = optimizedRoutes.reduce((sum, route) => sum + route.estimatedTime.totalMinutes, 0);

    return {
      totalOrders,
      totalRoutes: optimizedRoutes.length,
      totalDistance: Math.round(totalDistance * 100) / 100,
      totalValue: Math.round(totalValue * 100) / 100,
      averageOrdersPerRoute: totalOrders > 0 ? Math.round(totalOrders / optimizedRoutes.length * 10) / 10 : 0,
      averageDistancePerRoute: optimizedRoutes.length > 0 ? Math.round(totalDistance / optimizedRoutes.length * 100) / 100 : 0,
      estimatedTotalTime: Math.round(totalTime),
      clusterQuality: this.geoClustering.evaluateClusterQuality(clusterResult.clusters),
      efficiency: {
        ordersPerKm: totalDistance > 0 ? Math.round(totalOrders / totalDistance * 100) / 100 : 0,
        valuePerKm: totalDistance > 0 ? Math.round(totalValue / totalDistance * 100) / 100 : 0,
        timePerOrder: totalOrders > 0 ? Math.round(totalTime / totalOrders * 100) / 100 : 0
      }
    };
  }

  /**
   * 生成Google Maps路線URL
   */
  generateGoogleMapsUrl(route) {
    if (!route.orders || route.orders.length === 0) return '';

    const baseUrl = 'https://www.google.com/maps/dir/';
    const depot = route.depot;
    
    let url = baseUrl + `${depot.lat},${depot.lng}/`;
    
    // 添加途經點 (Google Maps限制最多23個途經點)
    const waypoints = route.orders.slice(0, Math.min(23, route.orders.length)).map(order => 
      `${order.lat},${order.lng}`
    ).join('/');
    
    url += waypoints + `/${depot.lat},${depot.lng}`;

    return url;
  }

  /**
   * 🚀 自動路線優化 - 當訂單狀態變更時觸發
   */
  async autoOptimizeOnStatusChange(orderId, newStatus) {
    if (!this.autoOptimizationConfig.enabled) {
      return { success: false, message: '自動優化功能已停用' };
    }

    if (!this.autoOptimizationConfig.triggerStatuses.includes(newStatus)) {
      return { success: false, message: '此狀態不觸發自動優化' };
    }

    // 防止重複優化
    if (this.isOptimizing) {
      console.log('⚠️ 路線優化進行中，略過本次觸發');
      return { success: false, message: '優化進行中，請稍候' };
    }

    // 檢查時間間隔
    if (this.lastOptimizationTime && 
        Date.now() - this.lastOptimizationTime < this.autoOptimizationConfig.optimizationInterval) {
      console.log('⏰ 優化間隔未到，略過本次觸發');
      return { success: false, message: '優化間隔未到' };
    }

    try {
      this.isOptimizing = true;
      console.log(`🚀 訂單 ${orderId} 狀態變更為 ${newStatus}，開始自動路線優化...`);

      // 檢查待優化訂單數量
      const pendingOrders = await this.loadOrdersForDelivery(['ready', 'paid']);
      
      if (pendingOrders.length < this.autoOptimizationConfig.minOrdersForOptimization) {
        console.log(`📦 待配送訂單數量不足 (${pendingOrders.length}/${this.autoOptimizationConfig.minOrdersForOptimization})，暫不優化`);
        return { success: false, message: '待配送訂單數量不足' };
      }

      // 執行自動路線優化
      const optimizationResult = await this.generateOptimizedRoutes({
        includeStatuses: ['ready', 'paid'],
        optimizationMethod: 'hybrid',
        clusteringMethod: 'adaptive',
        autoTriggered: true
      });

      if (optimizationResult.routes && optimizationResult.routes.length > 0) {
        // 自動分派給可用的外送員
        await this.autoAssignRoutesToDrivers(optimizationResult.routes);
        
        // 通知相關系統和外送員
        await this.notifyOptimizationComplete(optimizationResult);
      }

      this.lastOptimizationTime = Date.now();
      console.log('✅ 自動路線優化完成');

      return {
        success: true,
        message: '自動路線優化完成',
        result: optimizationResult
      };

    } catch (error) {
      console.error('❌ 自動路線優化失敗:', error);
      return {
        success: false,
        message: '自動路線優化失敗: ' + error.message
      };
    } finally {
      this.isOptimizing = false;
    }
  }

  /**
   * 🚀 智慧分派路線給外送員
   */
  async autoAssignRoutesToDrivers(routes) {
    try {
      // 取得可用的外送員清單
      const availableDrivers = await this.getAvailableDrivers();
      
      if (availableDrivers.length === 0) {
        console.log('⚠️ 沒有可用的外送員，路線暫時保存待分派');
        return;
      }

      for (let i = 0; i < routes.length && i < availableDrivers.length; i++) {
        const route = routes[i];
        const driver = availableDrivers[i];

        try {
          // 分派路線給外送員
          await this.assignRouteToDriver(route, driver);
          
          // 更新訂單狀態為已分派
          await this.updateOrdersStatus(route.orders.map(o => o.id), 'assigned', driver.id);
          
          console.log(`📲 路線 ${route.routeId} 已分派給外送員 ${driver.name} (${driver.phone})`);
          
        } catch (error) {
          console.error(`❌ 分派路線給外送員 ${driver.name} 失敗:`, error);
        }
      }
    } catch (error) {
      console.error('❌ 自動分派路線失敗:', error);
    }
  }

  /**
   * 取得可用的外送員清單
   */
  async getAvailableDrivers() {
    try {
      const query = `
        SELECT id, name, phone, current_location, 
               COALESCE(current_orders, 0) as current_orders
        FROM drivers 
        WHERE status = 'active' 
        AND (current_orders IS NULL OR current_orders < 5)
        ORDER BY current_orders ASC, last_activity DESC
        LIMIT 10
      `;
      
      const result = await this.pool.query(query);
      return result.rows;
    } catch (error) {
      console.error('❌ 取得可用外送員清單失敗:', error);
      return [];
    }
  }

  /**
   * 分派路線給特定外送員
   */
  async assignRouteToDriver(route, driver) {
    try {
      // 將路線資訊儲存到資料庫
      const routeQuery = `
        INSERT INTO delivery_routes (
          route_id, driver_id, orders, total_distance, 
          estimated_time, status, created_at
        ) VALUES ($1, $2, $3, $4, $5, 'assigned', NOW())
      `;
      
      await this.pool.query(routeQuery, [
        route.routeId,
        driver.id,
        JSON.stringify(route.orders),
        route.totalDistance,
        route.estimatedTime.totalMinutes
      ]);

      // 更新外送員的當前訂單數量
      const updateDriverQuery = `
        UPDATE drivers 
        SET current_orders = COALESCE(current_orders, 0) + $1,
            last_assigned = NOW()
        WHERE id = $2
      `;
      
      await this.pool.query(updateDriverQuery, [route.orders.length, driver.id]);

    } catch (error) {
      console.error('❌ 分派路線給外送員失敗:', error);
      throw error;
    }
  }

  /**
   * 批量更新訂單狀態
   */
  async updateOrdersStatus(orderIds, status, driverId = null) {
    try {
      const query = driverId 
        ? `UPDATE orders SET status = $1, driver_id = $2, assigned_at = NOW() WHERE id = ANY($3)`
        : `UPDATE orders SET status = $1, updated_at = NOW() WHERE id = ANY($2)`;
      
      const params = driverId 
        ? [status, driverId, orderIds]
        : [status, orderIds];
      
      await this.pool.query(query, params);
    } catch (error) {
      console.error('❌ 批量更新訂單狀態失敗:', error);
      throw error;
    }
  }

  /**
   * 通知優化完成
   */
  async notifyOptimizationComplete(result) {
    try {
      // 如果有 WebSocket 管理器，推送通知給管理員
      if (global.webSocketManager) {
        global.webSocketManager.broadcast('route-optimization-complete', {
          routeCount: result.routes.length,
          totalOrders: result.overallStats.totalOrders,
          estimatedTime: result.overallStats.estimatedTotalTime,
          timestamp: new Date().toISOString()
        });
      }

      console.log('📢 路線優化完成通知已發送');
    } catch (error) {
      console.error('❌ 發送優化完成通知失敗:', error);
    }
  }

  /**
   * 獲取服務狀態
   */
  getServiceStatus() {
    return {
      initialized: true,
      depot: this.defaultDepot,
      autoOptimization: {
        enabled: this.autoOptimizationConfig.enabled,
        isOptimizing: this.isOptimizing,
        lastOptimization: this.lastOptimizationTime,
        triggerStatuses: this.autoOptimizationConfig.triggerStatuses
      },
      algorithms: {
        clustering: ['kmeans', 'adaptive', 'density'],
        tsp: ['nearest', '2opt', 'annealing', 'genetic', 'hybrid']
      },
      capabilities: {
        maxOrdersPerRoute: 25,
        maxClusters: 10,
        supportedStatuses: ['ready', 'delivering']
      }
    };
  }
}

module.exports = RouteOptimizationService;