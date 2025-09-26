/**
 * 訂單通知Hook服務
 * 監聽訂單狀態變更，自動發送LINE通知
 */

class OrderNotificationHook {
  constructor(lineBotService, pool) {
    this.lineBotService = lineBotService;
    this.pool = pool;
    this.isEnabled = true;
    
    console.log('🔔 訂單通知Hook已初始化');
  }
  
  /**
   * 處理訂單狀態變更事件
   * @param {number} orderId - 訂單ID
   * @param {string} oldStatus - 原狀態
   * @param {string} newStatus - 新狀態
   * @param {Object} orderData - 訂單數據
   */
  async handleOrderStatusChange(orderId, oldStatus, newStatus, orderData = null) {
    if (!this.isEnabled) {
      console.log('📴 訂單通知Hook已停用');
      return;
    }
    
    try {
      console.log(`🔔 訂單狀態變更: #${orderId} ${oldStatus} → ${newStatus}`);
      
      // 檢查是否為需要發送通知的狀態變更
      if (this.shouldSendNotification(oldStatus, newStatus)) {
        await this.sendOrderNotification(orderId, newStatus, orderData);
      }
      
    } catch (error) {
      console.error(`❌ 處理訂單狀態變更失敗 (訂單 #${orderId}):`, error);
    }
  }
  
  /**
   * 判斷是否需要發送通知
   * @param {string} oldStatus - 原狀態
   * @param {string} newStatus - 新狀態
   */
  shouldSendNotification(oldStatus, newStatus) {
    // 在狀態變更為以下狀態時發送通知：
    // - ready: 包裝完成，發送包含付款連結的通知
    // - delivering: 開始配送，發送配送中通知
    // - delivered: 已送達，發送送達確認通知
    return newStatus === 'ready' || newStatus === 'delivering' || newStatus === 'delivered';
  }
  
  /**
   * 發送訂單通知
   * @param {number} orderId - 訂單ID
   * @param {string} status - 訂單狀態
   * @param {Object} orderData - 訂單數據（可選，用於避免重複查詢）
   */
  async sendOrderNotification(orderId, status, orderData = null) {
    try {
      let order = orderData;
      let orderItems = [];

      // 如果沒有提供訂單數據，則查詢資料庫（包含付款方式）
      if (!order) {
        const orderResult = await this.pool.query(`
          SELECT o.*, u.line_user_id
          FROM orders o
          LEFT JOIN users u ON o.contact_phone = u.phone
          WHERE o.id = $1
        `, [orderId]);

        if (orderResult.rows.length === 0) {
          console.warn(`⚠️ 找不到訂單 #${orderId}`);
          return;
        }

        order = orderResult.rows[0];

        // 查詢訂單項目
        const itemsResult = await this.pool.query(`
          SELECT * FROM order_items WHERE order_id = $1 ORDER BY id
        `, [orderId]);

        orderItems = itemsResult.rows;
      } else {
        // 使用提供的訂單數據（示範模式或已有資料）
        console.log(`📝 使用提供的訂單數據 (示範模式): 訂單 #${orderId}`);

        // 創建示範訂單項目
        orderItems = [
          {
            id: 1,
            name: '有機青菜',
            quantity: 2,
            unit_price: 80,
            line_total: 160,
            actual_weight: null
          },
          {
            id: 2,
            name: '新鮮番茄',
            quantity: 1,
            unit_price: 120,
            line_total: 120,
            actual_weight: null
          }
        ];
      }

      let result;

      // 根據不同狀態發送對應的通知
      switch (status) {
        case 'ready':
          // 發送包裝完成通知（包含付款連結）
          result = await this.lineBotService.sendPackagingCompleteNotification(order, orderItems);
          break;
        case 'delivering':
          // 發送配送中通知
          result = await this.sendDeliveringNotification(order, orderItems);
          break;
        case 'delivered':
          // 發送已送達通知
          result = await this.sendDeliveredNotification(order, orderItems);
          break;
        default:
          console.log(`📱 狀態 ${status} 不需要發送通知`);
          return;
      }

      // 記錄發送結果
      if (result.success) {
        console.log(`✅ 訂單 #${orderId} ${status} 通知發送成功`);
      } else {
        console.warn(`⚠️ 訂單 #${orderId} ${status} 通知發送失敗:`, result.reason || result.error);
      }

    } catch (error) {
      console.error(`❌ 發送訂單 #${orderId} 通知失敗:`, error);
    }
  }
  
  /**
   * 發送配送中通知
   */
  async sendDeliveringNotification(order, orderItems) {
    if (!order.line_user_id) {
      return { success: false, reason: 'NO_LINE_ID' };
    }
    
    try {
      const message = {
        type: 'text',
        text: `🚚 您的訂單已開始配送！

📦 訂單編號：#${order.id}
📍 配送地址：${order.address}
💰 訂單金額：NT$ ${order.total_amount}

⏰ 預計30分鐘內送達
📞 配送問題請聯繫：${process.env.CONTACT_PHONE || '02-xxxx-xxxx'}

感謝您的耐心等待！🙏`
      };
      
      if (this.lineBotService.demoMode) {
        console.log('📱 [示範模式] 模擬發送配送通知');
        return { success: true, demo: true };
      }
      
      await this.lineBotService.client.pushMessage(order.line_user_id, message);
      return { success: true };
      
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
  
  /**
   * 發送已送達通知
   */
  async sendDeliveredNotification(order, orderItems) {
    if (!order.line_user_id) {
      return { success: false, reason: 'NO_LINE_ID' };
    }
    
    try {
      const message = {
        type: 'text',
        text: `✅ 您的蔬菜已成功送達！

📦 訂單編號：#${order.id}
💰 訂單金額：NT$ ${order.total_amount}
🕐 送達時間：${new Date().toLocaleString('zh-TW')}

🌟 如果您滿意我們的服務，歡迎再次訂購
💬 有任何問題請隨時聯繫我們

謝謝您選擇承億蔬菜外送！🥬🍅`
      };
      
      if (this.lineBotService.demoMode) {
        console.log('📱 [示範模式] 模擬發送送達通知');
        return { success: true, demo: true };
      }
      
      await this.lineBotService.client.pushMessage(order.line_user_id, message);
      return { success: true };
      
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
  
  /**
   * 啟用/停用通知Hook
   */
  setEnabled(enabled) {
    this.isEnabled = enabled;
    console.log(`🔔 訂單通知Hook ${enabled ? '已啟用' : '已停用'}`);
  }
  
  /**
   * 獲取Hook狀態
   */
  getStatus() {
    return {
      enabled: this.isEnabled,
      lineBotStatus: this.lineBotService.getStatus()
    };
  }
}

module.exports = OrderNotificationHook;