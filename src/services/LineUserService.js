/**
 * LINE 用戶服務
 * 處理 LINE ID 獲取、用戶註冊和管理
 */

class LineUserService {
  constructor(database = null) {
    this.db = database;
    // 緊急修復：恢復原本的LIFF ID（完整版本）
    this.liffId = process.env.LINE_LIFF_ID || '2007966099';
    this.channelId = process.env.LINE_CHANNEL_ID || '';
    this.enabled = !!(this.liffId && this.channelId);
    
    console.log('🔐 LINE 用戶服務初始化:', this.enabled ? `已啟用 (LIFF: ${this.liffId})` : '未啟用（缺少 LIFF 設定）');
  }

  /**
   * 處理來自 LINE 的用戶訪問
   * @param {Object} liffProfile - LIFF 用戶資料
   * @param {string} liffProfile.userId - LINE User ID
   * @param {string} liffProfile.displayName - 用戶顯示名稱
   * @param {string} liffProfile.pictureUrl - 用戶頭像 URL
   * @param {string} liffProfile.statusMessage - 用戶狀態訊息
   */
  async processLineUser(liffProfile) {
    try {
      const { userId, displayName, pictureUrl, statusMessage } = liffProfile;
      
      if (!userId) {
        throw new Error('LINE User ID 遺失');
      }

      // 檢查用戶是否已存在
      let user = await this.getLineUser(userId);
      
      if (!user) {
        // 自動註冊新用戶
        user = await this.registerLineUser({
          userId,
          displayName: displayName || '匿名用戶',
          pictureUrl: pictureUrl || null,
          statusMessage: statusMessage || null
        });
        
        console.log(`✨ 新用戶自動註冊: ${displayName} (${userId})`);
      } else {
        // 更新現有用戶資訊
        await this.updateLineUser(userId, {
          displayName: displayName || user.display_name,
          pictureUrl: pictureUrl || user.picture_url,
          statusMessage: statusMessage || user.status_message,
          lastVisit: new Date()
        });
        
        console.log(`🔄 用戶資訊更新: ${displayName} (${userId})`);
      }

      return user;

    } catch (error) {
      console.error('處理 LINE 用戶失敗:', error);
      throw error;
    }
  }

  /**
   * 取得 LINE 用戶資料
   * @param {string} userId - LINE User ID
   */
  async getLineUser(userId) {
    try {
      if (!this.db) {
        // 示範模式：返回模擬用戶
        return {
          id: 1,
          line_user_id: userId,
          display_name: '示範用戶',
          phone: null,
          email: null,
          picture_url: null,
          status_message: null,
          is_verified: false,
          created_at: new Date(),
          last_visit: new Date()
        };
      }

      const result = await this.db.query(`
        SELECT * FROM line_users WHERE line_user_id = $1
      `, [userId]);

      return result.rows[0] || null;

    } catch (error) {
      console.error('查詢 LINE 用戶失敗:', error);
      throw error;
    }
  }

  /**
   * 註冊新的 LINE 用戶
   * @param {Object} userData - 用戶資料
   */
  async registerLineUser(userData) {
    try {
      const { userId, displayName, pictureUrl, statusMessage } = userData;

      if (!this.db) {
        // 示範模式：返回模擬註冊結果
        console.log(`🔄 示範模式：LINE 用戶已註冊 - ${displayName}`);
        return {
          id: Date.now(),
          line_user_id: userId,
          display_name: displayName,
          phone: null,
          email: null,
          picture_url: pictureUrl,
          status_message: statusMessage,
          is_verified: false,
          created_at: new Date(),
          last_visit: new Date()
        };
      }

      const result = await this.db.query(`
        INSERT INTO line_users (
          line_user_id, display_name, picture_url, status_message,
          is_verified, created_at, last_visit
        ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING *
      `, [userId, displayName, pictureUrl, statusMessage, false]);

      return result.rows[0];

    } catch (error) {
      console.error('註冊 LINE 用戶失敗:', error);
      throw error;
    }
  }

  /**
   * 更新 LINE 用戶資訊
   * @param {string} userId - LINE User ID
   * @param {Object} updateData - 更新資料
   */
  async updateLineUser(userId, updateData) {
    try {
      const { displayName, pictureUrl, statusMessage, lastVisit } = updateData;

      if (!this.db) {
        // 示範模式：模擬更新
        console.log(`🔄 示範模式：LINE 用戶已更新 - ${displayName}`);
        return true;
      }

      await this.db.query(`
        UPDATE line_users 
        SET display_name = $1, 
            picture_url = $2, 
            status_message = $3,
            last_visit = $4
        WHERE line_user_id = $5
      `, [displayName, pictureUrl, statusMessage, lastVisit || new Date(), userId]);

      return true;

    } catch (error) {
      console.error('更新 LINE 用戶失敗:', error);
      throw error;
    }
  }

  /**
   * 綁定 LINE 用戶與電話號碼
   * @param {string} userId - LINE User ID
   * @param {string} phone - 電話號碼
   */
  async bindUserPhone(userId, phone) {
    try {
      if (!phone || !phone.match(/^[0-9-+().\s]+$/)) {
        throw new Error('電話號碼格式錯誤');
      }

      if (!this.db) {
        // 示範模式：模擬綁定
        console.log(`📞 示範模式：電話綁定 - ${userId} → ${phone}`);
        return true;
      }

      await this.db.query(`
        UPDATE line_users 
        SET phone = $1, is_verified = true, verified_at = CURRENT_TIMESTAMP
        WHERE line_user_id = $2
      `, [phone, userId]);

      console.log(`📞 LINE 用戶電話綁定成功: ${userId} → ${phone}`);
      return true;

    } catch (error) {
      console.error('綁定電話號碼失敗:', error);
      throw error;
    }
  }

  /**
   * 透過電話號碼查詢 LINE User ID
   * @param {string} phone - 電話號碼
   */
  async getLineUserIdByPhone(phone) {
    try {
      if (!this.db) {
        // 示範模式：返回模擬 ID
        return `U${phone.replace(/[^0-9]/g, '').slice(-8)}`;
      }

      const result = await this.db.query(`
        SELECT line_user_id FROM line_users 
        WHERE phone = $1 AND is_verified = true
      `, [phone]);

      return result.rows[0]?.line_user_id || null;

    } catch (error) {
      console.error('查詢 LINE User ID 失敗:', error);
      return null;
    }
  }

  /**
   * 為訂單關聯 LINE 用戶
   * @param {number} orderId - 訂單 ID
   * @param {string} userId - LINE User ID
   */
  async linkOrderToLineUser(orderId, userId) {
    try {
      if (!this.db) {
        // 示範模式：模擬關聯
        console.log(`🔗 示範模式：訂單關聯 LINE 用戶 - 訂單 #${orderId} → ${userId}`);
        return true;
      }

      await this.db.query(`
        UPDATE orders 
        SET line_user_id = $1
        WHERE id = $2
      `, [userId, orderId]);

      console.log(`🔗 訂單 #${orderId} 已關聯 LINE 用戶: ${userId}`);
      return true;

    } catch (error) {
      console.error('關聯訂單與 LINE 用戶失敗:', error);
      throw error;
    }
  }

  /**
   * 取得用戶的訂單歷史
   * @param {string} userId - LINE User ID
   */
  async getUserOrderHistory(userId) {
    try {
      if (!this.db) {
        // 示範模式：返回模擬訂單
        return [
          {
            id: 1,
            total: 350,
            status: 'delivered',
            created_at: new Date(Date.now() - 24*60*60*1000),
            items_count: 3
          },
          {
            id: 2,
            total: 280,
            status: 'delivering',
            created_at: new Date(Date.now() - 2*60*60*1000),
            items_count: 2
          }
        ];
      }

      const result = await this.db.query(`
        SELECT 
          o.id,
          o.total,
          o.status,
          o.created_at,
          COUNT(oi.id) as items_count
        FROM orders o
        LEFT JOIN order_items oi ON o.id = oi.order_id
        WHERE o.line_user_id = $1
        GROUP BY o.id, o.total, o.status, o.created_at
        ORDER BY o.created_at DESC
        LIMIT 10
      `, [userId]);

      return result.rows;

    } catch (error) {
      console.error('查詢用戶訂單歷史失敗:', error);
      return [];
    }
  }

  /**
   * 產生 LIFF URL
   * @param {string} path - 目標頁面路徑
   */
  generateLiffUrl(path = '') {
    if (!this.liffId) {
      return null;
    }

    const baseUrl = `https://liff.line.me/${this.liffId}`;
    return path ? `${baseUrl}${path}` : baseUrl;
  }

  /**
   * 取得 LINE 登入 URL
   * @param {string} redirectUri - 重導向 URI
   */
  getLineLoginUrl(redirectUri) {
    if (!this.channelId) {
      return null;
    }

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.channelId,
      redirect_uri: redirectUri,
      state: Math.random().toString(36).substring(2),
      scope: 'profile openid'
    });

    return `https://access.line.me/oauth2/v2.1/authorize?${params.toString()}`;
  }

  /**
   * 驗證 LIFF 初始化
   */
  validateLiffSetup() {
    const issues = [];

    if (!this.liffId) {
      issues.push('缺少 LINE_LIFF_ID 環境變數');
    }

    if (!this.channelId) {
      issues.push('缺少 LINE_CHANNEL_ID 環境變數');
    }

    return {
      valid: issues.length === 0,
      issues
    };
  }
}

module.exports = LineUserService;