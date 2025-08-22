/**
 * LINE Bot 服務
 * 處理 LINE 訊息發送、LIFF 整合、和訂單通知
 */

const { Client } = require('@line/bot-sdk');

class LineBotService {
  constructor() {
    this.config = {
      channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
      channelSecret: process.env.LINE_CHANNEL_SECRET,
    };
    
    // 檢查必要的環境變數
    if (!this.config.channelAccessToken || !this.config.channelSecret) {
      console.warn('⚠️ LINE Bot 環境變數未設定，將啟用示範模式');
      this.demoMode = true;
      return;
    }
    
    this.client = new Client(this.config);
    this.demoMode = false;
    console.log('📱 LINE Bot 服務已初始化');
  }
  
  /**
   * 發送包裝完成通知給客戶（包含付款連結）
   * @param {Object} order - 訂單資訊
   * @param {Array} orderItems - 訂單商品明細
   */
  async sendPackagingCompleteNotification(order, orderItems) {
    if (this.demoMode) {
      console.log('📱 [示範模式] 模擬發送包裝完成通知:', {
        orderId: order.id,
        customerName: order.contact_name,
        totalAmount: order.total_amount,
        paymentMethod: order.payment_method,
        lineUserId: 'DEMO_USER_ID'
      });
      return { success: true, demo: true };
    }
    
    if (!order.line_user_id) {
      console.warn(`⚠️ 訂單 #${order.id} 的客戶未綁定LINE ID，改用模擬通知`);
      // 改用模擬通知（實際可接入SMS API）
      return await this.simulatePackagingNotification(order, orderItems);
    }
    
    try {
      const message = await this.createPackagingCompleteMessage(order, orderItems);
      
      await this.client.pushMessage(order.line_user_id, message);
      
      console.log(`✅ 已發送包裝完成通知給客戶 ${order.contact_name} (訂單 #${order.id})`);
      
      // 記錄發送狀態到資料庫
      await this.recordNotificationSent(order.id, 'packaging_complete', 'success');
      
      return { success: true };
      
    } catch (error) {
      console.error(`❌ 發送LINE通知失敗 (訂單 #${order.id}):`, error.message);
      
      // 記錄發送失敗
      await this.recordNotificationSent(order.id, 'packaging_complete', 'failed', error.message);
      
      return { success: false, error: error.message };
    }
  }

  /**
   * 發送訂單完成通知給客戶
   * @param {Object} order - 訂單資訊
   * @param {Array} orderItems - 訂單商品明細
   */
  async sendOrderCompletedNotification(order, orderItems) {
    if (this.demoMode) {
      console.log('📱 [示範模式] 模擬發送LINE通知:', {
        orderId: order.id,
        customerName: order.contact_name,
        totalAmount: order.total_amount,
        lineUserId: 'DEMO_USER_ID'
      });
      return { success: true, demo: true };
    }
    
    if (!order.line_user_id) {
      console.warn(`⚠️ 訂單 #${order.id} 的客戶未綁定LINE ID`);
      return { success: false, reason: 'NO_LINE_ID' };
    }
    
    try {
      const message = this.createOrderCompletedMessage(order, orderItems);
      
      await this.client.pushMessage(order.line_user_id, message);
      
      console.log(`✅ 已發送訂單完成通知給客戶 ${order.contact_name} (訂單 #${order.id})`);
      
      // 記錄發送狀態到資料庫
      await this.recordNotificationSent(order.id, 'order_completed', 'success');
      
      return { success: true };
      
    } catch (error) {
      console.error(`❌ 發送LINE通知失敗 (訂單 #${order.id}):`, error.message);
      
      // 記錄發送失敗
      await this.recordNotificationSent(order.id, 'order_completed', 'failed', error.message);
      
      return { success: false, error: error.message };
    }
  }
  
  /**
   * 建立包裝完成訊息（包含付款資訊）
   * @param {Object} order - 訂單資訊
   * @param {Array} orderItems - 訂單商品明細
   */
  async createPackagingCompleteMessage(order, orderItems) {
    // 建立商品明細文字
    let itemsText = '';
    orderItems.forEach(item => {
      const weightText = item.actual_weight ? ` (${item.actual_weight}kg)` : '';
      itemsText += `• ${item.name}${weightText} x${item.quantity}\n`;
    });
    
    // 截斷過長的明細
    if (itemsText.length > 400) {
      itemsText = itemsText.substring(0, 400) + '...\n（更多商品詳情請查看訂單）\n';
    }
    
    // 根據付款方式生成不同訊息
    let paymentInfo = await this.getPaymentMessage(order.payment_method, order.total_amount, order.id);
    
    const messageText = `🎉 ${order.contact_name} 您好！

📦 您的訂單已完成包裝，即將出貨！
🔢 訂單編號：#${order.id}

🛍️ 訂購商品：
${itemsText}
💰 訂單金額：NT$ ${order.total_amount}

${paymentInfo}

⏰ 預計30分鐘內送達
📞 如有問題請來電：誠憶鮮蔬

🙏 謝謝您選擇誠憶鮮蔬！`;

    return {
      type: 'text',
      text: messageText
    };
  }

  /**
   * 根據付款方式生成付款訊息
   * @param {string} paymentMethod - 付款方式
   * @param {number} amount - 金額
   */
  async getPaymentMessage(paymentMethod, amount, orderId) {
    switch (paymentMethod) {
      case 'cash':
        return '💰 付款方式：現金付款\n✅ 送達時請準備現金';
        
      case 'linepay':
        const linePayLink = await this.generateLinePayLink(orderId, amount);
        return `📱 付款方式：LINE Pay
💳 請點選連結完成付款：
${linePayLink}
⏰ 請於 30 分鐘內完成付款`;
        
      case 'bank_transfer':
        const bankAccounts = await this.getActiveBankAccounts();
        let bankInfo = '🏦 付款方式：銀行轉帳\n';
        
        if (bankAccounts && bankAccounts.length > 0) {
          bankInfo += '💰 請轉帳至以下帳戶：\n\n';
          bankAccounts.forEach((account, index) => {
            bankInfo += `▶️ ${account.bank_name}`;
            if (account.branch_name) {
              bankInfo += ` ${account.branch_name}`;
            }
            bankInfo += `\n👤 戶名：${account.account_name}\n📱 帳號：${account.account_number}\n`;
            if (index < bankAccounts.length - 1) {
              bankInfo += '\n';
            }
          });
          bankInfo += `\n💰 轉帳金額：NT$ ${amount}\n📝 請轉帳後來電確認或截圖給我們`;
        } else {
          bankInfo += '📞 請來電詢問轉帳資訊';
        }
        
        return bankInfo;
        
      default:
        return '💳 請依照訂單確認時選擇的付款方式付款';
    }
  }
  
  /**
   * 獲取啟用的銀行帳戶資訊
   */
  async getActiveBankAccounts() {
    try {
      // 如果是示範模式，返回模擬資料
      if (this.demoMode) {
        return [
          {
            bank_name: '中國信託商業銀行',
            branch_name: '三峽分行',
            account_name: '誠意鮮蔬有限公司',
            account_number: '123-456-789012'
          }
        ];
      }
      
      // 實際從API獲取銀行帳戶資訊  
      const axios = require('axios');
      const baseUrl = process.env.BASE_URL || 'http://localhost:3003';
      const response = await axios.get(`${baseUrl}/api/bank-accounts/active`);
      const data = response.data;
      
      if (data.success) {
        return data.accounts;
      } else {
        console.error('❌ 獲取銀行帳戶失敗:', data.message);
        return [];
      }
    } catch (error) {
      console.error('❌ 獲取銀行帳戶錯誤:', error);
      return [];
    }
  }
  
  /**
   * 生成 LINE Pay 付款連結
   * @param {number} orderId - 訂單ID
   * @param {number} amount - 金額
   */
  async generateLinePayLink(orderId, amount) {
    try {
      // 如果是示範模式，返回模擬連結
      if (this.demoMode) {
        return `https://pay.line.me/demo?orderId=${orderId}&amount=${amount}`;
      }
      
      // 實際的 LINE Pay 整合（需要 LINE Pay 商戶設定）
      // TODO: 整合真實的 LINE Pay API
      const merchantId = process.env.LINE_PAY_MERCHANT_ID;
      const redirectUrl = `${process.env.BASE_URL}/payment/linepay/callback`;
      
      if (!merchantId) {
        console.warn('⚠️ LINE Pay 商戶ID未設定，使用示範連結');
        return `https://pay.line.me/demo?orderId=${orderId}&amount=${amount}`;
      }
      
      // 實際應該調用 LINE Pay API 創建付款請求
      const linePayUrl = `https://pay.line.me/payments/request?merchantId=${merchantId}&orderId=${orderId}&amount=${amount}&redirectUrl=${encodeURIComponent(redirectUrl)}`;
      
      return linePayUrl;
      
    } catch (error) {
      console.error('❌ 生成 LINE Pay 連結錯誤:', error);
      return `https://pay.line.me/demo?orderId=${orderId}&amount=${amount}`;
    }
  }

  /**
   * 模擬包裝完成通知（用於無LINE ID的客戶）
   * @param {Object} order - 訂單資訊
   * @param {Array} orderItems - 訂單商品明細
   */
  async simulatePackagingNotification(order, orderItems) {
    console.log('🔔 ===== 模擬包裝完成通知 =====');
    console.log(`收件人: ${order.contact_name} (${order.contact_phone})`);
    console.log(`訂單編號: #${order.id}`);
    console.log(`訂單金額: NT$ ${order.total_amount}`);
    console.log(`付款方式: ${this.getPaymentMethodName(order.payment_method)}`);
    
    const paymentMessage = await this.getPaymentMessage(order.payment_method, order.total_amount, order.id);
    console.log(`付款資訊: ${paymentMessage.replace(/\n/g, ' | ')}`);
    console.log('============================');
    
    return { success: true, method: 'SIMULATION' };
  }

  /**
   * 獲取付款方式中文名稱
   */
  getPaymentMethodName(method) {
    const names = {
      cash: '現金付款',
      linepay: 'LINE Pay',
      bank_transfer: '銀行轉帳'
    };
    return names[method] || method;
  }

  /**
   * 建立訂單完成訊息
   * @param {Object} order - 訂單資訊
   * @param {Array} orderItems - 訂單商品明細
   */
  createOrderCompletedMessage(order, orderItems) {
    // 建立商品明細文字
    let itemsText = '';
    orderItems.forEach(item => {
      const weightText = item.actual_weight ? ` (${item.actual_weight}kg)` : '';
      const unitPrice = item.is_priced_item ? 
        `NT$ ${item.unit_price}/kg` : 
        `NT$ ${item.unit_price}`;
      
      itemsText += `${item.name}${weightText} x${item.quantity}\n${unitPrice} = NT$ ${item.line_total}\n\n`;
    });
    
    // 截斷過長的明細（LINE訊息有長度限制）
    if (itemsText.length > 800) {
      itemsText = itemsText.substring(0, 800) + '...\n（更多商品詳情請查看訂單）\n';
    }
    
    const messageText = `🎉 您的蔬菜訂單已包裝完成！

📦 訂單編號：#${order.id}
👤 客戶：${order.contact_name}

📋 商品明細：
${itemsText}💰 訂單總額：NT$ ${order.total_amount}

⏰ 預計30分鐘內開始配送
📞 如有問題請聯繫承億蔬菜外送

感謝您的訂購！🥬🍅🥕`;

    return {
      type: 'text',
      text: messageText
    };
  }
  
  /**
   * 處理 LIFF 用戶綁定
   * @param {string} lineUserId - LINE 用戶ID
   * @param {string} displayName - LINE 顯示名稱
   * @param {string} phone - 用戶電話號碼
   */
  async bindUserLineId(lineUserId, displayName, phone) {
    if (this.demoMode) {
      console.log('📱 [示範模式] 模擬用戶綁定:', {
        lineUserId: 'DEMO_LINE_USER_ID',
        displayName: displayName || 'DEMO用戶',
        phone: phone
      });
      return { success: true, demo: true };
    }
    
    try {
      // 這裡需要資料庫連接，暫時先記錄
      console.log(`📱 綁定LINE用戶: ${displayName} (${lineUserId}) -> 電話: ${phone}`);
      
      // TODO: 實際實作資料庫更新
      // await pool.query(`
      //   INSERT INTO users (phone, line_user_id, line_display_name)
      //   VALUES ($1, $2, $3)
      //   ON CONFLICT (phone) DO UPDATE SET
      //     line_user_id = EXCLUDED.line_user_id,
      //     line_display_name = EXCLUDED.line_display_name
      // `, [phone, lineUserId, displayName]);
      
      return { success: true };
      
    } catch (error) {
      console.error('❌ 綁定LINE用戶失敗:', error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * 記錄通知發送狀態
   * @param {number} orderId - 訂單ID
   * @param {string} notificationType - 通知類型
   * @param {string} status - 發送狀態
   * @param {string} errorMessage - 錯誤訊息（如有）
   */
  async recordNotificationSent(orderId, notificationType, status, errorMessage = null) {
    try {
      // TODO: 實際實作資料庫記錄
      console.log(`📝 記錄通知狀態: 訂單 #${orderId} - ${notificationType} - ${status}`);
      
      // await pool.query(`
      //   INSERT INTO notification_logs (order_id, notification_type, status, error_message, sent_at)
      //   VALUES ($1, $2, $3, $4, NOW())
      // `, [orderId, notificationType, status, errorMessage]);
      
    } catch (error) {
      console.error('❌ 記錄通知狀態失敗:', error);
    }
  }
  
  /**
   * 驗證 LINE Webhook 簽名
   * @param {string} body - 請求體
   * @param {string} signature - LINE 簽名
   */
  validateSignature(body, signature) {
    if (this.demoMode) {
      return true; // 示範模式跳過驗證
    }
    
    const crypto = require('crypto');
    const hash = crypto.createHmac('sha256', this.config.channelSecret)
                      .update(body)
                      .digest('base64');
    
    return hash === signature;
  }
  
  /**
   * 處理 LINE Webhook 事件
   * @param {Array} events - LINE 事件陣列
   */
  async handleWebhookEvents(events) {
    const results = [];
    
    for (const event of events) {
      try {
        let result;
        
        switch (event.type) {
          case 'message':
            result = await this.handleMessage(event);
            break;
          case 'follow':
            result = await this.handleFollow(event);
            break;
          case 'unfollow':
            result = await this.handleUnfollow(event);
            break;
          default:
            console.log(`📱 未處理的事件類型: ${event.type}`);
            result = { type: event.type, handled: false };
        }
        
        results.push(result);
        
      } catch (error) {
        console.error(`❌ 處理LINE事件失敗:`, error);
        results.push({ error: error.message });
      }
    }
    
    return results;
  }
  
  /**
   * 處理用戶訊息
   */
  async handleMessage(event) {
    if (this.demoMode) {
      return { demo: true, message: 'received' };
    }
    
    const { replyToken, message, source } = event;
    
    if (message.type === 'text') {
      const replyMessage = {
        type: 'text',
        text: `感謝您的訊息！\n\n如需訂購蔬菜，請點擊下方選單「線上訂購」\n或直接前往我們的購物網站：${process.env.WEBSITE_URL || 'https://你的網域.com'}`
      };
      
      await this.client.replyMessage(replyToken, replyMessage);
    }
    
    return { type: 'message', replied: true };
  }
  
  /**
   * 處理用戶加好友
   */
  async handleFollow(event) {
    if (this.demoMode) {
      return { demo: true, follow: 'welcomed' };
    }
    
    const { replyToken, source } = event;
    
    const welcomeMessage = {
      type: 'text',
      text: `🎉 歡迎加入承億蔬菜外送！\n\n📱 點擊下方選單「線上訂購」即可開始購買新鮮蔬菜\n🚚 我們提供快速配送服務\n💬 訂單完成後會自動通知您\n\n感謝您的支持！🥬🍅`
    };
    
    await this.client.replyMessage(replyToken, welcomeMessage);
    
    return { type: 'follow', welcomed: true };
  }
  
  /**
   * 處理用戶取消好友
   */
  async handleUnfollow(event) {
    console.log(`👋 用戶取消好友: ${event.source.userId}`);
    return { type: 'unfollow', logged: true };
  }
  
  /**
   * 檢查服務狀態
   */
  getStatus() {
    return {
      initialized: !this.demoMode,
      demoMode: this.demoMode,
      hasClient: !!this.client,
      config: {
        hasAccessToken: !!this.config.channelAccessToken,
        hasChannelSecret: !!this.config.channelSecret
      }
    };
  }
}

module.exports = LineBotService;