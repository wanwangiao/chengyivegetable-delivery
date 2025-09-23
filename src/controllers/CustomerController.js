/**
 * 客戶控制器
 * 處理客戶相關的所有功能，包括首頁、訂單查詢、用戶資料等
 */

const BaseController = require('./BaseController');
const LineUserService = require('../services/LineUserService');

class CustomerController extends BaseController {
  constructor() {
    super();
    this.lineUserService = null;
    this.demoMode = process.env.NODE_ENV !== 'production'; // 開發模式啟用示範模式
  }

  /**
   * 初始化服務
   * @param {Object} services - 服務對象集合
   */
  initialize(services) {
    this.setServices(services);
    if (services.pool) {
      this.setDatabasePool(services.pool);
      this.lineUserService = new LineUserService(services.pool);
    }
    // 設置 demoMode 如果有提供
    if (services.demoMode !== undefined) {
      this.demoMode = services.demoMode;
    }
  }

  /**
   * 網站首頁
   * GET /
   */
  homePage = async (req, res) => {
    try {
      // 獲取商品資料（暫時使用空陣列，避免視圖錯誤）
      const products = [];

      res.render('index_new_design', {
        title: '誠憶鮮蔬',
        products: products
      });
    } catch (error) {
      this.handleError(error, res, '載入首頁');
    }
  };

  /**
   * 外送地圖頁面
   * GET /delivery-map
   */
  deliveryMapPage = (req, res) => {
    // TODO: 從 server.js 遷移外送地圖頁面邏輯
    try {
      res.render('delivery-map', { title: '外送地圖' });
    } catch (error) {
      this.handleError(error, res, '載入外送地圖頁面');
    }
  };

  /**
   * WebSocket測試頁面
   * GET /websocket-test
   */
  websocketTestPage = (req, res) => {
    // TODO: 從 server.js 遷移WebSocket測試頁面邏輯
    try {
      res.render('websocket-test', { title: 'WebSocket測試' });
    } catch (error) {
      this.handleError(error, res, '載入WebSocket測試頁面');
    }
  };

  /**
   * 測試儀表板頁面
   * GET /test-dashboard
   */
  testDashboardPage = (req, res) => {
    try {
      res.render('test-dashboard', { title: '測試儀表板' });
    } catch (error) {
      this.handleError(error, res, '載入測試儀表板頁面');
    }
  };

  /**
   * 測試前端載入頁面
   * GET /test-frontend-loading
   */
  testFrontendLoadingPage = (req, res) => {
    try {
      res.render('test-frontend-loading', { title: '前端載入測試' });
    } catch (error) {
      this.handleError(error, res, '載入前端載入測試頁面');
    }
  };

  /**
   * 除錯行動版頁面
   * GET /debug-mobile
   */
  debugMobilePage = (req, res) => {
    try {
      res.render('debug-mobile', { title: '行動版除錯' });
    } catch (error) {
      this.handleError(error, res, '載入行動版除錯頁面');
    }
  };

  /**
   * 緊急修復頁面
   * GET /emergency-fix
   */
  emergencyFixPage = (req, res) => {
    try {
      res.render('emergency-fix', { title: '緊急修復' });
    } catch (error) {
      this.handleError(error, res, '載入緊急修復頁面');
    }
  };

  /**
   * 獲取用戶訂單
   * GET /api/user/orders
   */
  getUserOrders = async (req, res) => {
    try {
      // 從session獲取LINE用戶ID
      const lineUserId = req.session?.line?.userId || req.session?.lineUserId;

      if (!lineUserId) {
        return res.status(401).json({
          success: false,
          message: '用戶未綁定LINE或session已過期'
        });
      }

      if (this.demoMode) {
        // 示範模式：返回模擬訂單資料
        const mockOrders = [
          {
            id: 1001,
            status: 'confirmed',
            total: 250,
            created_at: new Date(Date.now() - 86400000 * 1).toISOString(), // 1天前
            items: [
              { name: '高麗菜', quantity: 1 },
              { name: '紅蘿蔔', quantity: 2 }
            ],
            contact_name: '示範用戶',
            contact_phone: '0912345678',
            address: '新北市三峽區示範路123號'
          },
          {
            id: 1002,
            status: 'completed',
            total: 180,
            created_at: new Date(Date.now() - 86400000 * 3).toISOString(), // 3天前
            items: [
              { name: '青江菜', quantity: 3 },
              { name: '番茄', quantity: 1 }
            ],
            contact_name: '示範用戶',
            contact_phone: '0912345678',
            address: '新北市三峽區示範路123號'
          },
          {
            id: 1003,
            status: 'preparing',
            total: 320,
            created_at: new Date(Date.now() - 3600000).toISOString(), // 1小時前
            items: [
              { name: '白蘿蔔', quantity: 1 },
              { name: '花椰菜', quantity: 2 },
              { name: '蔥', quantity: 1 }
            ],
            contact_name: '示範用戶',
            contact_phone: '0912345678',
            address: '新北市三峽區示範路123號'
          }
        ];

        console.log(`📝 示範模式：返回 ${mockOrders.length} 筆模擬訂單`);
        return res.json({
          success: true,
          orders: mockOrders,
          userId: lineUserId
        });
      }

      // 生產模式：查詢真實訂單資料
      if (!this.lineUserService) {
        return res.status(503).json({
          success: false,
          message: 'LINE 用戶服務未初始化'
        });
      }

      const orders = await this.lineUserService.getUserOrderHistory(lineUserId);

      res.json({
        success: true,
        orders: orders || [],
        userId: lineUserId
      });

    } catch (error) {
      console.error('❌ 獲取用戶訂單失敗:', error);
      res.status(500).json({
        success: false,
        message: '獲取訂單記錄時發生錯誤',
        error: this.demoMode ? error.message : undefined
      });
    }
  };

  /**
   * 獲取用戶訂單詳情
   * GET /api/user/orders/:orderId/details
   */
  getUserOrderDetails = async (req, res) => {
    try {
      const { orderId } = req.params;
      const lineUserId = req.session?.line?.userId || req.session?.lineUserId;

      if (!lineUserId) {
        return res.status(401).json({
          success: false,
          message: '用戶未綁定LINE或session已過期'
        });
      }

      if (this.demoMode) {
        // 示範模式：返回模擬訂單詳情
        const mockOrderDetail = {
          id: parseInt(orderId),
          status: 'confirmed',
          total: 250,
          subtotal: 200,
          delivery_fee: 50,
          created_at: new Date(Date.now() - 86400000).toISOString(),
          address: '新北市三峽區示範路123號',
          notes: '請小心包裝',
          contact_name: '示範用戶',
          contact_phone: '0912345678'
        };

        const mockItems = [
          {
            id: 1,
            product_id: 1,
            name: '高麗菜',
            quantity: 1,
            unit_price: 30,
            line_total: 30,
            is_priced_item: false,
            unit_hint: '顆'
          },
          {
            id: 2,
            product_id: 2,
            name: '紅蘿蔔',
            quantity: 2,
            unit_price: 85,
            line_total: 170,
            is_priced_item: true,
            unit_hint: '斤'
          }
        ];

        console.log(`📝 示範模式：返回訂單 #${orderId} 詳情`);
        return res.json({
          success: true,
          order: mockOrderDetail,
          items: mockItems
        });
      }

      // 生產模式：查詢真實資料
      this.checkDatabaseConnection();

      const orderResult = await this.pool.query(`
        SELECT o.*, u.line_user_id
        FROM orders o
        LEFT JOIN users u ON o.contact_phone = u.phone
        WHERE o.id = $1 AND u.line_user_id = $2
      `, [orderId, lineUserId]);

      if (orderResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: '找不到指定的訂單或無權限查看'
        });
      }

      const itemsResult = await this.pool.query(`
        SELECT
          id, product_id, name, is_priced_item,
          quantity, unit_price, line_total, actual_weight
        FROM order_items
        WHERE order_id = $1
        ORDER BY id
      `, [orderId]);

      res.json({
        success: true,
        order: orderResult.rows[0],
        items: itemsResult.rows
      });

    } catch (error) {
      console.error('❌ 獲取訂單詳情失敗:', error);
      res.status(500).json({
        success: false,
        message: '獲取訂單詳情時發生錯誤',
        error: this.demoMode ? error.message : undefined
      });
    }
  };

  /**
   * 取消訂單項目
   * DELETE /api/orders/:orderId/items/:itemId/cancel
   */
  cancelOrderItem = async (req, res) => {
    try {
      const { orderId, itemId } = req.params;
      const lineUserId = req.session?.line?.userId || req.session?.lineUserId;

      if (!lineUserId) {
        return res.status(401).json({
          success: false,
          message: '用戶未綁定LINE或session已過期'
        });
      }

      if (this.demoMode) {
        console.log(`📝 示範模式：模擬取消訂單 #${orderId} 中的商品 #${itemId}`);
        return res.json({
          success: true,
          message: '商品已成功取消',
          demo: true
        });
      }

      // 檢查資料庫連線
      this.checkDatabaseConnection();

      // 檢查訂單權限和狀態
      const orderResult = await this.pool.query(`
        SELECT o.id, o.status, u.line_user_id
        FROM orders o
        LEFT JOIN users u ON o.contact_phone = u.phone
        WHERE o.id = $1 AND u.line_user_id = $2
      `, [orderId, lineUserId]);

      if (orderResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: '找不到指定的訂單或無權限操作'
        });
      }

      const order = orderResult.rows[0];

      // 只允許取消待確認和已確認的訂單中的商品
      if (!['placed', 'confirmed'].includes(order.status)) {
        return res.status(400).json({
          success: false,
          message: '此訂單狀態不允許取消商品'
        });
      }

      // 開始交易
      const client = await this.pool.connect();
      try {
        await client.query('BEGIN');

        // 檢查商品是否存在
        const itemResult = await client.query(`
          SELECT id, line_total FROM order_items
          WHERE id = $1 AND order_id = $2
        `, [itemId, orderId]);

        if (itemResult.rows.length === 0) {
          throw new Error('找不到指定的商品');
        }

        const itemTotal = itemResult.rows[0].line_total;

        // 刪除商品
        await client.query('DELETE FROM order_items WHERE id = $1', [itemId]);

        // 更新訂單總額
        await client.query(`
          UPDATE orders
          SET total = total - $1,
              subtotal = GREATEST(subtotal - $1, 0)
          WHERE id = $2
        `, [itemTotal, orderId]);

        // 檢查訂單是否還有商品
        const remainingItems = await client.query(`
          SELECT COUNT(*) as count FROM order_items WHERE order_id = $1
        `, [orderId]);

        if (remainingItems.rows[0].count === 0) {
          // 如果沒有商品了，將訂單標記為已取消
          await client.query(`
            UPDATE orders SET status = 'cancelled' WHERE id = $1
          `, [orderId]);
        }

        await client.query('COMMIT');

        res.json({
          success: true,
          message: '商品已成功取消',
          orderEmpty: remainingItems.rows[0].count === 0
        });

      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }

    } catch (error) {
      console.error('❌ 取消商品失敗:', error);
      res.status(500).json({
        success: false,
        message: '取消商品時發生錯誤: ' + error.message
      });
    }
  };

  /**
   * 獲取外送區域
   * GET /api/delivery-areas
   */
  getDeliveryAreas = async (req, res) => {
    try {
      if (this.demoMode) {
        // 示範模式：回傳預設開放區域
        const demoAreas = [
          { city: '台北市', district: '中正區' },
          { city: '台北市', district: '大安區' },
          { city: '台北市', district: '信義區' },
          { city: '台北市', district: '松山區' },
          { city: '台北市', district: '大同區' },
          { city: '新北市', district: '板橋區' },
          { city: '新北市', district: '新店區' },
          { city: '新北市', district: '中和區' },
          { city: '新北市', district: '永和區' },
          { city: '桃園市', district: '桃園區' },
          { city: '桃園市', district: '中壢區' }
        ];

        // 組織成縣市->區域的結構
        const organized = {};
        demoAreas.forEach(area => {
          if (!organized[area.city]) {
            organized[area.city] = [];
          }
          organized[area.city].push(area.district);
        });

        return res.json({ success: true, data: organized });
      }

      // 檢查資料庫連線
      this.checkDatabaseConnection();

      const result = await this.pool.query('SELECT city, district FROM delivery_areas WHERE enabled = true ORDER BY city, district');

      // 組織成縣市->區域的結構
      const organized = {};
      result.rows.forEach(area => {
        if (!organized[area.city]) {
          organized[area.city] = [];
        }
        organized[area.city].push(area.district);
      });

      res.json({ success: true, data: organized });
    } catch (error) {
      console.error('獲取可用配送區域失敗:', error);
      res.status(500).json({ success: false, message: '獲取可用區域失敗' });
    }
  };

  /**
   * 獲取營業時間
   * GET /api/business-hours
   */
  getBusinessHours = (req, res) => {
    try {
      const defaultHours = {
        monday: { open: '06:00', close: '13:00', closed: false },
        tuesday: { open: '06:00', close: '13:00', closed: false },
        wednesday: { open: '06:00', close: '13:00', closed: false },
        thursday: { open: '06:00', close: '13:00', closed: false },
        friday: { open: '06:00', close: '13:00', closed: false },
        saturday: { open: '06:00', close: '13:00', closed: false },
        sunday: { open: '06:00', close: '13:00', closed: true }
      };
      res.json(defaultHours);
    } catch (err) {
      console.error('❌ 取得營業時間失敗:', err);
      res.status(500).json({ error: '取得營業時間失敗' });
    }
  };

  /**
   * 測試API
   * GET /api/test
   */
  testApi = (req, res) => {
    try {
      const testData = {
        message: 'API正常運作',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'production'
      };

      this.sendSuccess(res, testData, 'API測試成功');
    } catch (error) {
      this.handleError(error, res, 'API測試');
    }
  };

  /**
   * 追蹤訂單頁面 (另一個版本)
   * GET /track-order/:id
   */
  trackOrderPage = async (req, res) => {
    // TODO: 從 server.js 遷移追蹤訂單頁面邏輯
    try {
      res.render('track-order', { title: '追蹤訂單' });
    } catch (error) {
      this.handleError(error, res, '載入追蹤訂單頁面');
    }
  };

  /**
   * 測試統計API
   * GET /api/test/stats
   */
  getTestStats = async (req, res) => {
    try {
      // 檢查資料庫連線
      this.checkDatabaseConnection();

      // 總訂單數
      const totalOrdersResult = await this.pool.query('SELECT COUNT(*) as count FROM orders');
      const totalOrders = parseInt(totalOrdersResult.rows[0].count);

      // 今日新增訂單
      const todayOrdersResult = await this.pool.query(`
        SELECT COUNT(*) as count FROM orders
        WHERE DATE(created_at) = CURRENT_DATE
      `);
      const todayOrders = parseInt(todayOrdersResult.rows[0].count);

      // 平均訂單金額
      const avgOrderResult = await this.pool.query(`
        SELECT AVG(total_amount) as avg FROM orders
        WHERE total_amount > 0
      `);
      const avgOrderValue = Math.round(parseFloat(avgOrderResult.rows[0].avg) || 0);

      // 不重複客戶數
      const customersResult = await this.pool.query(`
        SELECT COUNT(DISTINCT contact_phone) as count FROM orders
      `);
      const totalCustomers = parseInt(customersResult.rows[0].count);

      // 已完成訂單
      const completedResult = await this.pool.query(`
        SELECT COUNT(*) as count FROM orders
        WHERE status IN ('completed', 'delivered')
      `);
      const completedOrders = parseInt(completedResult.rows[0].count);

      // 進行中訂單
      const activeResult = await this.pool.query(`
        SELECT COUNT(*) as count FROM orders
        WHERE status IN ('preparing', 'packed', 'delivering')
      `);
      const activeOrders = parseInt(activeResult.rows[0].count);

      res.json({
        success: true,
        totalOrders,
        todayOrders,
        avgOrderValue,
        totalCustomers,
        completedOrders,
        activeOrders
      });

    } catch (error) {
      console.error('獲取測試統計失敗:', error);
      res.status(500).json({
        success: false,
        message: '獲取統計數據失敗'
      });
    }
  };

  /**
   * 獲取最近訂單
   * GET /api/test/recent-orders
   */
  getRecentOrders = async (req, res) => {
    try {
      // 檢查資料庫連線
      this.checkDatabaseConnection();

      const result = await this.pool.query(`
        SELECT id, contact_name, address, total_amount, status, created_at
        FROM orders
        ORDER BY created_at DESC
        LIMIT 20
      `);

      res.json({
        success: true,
        orders: result.rows
      });

    } catch (error) {
      console.error('獲取最新訂單失敗:', error);
      res.status(500).json({
        success: false,
        message: '獲取訂單列表失敗'
      });
    }
  };

  /**
   * 建立測試訂單
   * POST /api/test/create-orders
   */
  createTestOrders = async (req, res) => {
    try {
      const { count = 5 } = req.body;

      // 檢查資料庫連線
      this.checkDatabaseConnection();

      // 需要引入測試訂單創建功能
      const { createTestOrders } = require('../../create_test_orders.js');

      const client = await this.pool.connect();
      const createdOrders = await createTestOrders(client, count);
      client.release();

      res.json({
        success: true,
        message: `成功建立 ${createdOrders.length} 筆測試訂單`,
        created: createdOrders.length
      });

    } catch (error) {
      console.error('建立測試訂單失敗:', error);
      res.status(500).json({
        success: false,
        message: '建立測試訂單失敗: ' + error.message
      });
    }
  };
}

module.exports = CustomerController;