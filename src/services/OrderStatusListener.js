/**
 * 訂單狀態監聽器
 * 負責監聽訂單狀態變更並觸發相應的自動化流程
 */

class OrderStatusListener {
  constructor(pool, routeOptimizationService, webSocketManager = null) {
    this.pool = pool;
    this.routeOptimizationService = routeOptimizationService;
    this.webSocketManager = webSocketManager;
    
    // 狀態變更處理器映射
    this.statusHandlers = {
      'paid': this.handlePaidOrder.bind(this),
      'ready': this.handleReadyOrder.bind(this),
      'assigned': this.handleAssignedOrder.bind(this),
      'delivering': this.handleDeliveringOrder.bind(this),
      'delivered': this.handleDeliveredOrder.bind(this)
    };

    console.log('📡 訂單狀態監聽器已初始化');
  }

  /**
   * 處理訂單狀態變更的主入口
   */
  async onOrderStatusChange(orderId, oldStatus, newStatus, additionalData = {}) {
    try {
      console.log(`📋 訂單 ${orderId} 狀態變更: ${oldStatus} → ${newStatus}`);
      
      // 記錄狀態變更歷史
      await this.logStatusChange(orderId, oldStatus, newStatus, additionalData);
      
      // 執行特定狀態的處理邏輯
      const handler = this.statusHandlers[newStatus];
      if (handler) {
        await handler(orderId, oldStatus, newStatus, additionalData);
      }
      
      // 廣播狀態變更給相關用戶
      await this.broadcastStatusChange(orderId, newStatus, additionalData);
      
      return { success: true, message: '訂單狀態處理完成' };
      
    } catch (error) {
      console.error(`❌ 處理訂單 ${orderId} 狀態變更失敗:`, error);
      return { success: false, message: error.message };
    }
  }

  /**
   * 處理已付款訂單
   */
  async handlePaidOrder(orderId, oldStatus, newStatus, data) {
    console.log(`💰 處理已付款訂單: ${orderId}`);
    
    try {
      // 觸發庫存檢查和預留
      await this.checkAndReserveInventory(orderId);
      
      // 通知廚房/包裝人員
      await this.notifyPackagingTeam(orderId);
      
      // 如果累積足夠訂單，觸發路線預優化
      const pendingCount = await this.getPendingOrdersCount();
      if (pendingCount >= 3) {
        console.log('🚀 累積訂單達到門檻，觸發預優化');
        await this.routeOptimizationService.autoOptimizeOnStatusChange(orderId, newStatus);
      }
      
    } catch (error) {
      console.error(`❌ 處理已付款訂單失敗:`, error);
    }
  }

  /**
   * 處理包裝完成訂單 - 核心自動優化觸發點
   */
  async handleReadyOrder(orderId, oldStatus, newStatus, data) {
    console.log(`📦 處理包裝完成訂單: ${orderId}`);
    
    try {
      // 🚀 核心功能：自動觸發路線優化
      const optimizationResult = await this.routeOptimizationService.autoOptimizeOnStatusChange(
        orderId, 
        newStatus
      );
      
      if (optimizationResult.success) {
        console.log(`✅ 訂單 ${orderId} 觸發自動路線優化成功`);
        
        // 通知管理員優化結果
        await this.notifyAdminOptimization(orderId, optimizationResult);
        
        // 如果有路線分派成功，通知外送員
        if (optimizationResult.result && optimizationResult.result.routes.length > 0) {
          await this.notifyDriversNewRoutes(optimizationResult.result.routes);
        }
        
      } else {
        console.log(`⚠️ 訂單 ${orderId} 自動路線優化暫未觸發: ${optimizationResult.message}`);
      }
      
      // 更新訂單時間戳
      await this.updateOrderTimestamp(orderId, 'ready_at');
      
    } catch (error) {
      console.error(`❌ 處理包裝完成訂單失敗:`, error);
    }
  }

  /**
   * 處理已分派訂單
   */
  async handleAssignedOrder(orderId, oldStatus, newStatus, data) {
    console.log(`👤 處理已分派訂單: ${orderId}`);
    
    try {
      const driverId = data.driverId;
      if (driverId) {
        // 通知特定外送員
        await this.notifyDriverAssignment(driverId, orderId);
        
        // 更新外送員狀態
        await this.updateDriverStatus(driverId, 'busy');
      }
      
      // 更新訂單分派時間
      await this.updateOrderTimestamp(orderId, 'assigned_at');
      
    } catch (error) {
      console.error(`❌ 處理已分派訂單失敗:`, error);
    }
  }

  /**
   * 處理配送中訂單
   */
  async handleDeliveringOrder(orderId, oldStatus, newStatus, data) {
    console.log(`🚚 處理配送中訂單: ${orderId}`);
    
    try {
      // 開始GPS追蹤
      await this.startGPSTracking(orderId);
      
      // 通知客戶配送開始
      await this.notifyCustomerDeliveryStart(orderId);
      
      // 更新配送開始時間
      await this.updateOrderTimestamp(orderId, 'delivery_started_at');
      
    } catch (error) {
      console.error(`❌ 處理配送中訂單失敗:`, error);
    }
  }

  /**
   * 處理已送達訂單
   */
  async handleDeliveredOrder(orderId, oldStatus, newStatus, data) {
    console.log(`✅ 處理已送達訂單: ${orderId}`);
    
    try {
      // 停止GPS追蹤
      await this.stopGPSTracking(orderId);
      
      // 釋放外送員
      const driverId = data.driverId;
      if (driverId) {
        await this.releaseDriver(driverId);
      }
      
      // 發送客戶滿意度調查
      await this.sendCustomerFeedbackSurvey(orderId);
      
      // 更新送達時間
      await this.updateOrderTimestamp(orderId, 'delivered_at');
      
      // 檢查是否需要重新優化剩餘路線
      await this.checkRemainingRouteOptimization();
      
    } catch (error) {
      console.error(`❌ 處理已送達訂單失敗:`, error);
    }
  }

  /**
   * 記錄狀態變更歷史
   */
  async logStatusChange(orderId, oldStatus, newStatus, additionalData) {
    try {
      const query = `
        INSERT INTO order_status_history (
          order_id, old_status, new_status, 
          changed_at, additional_data
        ) VALUES ($1, $2, $3, NOW(), $4)
      `;
      
      await this.pool.query(query, [
        orderId, 
        oldStatus, 
        newStatus, 
        JSON.stringify(additionalData)
      ]);
      
    } catch (error) {
      console.error('❌ 記錄狀態變更歷史失敗:', error);
    }
  }

  /**
   * 廣播狀態變更
   */
  async broadcastStatusChange(orderId, newStatus, data) {
    if (this.webSocketManager) {
      try {
        // 向管理員廣播
        this.webSocketManager.broadcast('order-status-changed', {
          orderId,
          newStatus,
          timestamp: new Date().toISOString(),
          data
        });

        // 如果有外送員相關，單獨通知外送員
        if (data.driverId) {
          this.webSocketManager.sendToUser(`driver_${data.driverId}`, 'order-update', {
            orderId,
            newStatus,
            message: this.getStatusMessage(newStatus)
          });
        }
        
      } catch (error) {
        console.error('❌ 廣播狀態變更失敗:', error);
      }
    }
  }

  /**
   * 取得待配送訂單數量
   */
  async getPendingOrdersCount() {
    try {
      const result = await this.pool.query(
        `SELECT COUNT(*) FROM orders WHERE status IN ('paid', 'ready')`
      );
      return parseInt(result.rows[0].count);
    } catch (error) {
      console.error('❌ 取得待配送訂單數量失敗:', error);
      return 0;
    }
  }

  /**
   * 通知外送員新路線分派
   */
  async notifyDriversNewRoutes(routes) {
    for (const route of routes) {
      if (route.assignedDriverId && this.webSocketManager) {
        try {
          this.webSocketManager.sendToUser(`driver_${route.assignedDriverId}`, 'new-route-assigned', {
            routeId: route.routeId,
            orderCount: route.orders.length,
            estimatedTime: route.estimatedTime.totalMinutes,
            message: `新路線已分派，包含 ${route.orders.length} 個訂單`
          });
        } catch (error) {
          console.error(`❌ 通知外送員 ${route.assignedDriverId} 失敗:`, error);
        }
      }
    }
  }

  /**
   * 檢查並預留庫存
   */
  async checkAndReserveInventory(orderId) {
    // 庫存檢查邏輯
    console.log(`🏪 檢查訂單 ${orderId} 的庫存並預留`);
  }

  /**
   * 通知包裝團隊
   */
  async notifyPackagingTeam(orderId) {
    console.log(`📢 通知包裝團隊處理訂單 ${orderId}`);
  }

  /**
   * 通知管理員優化結果
   */
  async notifyAdminOptimization(orderId, result) {
    if (this.webSocketManager) {
      this.webSocketManager.broadcast('admin-notification', {
        type: 'route-optimization',
        orderId,
        message: `訂單 ${orderId} 觸發自動路線優化`,
        result: result.success
      });
    }
  }

  /**
   * 更新訂單時間戳
   */
  async updateOrderTimestamp(orderId, field) {
    try {
      const query = `UPDATE orders SET ${field} = NOW() WHERE id = $1`;
      await this.pool.query(query, [orderId]);
    } catch (error) {
      console.error(`❌ 更新訂單時間戳失敗:`, error);
    }
  }

  /**
   * 取得狀態變更訊息
   */
  getStatusMessage(status) {
    const messages = {
      'paid': '訂單已付款，準備處理',
      'ready': '訂單已包裝完成，等待配送',
      'assigned': '訂單已分派給外送員',
      'delivering': '訂單配送中',
      'delivered': '訂單已送達'
    };
    return messages[status] || '訂單狀態已更新';
  }

  /**
   * 其他輔助方法...
   */
  async notifyDriverAssignment(driverId, orderId) {
    console.log(`📲 通知外送員 ${driverId} 新訂單分派: ${orderId}`);
  }

  async updateDriverStatus(driverId, status) {
    try {
      await this.pool.query(
        `UPDATE drivers SET status = $1, last_activity = NOW() WHERE id = $2`,
        [status, driverId]
      );
    } catch (error) {
      console.error('❌ 更新外送員狀態失敗:', error);
    }
  }

  async startGPSTracking(orderId) {
    console.log(`📍 開始追蹤訂單 ${orderId} 的GPS位置`);
  }

  async stopGPSTracking(orderId) {
    console.log(`📍 停止追蹤訂單 ${orderId} 的GPS位置`);
  }

  async notifyCustomerDeliveryStart(orderId) {
    console.log(`📱 通知客戶訂單 ${orderId} 開始配送`);
  }

  async releaseDriver(driverId) {
    await this.updateDriverStatus(driverId, 'available');
    console.log(`👤 外送員 ${driverId} 已釋放，狀態設為可用`);
  }

  async sendCustomerFeedbackSurvey(orderId) {
    console.log(`📊 發送客戶滿意度調查給訂單 ${orderId}`);
  }

  async checkRemainingRouteOptimization() {
    console.log(`🔍 檢查是否需要重新優化剩餘路線`);
  }
}

module.exports = OrderStatusListener;