const { Pool } = require('pg');

/**
 * 價格變動通知服務
 * 負責檢測價格變動並發送通知給受影響的客戶
 */
class PriceChangeNotificationService {
  constructor(databasePool, lineNotificationService, basicSettings = null) {
    this.db = databasePool;
    this.lineService = lineNotificationService;
    this.settings = basicSettings || {};
    this.demoMode = !databasePool;
  }

  /**
   * 檢測今日價格變動並發送通知
   * @param {Array} updatedProducts - 今日更新的商品列表 [{id, name, oldPrice, newPrice}]
   */
  async checkAndNotifyPriceChanges(updatedProducts = null) {
    try {
      console.log('🔍 開始檢測價格變動...');

      if (this.demoMode) {
        return await this.handleDemoMode(updatedProducts);
      }

      // 如果未指定商品，檢測所有商品
      if (!updatedProducts) {
        updatedProducts = await this.getAllPriceChanges();
      }

      const threshold = this.settings.price_change_threshold || 15;
      let notificationsSent = 0;

      for (const product of updatedProducts) {
        const changePercent = this.calculatePriceChangePercent(product.oldPrice, product.newPrice);
        
        // 檢查是否超過閾值
        if (Math.abs(changePercent) >= threshold) {
          const affectedOrders = await this.getAffectedOrders(product.id);
          
          for (const order of affectedOrders) {
            await this.sendPriceChangeNotification({
              order,
              product,
              oldPrice: product.oldPrice,
              newPrice: product.newPrice,
              changePercent
            });
            notificationsSent++;
          }
        }
      }

      console.log(`📬 價格變動通知完成，共發送 ${notificationsSent} 則通知`);
      return { success: true, notificationsSent };

    } catch (error) {
      console.error('❌ 價格變動檢測失敗:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 示範模式處理
   */
  async handleDemoMode(products) {
    console.log('📝 示範模式：模擬價格變動檢測');
    
    // 模擬檢測到的價格變動
    const mockChanges = [
      { productName: '高麗菜', oldPrice: 25, newPrice: 32, changePercent: 28 },
      { productName: '紅蘿蔔', oldPrice: 15, newPrice: 12, changePercent: -20 },
    ];

    console.log(`📊 發現 ${mockChanges.length} 項商品價格變動超過閾值`);
    
    for (const change of mockChanges) {
      console.log(`💰 ${change.productName}: ${change.oldPrice} → ${change.newPrice} (${change.changePercent > 0 ? '+' : ''}${change.changePercent}%)`);
    }

    return { 
      success: true, 
      notificationsSent: mockChanges.length * 2, // 假設每個商品影響2筆訂單
      mockData: mockChanges 
    };
  }

  /**
   * 獲取所有價格變動的商品
   */
  async getAllPriceChanges() {
    const query = `
      SELECT 
        p.id,
        p.name,
        p.price as new_price,
        ph.price as old_price
      FROM products p
      LEFT JOIN product_price_history ph ON p.id = ph.product_id 
        AND ph.date = CURRENT_DATE - INTERVAL '1 day'
      WHERE p.price IS NOT NULL 
        AND ph.price IS NOT NULL 
        AND p.price != ph.price
    `;

    const result = await this.db.query(query);
    return result.rows.map(row => ({
      id: row.id,
      name: row.name,
      oldPrice: parseFloat(row.old_price),
      newPrice: parseFloat(row.new_price)
    }));
  }

  /**
   * 計算價格變動百分比
   */
  calculatePriceChangePercent(oldPrice, newPrice) {
    if (!oldPrice || oldPrice === 0) return 0;
    return Math.round(((newPrice - oldPrice) / oldPrice) * 100 * 100) / 100;
  }

  /**
   * 獲取受影響的訂單
   */
  async getAffectedOrders(productId) {
    const query = `
      SELECT DISTINCT
        o.id as order_id,
        o.contact_name,
        o.contact_phone,
        u.line_user_id,
        oi.quantity,
        oi.name as product_name
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      LEFT JOIN users u ON o.contact_phone = u.phone
      WHERE oi.product_id = $1 
        AND o.status IN ('placed', 'confirmed')
        AND o.created_at >= CURRENT_DATE - INTERVAL '1 day'
    `;

    const result = await this.db.query(query, [productId]);
    return result.rows;
  }

  /**
   * 發送價格變動通知
   */
  async sendPriceChangeNotification({ order, product, oldPrice, newPrice, changePercent }) {
    try {
      // 記錄通知
      await this.recordNotification({
        orderId: order.order_id,
        productId: product.id,
        oldPrice,
        newPrice,
        changePercent,
        lineUserId: order.line_user_id
      });

      if (!order.line_user_id) {
        console.log(`⚠️ 訂單 #${order.order_id} 客戶未綁定LINE，跳過通知`);
        return;
      }

      // 準備通知訊息
      const isIncrease = changePercent > 0;
      const templateKey = isIncrease ? 'notification_price_increase' : 'notification_price_decrease';
      const template = this.settings[templateKey] || this.getDefaultTemplate(isIncrease);

      const message = this.formatNotificationMessage(template, {
        productName: product.name,
        oldPrice: oldPrice.toFixed(0),
        newPrice: newPrice.toFixed(0),
        changePercent: `${changePercent > 0 ? '+' : ''}${changePercent}%`,
        orderId: order.order_id
      });

      // 發送LINE通知
      if (this.lineService) {
        await this.lineService.sendNotification(order.line_user_id, message);
        console.log(`📱 已發送價格變動通知給客戶 (訂單 #${order.order_id})`);
      }

    } catch (error) {
      console.error(`❌ 發送通知失敗 (訂單 #${order.order_id}):`, error);
    }
  }

  /**
   * 記錄通知到資料庫
   */
  async recordNotification({ orderId, productId, oldPrice, newPrice, changePercent, lineUserId }) {
    if (this.demoMode) {
      console.log(`📝 示範模式：記錄價格變動通知 (訂單 #${orderId})`);
      return;
    }

    const query = `
      INSERT INTO price_change_notifications 
      (order_id, product_id, old_price, new_price, change_percent, line_user_id)
      VALUES ($1, $2, $3, $4, $5, $6)
    `;

    await this.db.query(query, [orderId, productId, oldPrice, newPrice, changePercent, lineUserId]);
  }

  /**
   * 格式化通知訊息
   */
  formatNotificationMessage(template, variables) {
    let message = template;
    Object.keys(variables).forEach(key => {
      const regex = new RegExp(`\\{${key}\\}`, 'g');
      message = message.replace(regex, variables[key]);
    });
    return message;
  }

  /**
   * 獲取預設通知模板
   */
  getDefaultTemplate(isIncrease) {
    if (isIncrease) {
      return `⚠️ 價格異動通知

您的訂單 #{orderId} 中的【{productName}】價格有所調整：
💰 昨日參考價: ${oldPrice}
💰 今日實際價: ${newPrice}
📊 變動幅度: {changePercent}

如需調整訂單，請於30分鐘內至訂單管理頁面處理，逾時將視為接受此價格。

感謝您的理解 🙏`;
    } else {
      return `🎉 好消息！價格調降通知

您的訂單 #{orderId} 中的【{productName}】價格已調降：
💰 昨日參考價: ${oldPrice}
💰 今日實際價: ${newPrice}
📊 降幅: {changePercent}

系統已自動為您更新至最新優惠價格！

謝謝您的支持 ❤️`;
    }
  }

  /**
   * 手動觸發價格檢測（供管理員使用）
   */
  async triggerManualPriceCheck() {
    console.log('🔄 手動觸發價格變動檢測...');
    return await this.checkAndNotifyPriceChanges();
  }

  /**
   * 獲取通知統計資料
   */
  async getNotificationStats(days = 7) {
    if (this.demoMode) {
      return {
        totalSent: 15,
        responded: 12,
        timeout: 2,
        pending: 1
      };
    }

    const query = `
      SELECT 
        COUNT(*) as total_sent,
        COUNT(CASE WHEN status = 'responded' THEN 1 END) as responded,
        COUNT(CASE WHEN status = 'timeout' THEN 1 END) as timeout,
        COUNT(CASE WHEN status = 'sent' THEN 1 END) as pending
      FROM price_change_notifications
      WHERE notification_sent_at >= NOW() - INTERVAL '${days} days'
    `;

    const result = await this.db.query(query);
    return result.rows[0] || { totalSent: 0, responded: 0, timeout: 0, pending: 0 };
  }
}

module.exports = PriceChangeNotificationService;