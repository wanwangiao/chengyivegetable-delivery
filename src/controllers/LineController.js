/**
 * LINE整合控制器
 * 處理LINE Bot相關的所有功能，包括用戶認證、訊息處理、通知等
 */

const BaseController = require('./BaseController');
const LineBotService = require('../services/LineBotService');
const LineUserService = require('../services/LineUserService');
const LineNotificationService = require('../services/LineNotificationService');

class LineController extends BaseController {
  constructor(database = null) {
    super();

    // 設置數據庫連接
    this.db = database;

    // 初始化 LINE 服務
    try {
      this.lineBotService = new LineBotService();
      console.log('🤖 LINE Bot服務已在控制器中初始化');
    } catch (error) {
      console.error('❌ LINE Bot服務初始化失敗:', error);
      this.lineBotService = null;
    }

    try {
      this.lineUserService = new LineUserService(this.db);
      console.log('👤 LINE用戶服務已在控制器中初始化');
    } catch (error) {
      console.error('❌ LINE用戶服務初始化失敗:', error);
      this.lineUserService = null;
    }

    try {
      this.lineNotificationService = new LineNotificationService();
      console.log('🔔 LINE通知服務已在控制器中初始化');
    } catch (error) {
      console.error('❌ LINE通知服務初始化失敗:', error);
      this.lineNotificationService = null;
    }
  }

  /**
   * LINE登入重導向
   * GET /auth/line/login
   */
  loginRedirect = (req, res) => {
    try {
      const clientId = process.env.LINE_CHANNEL_ID;
      const redirectUri = process.env.LINE_REDIRECT_URI;

      if (!clientId || !redirectUri) {
        return res.status(500).send('LINE 設定尚未完成');
      }

      const state = Math.random().toString(36).substring(2);
      req.session.lineState = state;

      const authUrl =
        'https://access.line.me/oauth2/v2.1/authorize' +
        '?response_type=code' +
        '&client_id=' + encodeURIComponent(clientId) +
        '&redirect_uri=' + encodeURIComponent(redirectUri) +
        '&state=' + encodeURIComponent(state) +
        '&scope=profile%20openid';

      res.redirect(authUrl);
    } catch (error) {
      this.handleError(error, res, 'LINE登入重導向');
    }
  };

  /**
   * LINE登入回調處理
   * GET /auth/line/callback
   */
  loginCallback = async (req, res) => {
    try {
      const { code, state } = req.query;
      const sessionState = req.session.lineState;

      if (!state || state !== sessionState) {
        return res.status(400).send('無效的認證狀態');
      }

      delete req.session.lineState;

      try {
        const clientId = process.env.LINE_CHANNEL_ID;
        const clientSecret = process.env.LINE_CHANNEL_SECRET;
        const redirectUri = process.env.LINE_REDIRECT_URI;

        const tokenRes = await fetch('https://api.line.me/oauth2/v2.1/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: new URLSearchParams({
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: redirectUri,
            client_id: clientId,
            client_secret: clientSecret
          })
        });

        const tokenData = await tokenRes.json();

        if (!tokenData.access_token) {
          console.error('LINE token error:', tokenData);
          return res.status(400).send('LINE 登入失敗');
        }

        const profileRes = await fetch('https://api.line.me/v2/profile', {
          headers: {
            'Authorization': `Bearer ${tokenData.access_token}`
          }
        });

        const profile = await profileRes.json();
        if (!profile.userId) {
          console.error('LINE profile error:', profile);
          return res.status(400).send('無法取得 LINE 使用者資料');
        }

        req.session.line = {
          userId: profile.userId,
          displayName: profile.displayName
        };

        res.redirect('/line-connected');
      } catch (err) {
        console.error('LINE login callback error:', err);
        res.status(500).send('LINE 登入發生錯誤');
      }
    } catch (error) {
      this.handleError(error, res, 'LINE登入回調');
    }
  };

  /**
   * LINE連接成功頁面
   * GET /line-connected
   */
  connectedPage = (req, res) => {
    try {
      res.render('line_connected', {
        title: 'LINE連接成功',
        line: req.session.line
      });
    } catch (error) {
      this.handleError(error, res, '載入LINE連接成功頁面');
    }
  };

  /**
   * LINE Bot測試頁面
   * GET /line-bot-test
   */
  botTestPage = (req, res) => {
    try {
      res.render('line-bot-test', { title: 'LINE Bot測試' });
    } catch (error) {
      this.handleError(error, res, '載入LINE Bot測試頁面');
    }
  };

  /**
   * LIFF入口頁面
   * GET /liff-entry
   */
  liffEntryPage = (req, res) => {
    try {
      const liffId = process.env.LINE_LIFF_ID || '2008130399-z1QXZgma';

      const debugInfo = {
        liffId: liffId || 'NOT_SET',
        liffIdLength: liffId ? liffId.length : 0,
        hasLiffId: !!liffId,
        envLiffId: process.env.LINE_LIFF_ID || 'MISSING',
        fallbackUsed: !process.env.LINE_LIFF_ID,
        allLineEnv: Object.keys(process.env).filter(key => key.includes('LINE'))
      };

      console.log('🕰️ LIFF Entry Debug:', debugInfo);

      res.render('liff_entry', {
        title: 'LIFF入口',
        liffId
      });
    } catch (error) {
      this.handleError(error, res, '載入LIFF入口頁面');
    }
  };

  /**
   * LIFF除錯頁面
   * GET /liff-debug
   */
  liffDebugPage = (req, res) => {
    try {
      const debugData = {
        title: 'LIFF除錯',
        liffId: '2008130399-z1QXZgma',
        channelId: process.env.LINE_CHANNEL_ID || '2007891772',
        testUrls: [
          'https://chengyivegetable-production-7b4a.up.railway.app/liff-entry',
          'https://chengyivegetable-production-7b4a.up.railway.app/liff',
          'https://chengyivegetable-production-7b4a.up.railway.app/line-entry'
        ],
        env: {
          LINE_LIFF_ID: process.env.LINE_LIFF_ID || 'NOT_SET',
          LINE_CHANNEL_ID: process.env.LINE_CHANNEL_ID || 'NOT_SET',
          NODE_ENV: process.env.NODE_ENV || 'development'
        }
      };

      res.render('liff-debug', debugData);
    } catch (error) {
      this.handleError(error, res, '載入LIFF除錯頁面');
    }
  };

  /**
   * LIFF主頁面 - 重導向到入口頁面
   * GET /liff
   */
  liffPage = (req, res) => {
    try {
      res.redirect('/liff-entry');
    } catch (error) {
      this.handleError(error, res, '載入LIFF頁面');
    }
  };

  /**
   * LINE入口頁面 - 重導向到LIFF入口
   * GET /line-entry
   */
  lineEntryPage = (req, res) => {
    try {
      res.redirect('/liff-entry');
    } catch (error) {
      this.handleError(error, res, '載入LINE入口頁面');
    }
  };

  /**
   * LINE訂單歷史頁面
   * GET /line/order-history
   */
  orderHistoryPage = (req, res) => {
    try {
      // 從 session 或 query 參數獲取用戶ID
      const userId = req.query.userId || (req.session?.line?.userId) || null;

      if (!userId) {
        return res.status(400).render('error', {
          title: '錯誤',
          message: '缺少用戶識別資訊，無法顯示訂單歷史'
        });
      }

      res.render('line_order_history', {
        title: 'LINE訂單歷史',
        userId,
        user: req.session?.line || null
      });
    } catch (error) {
      this.handleError(error, res, '載入LINE訂單歷史頁面');
    }
  };

  /**
   * LINE Webhook處理
   * POST /api/line/webhook
   */
  webhook = async (req, res) => {
    try {
      console.log('🚨 LINE Webhook 進入處理器');
      console.log('📝 Request headers:');
      Object.keys(req.headers).forEach(key => {
        if (key.toLowerCase().includes('line')) {
          console.log(`  ${key}: ${req.headers[key]}`);
        }
      });

      console.log('📝 Request body:', JSON.stringify(req.body, null, 2));
      console.log('🚨 X-Line-Signature:', req.get('x-line-signature'));

      if (!this.lineBotService) {
        console.warn('⚠️ LINE Bot 服務未初始化，使用模擬模式');
        return this.sendSuccess(res, {
          message: 'LINE Webhook received and processed (demo mode)',
          timestamp: new Date().toISOString(),
          events: req.body.events || [],
          demo: true
        });
      }

      // 驗證簽名（如果不是模擬模式）
      const signature = req.get('x-line-signature');
      if (!this.lineBotService.demoMode && signature) {
        const isValid = this.lineBotService.validateSignature(
          JSON.stringify(req.body),
          signature
        );
        if (!isValid) {
          console.error('❌ LINE Webhook 簽名驗證失敗');
          return res.status(400).json({ error: 'Invalid signature' });
        }
      }

      // 處理 Webhook 事件
      const events = req.body.events || [];
      if (events.length > 0) {
        const results = await this.lineBotService.handleWebhookEvents(events);
        console.log('📦 Webhook 事件處理結果:', results);
      }

      this.sendSuccess(res, {
        message: 'LINE Webhook received and processed',
        timestamp: new Date().toISOString(),
        eventsProcessed: events.length
      });
    } catch (error) {
      console.error('❌ LINE Webhook 處理錯誤:', error);
      this.handleError(error, res, 'LINE Webhook處理');
    }
  };

  /**
   * LINE除錯資訊
   * GET /api/line/debug
   */
  getDebugInfo = (req, res) => {
    try {
      const debugInfo = {
        timestamp: new Date().toISOString(),
        environment: {
          LINE_CHANNEL_ID: process.env.LINE_CHANNEL_ID ? 'SET (' + process.env.LINE_CHANNEL_ID + ')' : 'MISSING',
          LINE_CHANNEL_SECRET: process.env.LINE_CHANNEL_SECRET ? 'SET (length: ' + process.env.LINE_CHANNEL_SECRET.length + ')' : 'MISSING',
          LINE_CHANNEL_ACCESS_TOKEN: process.env.LINE_CHANNEL_ACCESS_TOKEN ? 'SET (length: ' + process.env.LINE_CHANNEL_ACCESS_TOKEN.length + ')' : 'MISSING',
          LINE_LIFF_ID: process.env.LINE_LIFF_ID ? 'SET (' + process.env.LINE_LIFF_ID + ')' : 'MISSING'
        },
        services: {
          lineBotService: this.lineBotService ? {
            initialized: true,
            demoMode: this.lineBotService.demoMode,
            hasClient: !!this.lineBotService.client
          } : { initialized: false },
          lineUserService: this.lineUserService ? {
            initialized: true,
            hasDatabase: !!this.lineUserService.db
          } : { initialized: false },
          lineNotificationService: this.lineNotificationService ? {
            initialized: true
          } : { initialized: false }
        },
        liffDebug: {
          liffId: process.env.LINE_LIFF_ID || 'NOT_SET',
          liffIdLength: process.env.LINE_LIFF_ID ? process.env.LINE_LIFF_ID.length : 0,
          allEnvVars: Object.keys(process.env).filter(key => key.includes('LINE')).reduce((obj, key) => {
            obj[key] = process.env[key] ? `SET (${process.env[key].length} chars)` : 'NOT_SET';
            return obj;
          }, {})
        }
      };

      this.sendSuccess(res, debugInfo);
    } catch (error) {
      this.handleError(error, res, '獲取LINE除錯資訊');
    }
  };

  /**
   * 綁定LINE用戶
   * POST /api/line/bind-user
   */
  bindUser = async (req, res) => {
    try {
      const { lineUserId, displayName, pictureUrl } = req.body;

      if (!lineUserId) {
        return this.sendError(res, {
          code: 'MISSING_LINE_USER_ID',
          message: 'LINE 用戶ID不能為空'
        }, 400);
      }

      // 模擬模式處理
      if (!this.lineBotService || this.lineBotService.demoMode) {
        console.log('📱 [示範模式] 模擬綁定 LINE 用戶:', {
          lineUserId,
          displayName,
          pictureUrl
        });

        return this.sendSuccess(res, {
          success: true,
          demo: true,
          data: {
            lineUserId,
            displayName,
            message: '用戶綁定成功（示範模式）'
          }
        });
      }

      // 實際綁定程序
      const result = await this.db.query(`
        SELECT id FROM users WHERE line_user_id = $1
      `, [lineUserId]);

      if (result.rows.length > 0) {
        // 更新現有用戶
        await this.db.query(`
          UPDATE users
          SET line_display_name = $1, name = $2
          WHERE line_user_id = $3
        `, [displayName, displayName, lineUserId]);
      } else {
        // 創建新用戶
        const tempPhone = `LINE_${lineUserId.slice(-8)}`; // 使用 LINE ID 後8位作為臨時電話
        await this.db.query(`
          INSERT INTO users (phone, name, line_user_id, line_display_name, created_at)
          VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
        `, [tempPhone, displayName, lineUserId, displayName]);
      }

      console.log(`📱 LINE用戶綁定成功: ${displayName} (${lineUserId})`);

      this.sendSuccess(res, {
        success: true,
        data: {
          lineUserId,
          displayName,
          message: '用戶綁定成功'
        }
      });
    } catch (error) {
      console.error('❌ LINE用戶綁定失敗:', error);
      this.handleError(error, res, '綁定LINE用戶');
    }
  };

  /**
   * 註冊LINE用戶
   * POST /api/line/register-user
   */
  registerUser = async (req, res) => {
    try {
      const { userId, displayName, pictureUrl, statusMessage } = req.body;

      if (!userId) {
        return this.sendError(res, {
          code: 'MISSING_USER_ID',
          message: 'LINE User ID 不能為空'
        }, 400);
      }

      if (!this.lineUserService) {
        return this.sendError(res, {
          code: 'SERVICE_UNAVAILABLE',
          message: 'LINE 用戶服務未初始化'
        }, 500);
      }

      const user = await this.lineUserService.processLineUser({
        userId,
        displayName: displayName || '匿名用戶',
        pictureUrl: pictureUrl || null,
        statusMessage: statusMessage || null
      });

      console.log(`✨ LINE 用戶註冊/更新成功: ${displayName} (${userId})`);

      this.sendSuccess(res, {
        success: true,
        data: {
          user: {
            id: user.id,
            userId: user.line_user_id,
            displayName: user.display_name || user.line_display_name,
            phone: user.phone,
            createdAt: user.created_at
          },
          message: '用戶註冊成功'
        }
      });
    } catch (error) {
      console.error('❌ LINE 用戶註冊失敗:', error);
      this.handleError(error, res, '註冊LINE用戶');
    }
  };

  /**
   * 綁定電話號碼
   * POST /api/line/bind-phone
   */
  bindPhone = async (req, res) => {
    try {
      const { userId, phone } = req.body;

      if (!userId || !phone) {
        return this.sendError(res, {
          code: 'MISSING_REQUIRED_FIELDS',
          message: '缺少必要欄位: userId 和 phone'
        }, 400);
      }

      if (!this.lineUserService) {
        return this.sendError(res, {
          code: 'SERVICE_UNAVAILABLE',
          message: 'LINE 用戶服務未初始化'
        }, 500);
      }

      await this.lineUserService.bindUserPhone(userId, phone);

      console.log(`📞 LINE 用戶電話綁定成功: ${userId} → ${phone}`);

      this.sendSuccess(res, {
        success: true,
        data: {
          userId,
          phone,
          message: '電話號碼綁定成功'
        }
      });
    } catch (error) {
      console.error('❌ 綁定電話號碼失敗:', error);
      this.handleError(error, res, '綁定電話號碼');
    }
  };

  /**
   * 獲取用戶訂單歷史
   * GET /api/line/order-history/:userId
   */
  getUserOrderHistory = async (req, res) => {
    try {
      const { userId } = req.params;

      if (!userId) {
        return this.sendError(res, {
          code: 'MISSING_USER_ID',
          message: '缺少用戶ID參數'
        }, 400);
      }

      if (!this.lineUserService) {
        return this.sendError(res, {
          code: 'SERVICE_UNAVAILABLE',
          message: 'LINE 用戶服務未初始化'
        }, 500);
      }

      const orders = await this.lineUserService.getUserOrderHistory(userId);

      console.log(`📊 獲取用戶 ${userId} 的訂單歷史，共 ${orders.length} 筆`);

      this.sendSuccess(res, {
        success: true,
        data: {
          userId,
          orders,
          total: orders.length
        }
      });
    } catch (error) {
      console.error('❌ 獲取用戶訂單歷史失敗:', error);
      this.handleError(error, res, '獲取用戶訂單歷史');
    }
  };

  /**
   * 根據電話號碼獲取用戶ID
   * GET /api/line/user-id/:phone
   */
  getUserIdByPhone = async (req, res) => {
    try {
      const { phone } = req.params;

      if (!phone) {
        return this.sendError(res, {
          code: 'MISSING_PHONE',
          message: '缺少電話號碼參數'
        }, 400);
      }

      if (!this.lineUserService) {
        return this.sendError(res, {
          code: 'SERVICE_UNAVAILABLE',
          message: 'LINE 用戶服務未初始化'
        }, 500);
      }

      // 查詢 LINE User ID
      const userId = await this.lineUserService.getLineUserIdByPhone(phone);

      if (userId) {
        this.sendSuccess(res, {
          success: true,
          data: {
            phone,
            userId,
            found: true
          }
        });
      } else {
        this.sendSuccess(res, {
          success: true,
          data: {
            phone,
            userId: null,
            found: false,
            message: '未找到對應的 LINE 用戶'
          }
        });
      }
    } catch (error) {
      console.error('❌ 查詢 LINE User ID 失敗:', error);
      this.handleError(error, res, '根據電話獲取用戶ID');
    }
  };

  /**
   * 連結訂單
   * POST /api/line/link-order
   */
  linkOrder = async (req, res) => {
    try {
      const { orderId, userId } = req.body;

      if (!orderId || !userId) {
        return this.sendError(res, {
          code: 'MISSING_REQUIRED_FIELDS',
          message: '缺少必要欄位: orderId 和 userId'
        }, 400);
      }

      if (!this.lineUserService) {
        return this.sendError(res, {
          code: 'SERVICE_UNAVAILABLE',
          message: 'LINE 用戶服務未初始化'
        }, 500);
      }

      await this.lineUserService.linkOrderToLineUser(orderId, userId);

      console.log(`🔗 訂單 #${orderId} 已連結到 LINE 用戶: ${userId}`);

      this.sendSuccess(res, {
        success: true,
        data: {
          orderId,
          userId,
          message: '訂單連結成功'
        }
      });
    } catch (error) {
      console.error('❌ 連結訂單失敗:', error);
      this.handleError(error, res, '連結訂單');
    }
  };

  /**
   * 發送訂單通知
   * POST /api/line/send-order-notification/:orderId
   */
  sendOrderNotification = async (req, res) => {
    try {
      const { orderId } = req.params;

      if (!orderId) {
        return this.sendError(res, {
          code: 'MISSING_ORDER_ID',
          message: '缺少訂單 ID'
        }, 400);
      }

      if (!this.lineBotService) {
        return this.sendError(res, {
          code: 'SERVICE_UNAVAILABLE',
          message: 'LINE Bot 服務未初始化'
        }, 500);
      }

      // 獲取訂單資訊
      const orderResult = await this.db.query(`
        SELECT o.*, u.line_user_id
        FROM orders o
        LEFT JOIN users u ON o.line_user_id = u.line_user_id
        WHERE o.id = $1
      `, [orderId]);

      if (orderResult.rows.length === 0) {
        return this.sendError(res, {
          code: 'ORDER_NOT_FOUND',
          message: '訂單不存在'
        }, 404);
      }

      const order = orderResult.rows[0];

      // 獲取訂單項目
      const itemsResult = await this.db.query(`
        SELECT * FROM order_items WHERE order_id = $1
      `, [orderId]);

      const orderItems = itemsResult.rows;

      // 發送通知
      const result = await this.lineBotService.sendOrderCompletedNotification(order, orderItems);

      if (result.success) {
        console.log(`✅ 訂單通知發送成功: 訂單 #${orderId}`);
        this.sendSuccess(res, {
          success: true,
          data: {
            orderId,
            demo: result.demo || false,
            message: '訂單通知發送成功'
          }
        });
      } else {
        console.warn(`⚠️ 訂單通知發送失敗: 訂單 #${orderId} - ${result.error || result.reason}`);
        this.sendError(res, {
          code: 'NOTIFICATION_FAILED',
          message: `通知發送失敗: ${result.error || result.reason}`
        }, 500);
      }
    } catch (error) {
      console.error('❌ 發送訂單通知失敗:', error);
      this.handleError(error, res, '發送訂單通知');
    }
  };

  /**
   * 獲取當前會話用戶的訂單歷史
   * GET /api/line/my-order-history
   */
  getMyOrderHistory = async (req, res) => {
    try {
      // 從session獲取LINE用戶ID
      const lineUserId = req.session?.line?.userId || req.session?.lineUserId;

      if (!lineUserId) {
        return this.sendError(res, {
          code: 'NOT_AUTHENTICATED',
          message: '用戶未綁定LINE或session已過期'
        }, 401);
      }

      console.log(`📄 獲取用戶訂單歷史:`, {
        sessionLine: req.session?.line,
        sessionLineUserId: req.session?.lineUserId,
        extractedUserId: lineUserId
      });

      if (!this.lineUserService) {
        return this.sendError(res, {
          code: 'SERVICE_UNAVAILABLE',
          message: 'LINE 用戶服務未初始化'
        }, 500);
      }

      const orders = await this.lineUserService.getUserOrderHistory(lineUserId);

      this.sendSuccess(res, {
        success: true,
        data: {
          userId: lineUserId,
          orders,
          total: orders.length
        }
      });
    } catch (error) {
      console.error('❌ 獲取當前用戶訂單歷史失敗:', error);
      this.handleError(error, res, '獲取當前用戶訂單歷史');
    }
  };

  /**
   * 獲取特定訂單詳情（只能查看自己的訂單）
   * GET /api/line/order-detail/:orderId
   */
  getOrderDetail = async (req, res) => {
    try {
      const { orderId } = req.params;
      const lineUserId = req.session?.line?.userId || req.session?.lineUserId;

      if (!lineUserId) {
        return this.sendError(res, {
          code: 'NOT_AUTHENTICATED',
          message: '用戶未綁定LINE或session已過期'
        }, 401);
      }

      if (!orderId) {
        return this.sendError(res, {
          code: 'MISSING_ORDER_ID',
          message: '缺少訂單 ID'
        }, 400);
      }

      // 模擬模式處理
      if (!this.db) {
        const mockOrder = {
          id: orderId,
          status: 'delivered',
          total: 320,
          created_at: new Date(),
          items: [
            { name: '有機高麗菜', quantity: 1, is_priced_item: false, line_total: 30 },
            { name: '新鮮玉米筍', quantity: 2, is_priced_item: false, line_total: 170 }
          ]
        };

        return this.sendSuccess(res, {
          success: true,
          demo: true,
          data: { order: mockOrder }
        });
      }

      // 查詢訂單（確保只能查看自己的）
      const orderResult = await this.db.query(`
        SELECT o.*, u.line_user_id
        FROM orders o
        LEFT JOIN users u ON o.line_user_id = u.line_user_id
        WHERE o.id = $1 AND u.line_user_id = $2
      `, [orderId, lineUserId]);

      if (orderResult.rows.length === 0) {
        return this.sendError(res, {
          code: 'ORDER_NOT_FOUND',
          message: '訂單不存在或您無權查看'
        }, 404);
      }

      const order = orderResult.rows[0];

      // 獲取訂單項目
      const itemsResult = await this.db.query(`
        SELECT id, product_id, name, is_priced_item,
               quantity, unit_price, line_total, actual_weight
        FROM order_items
        WHERE order_id = $1
      `, [orderId]);

      order.items = itemsResult.rows;

      this.sendSuccess(res, {
        success: true,
        data: { order }
      });
    } catch (error) {
      console.error('❌ 獲取訂單詳情失敗:', error);
      this.handleError(error, res, '獲取訂單詳情');
    }
  };

  /**
   * 取消訂單（只能取消自己的訂單）
   * POST /api/line/cancel-order/:orderId
   */
  cancelOrder = async (req, res) => {
    try {
      const { orderId } = req.params;
      const lineUserId = req.session?.line?.userId || req.session?.lineUserId;

      if (!lineUserId) {
        return this.sendError(res, {
          code: 'NOT_AUTHENTICATED',
          message: '用戶未綁定LINE或session已過期'
        }, 401);
      }

      if (!orderId) {
        return this.sendError(res, {
          code: 'MISSING_ORDER_ID',
          message: '缺少訂單 ID'
        }, 400);
      }

      // 模擬模式處理
      if (!this.db) {
        return this.sendSuccess(res, {
          success: true,
          demo: true,
          data: {
            orderId,
            message: '訂單取消成功（示範模式）'
          }
        });
      }

      // 檢查訂單狀態和權限
      const orderResult = await this.db.query(`
        SELECT o.id, o.status, u.line_user_id
        FROM orders o
        LEFT JOIN users u ON o.line_user_id = u.line_user_id
        WHERE o.id = $1 AND u.line_user_id = $2
      `, [orderId, lineUserId]);

      if (orderResult.rows.length === 0) {
        return this.sendError(res, {
          code: 'ORDER_NOT_FOUND',
          message: '訂單不存在或您無權操作'
        }, 404);
      }

      const order = orderResult.rows[0];

      // 檢查是否可以取消
      if (order.status !== 'placed') {
        return this.sendError(res, {
          code: 'CANNOT_CANCEL',
          message: '該訂單狀態不允許取消'
        }, 400);
      }

      // 更新訂單狀態
      await this.db.query(`
        UPDATE orders
        SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `, [orderId]);

      // 獲取更新後的訂單金額用於退款計算
      const refundResult = await this.db.query(`
        SELECT id, line_total FROM order_items
        WHERE order_id = $1
      `, [orderId]);

      let refundAmount = 0;
      for (const item of refundResult.rows) {
        refundAmount += Number(item.line_total || 0);
      }
      refundAmount += 50; // 加上運費

      console.log(`❌ 訂單 #${orderId} 已取消，預計退款金額: NT$ ${refundAmount}`);

      this.sendSuccess(res, {
        success: true,
        data: {
          orderId,
          refundAmount,
          message: '訂單取消成功'
        }
      });
    } catch (error) {
      console.error('❌ 取消訂單失敗:', error);
      this.handleError(error, res, '取消訂單');
    }
  };
}

module.exports = LineController;