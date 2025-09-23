/**
 * 管理員控制器
 * 處理管理員相關的所有功能，包括後台登入、儀表板、系統設定等
 */

const BaseController = require('./BaseController');

class AdminController extends BaseController {
  constructor() {
    super();
  }

  /**
   * 管理員登入頁面
   * GET /admin/login
   */
  loginPage = (req, res) => {
    try {
      res.render('admin_login', {
        title: '管理員登入',
        error: null
      });
    } catch (error) {
      this.handleError(error, res, '載入管理員登入頁面');
    }
  };

  /**
   * 管理員登入處理
   * POST /admin/login
   */
  login = async (req, res) => {
    try {
      const { password } = req.body;
      const adminPassword = process.env.ADMIN_PASSWORD;

      // 安全檢查：確保管理員密碼已設置
      if (!adminPassword) {
        console.error('❌ 安全錯誤: ADMIN_PASSWORD 環境變數未設置');
        return res.status(500).render('admin_login', {
          title: '管理員登入',
          error: '系統配置錯誤，請聯繫系統管理員'
        });
      }

      // 輸入驗證
      if (!password || password.trim().length === 0) {
        console.log('❌ 登入失敗: 密碼為空');
        return res.render('admin_login', {
          title: '管理員登入',
          error: '請輸入密碼'
        });
      }

      const trimmedPassword = password.trim();
      console.log('🔐 管理員登入嘗試');

      if (trimmedPassword === adminPassword) {
        // 成功登入
        req.session.isAdmin = true;
        req.session.loginTime = new Date();
        req.session.lastActivity = new Date();
        req.session.userAgent = req.get('User-Agent');

        console.log('✅ 管理員登入成功，重導向到 dashboard');
        return res.redirect('/admin/dashboard');
      }

      // 密碼錯誤
      console.log('❌ 管理員登入失敗: 密碼錯誤');
      res.render('admin_login', {
        title: '管理員登入',
        error: '密碼錯誤，請重新輸入'
      });

    } catch (error) {
      console.error('❌ 登入處理錯誤:', error);
      res.render('admin_login', {
        title: '管理員登入',
        error: '系統錯誤，請稍後再試'
      });
    }
  };

  /**
   * 管理員登出
   * GET /admin/logout
   */
  logout = (req, res) => {
    try {
      req.session.destroy((err) => {
        if (err) {
          console.error('登出時發生錯誤:', err);
        }
        res.redirect('/admin/login');
      });
    } catch (error) {
      this.handleError(error, res, '管理員登出');
    }
  };

  /**
   * 管理員首頁重導向
   * GET /admin
   */
  adminHome = (req, res) => {
    try {
      res.redirect('/admin/dashboard');
    } catch (error) {
      this.handleError(error, res, '管理員首頁重導向');
    }
  };

  /**
   * 管理員儀表板
   * GET /admin/dashboard
   */
  dashboard = async (req, res) => {
    try {
      // 檢查管理員身份
      if (!req.session.isAdmin) {
        return res.redirect('/admin/login');
      }

      res.render('admin_dashboard', {
        title: '管理員儀表板',
        user: {
          loginTime: req.session.loginTime,
          lastActivity: req.session.lastActivity
        },
        googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY || ''
      });
    } catch (error) {
      this.handleError(error, res, '載入管理員儀表板');
    }
  };

  /**
   * 管理員儀表板 API
   * GET /api/admin/dashboard
   */
  getDashboardData = async (req, res) => {
    try {
      const dashboardData = {
        stats: {
          todayRevenue: 12450,
          todayOrders: 47,
          todayCustomers: 38,
          avgOrderValue: 265
        },
        recentOrders: [],
        inventoryAlerts: [],
        deliveryStatus: {},
        tasks: {
          pending: 3,
          completed: 12,
          total: 15
        }
      };

      if (this.pool) {
        // 從資料庫獲取真實數據
        try {
          // 今日統計
          const revenueQuery = await this.pool.query(`
            SELECT COALESCE(SUM(total), 0) as today_revenue,
                   COUNT(*) as today_orders,
                   COUNT(DISTINCT contact_phone) as today_customers
            FROM orders
            WHERE DATE(created_at) = CURRENT_DATE
          `);

          if (revenueQuery.rows.length > 0) {
            const revenue = revenueQuery.rows[0];
            dashboardData.stats = {
              todayRevenue: parseFloat(revenue.today_revenue) || 0,
              todayOrders: parseInt(revenue.today_orders) || 0,
              todayCustomers: parseInt(revenue.today_customers) || 0,
              avgOrderValue: revenue.today_orders > 0 ?
                Math.round((parseFloat(revenue.today_revenue) || 0) / (parseInt(revenue.today_orders) || 1)) : 0
            };
          }

          // 最近訂單
          const recentOrdersQuery = await this.pool.query(`
            SELECT id, contact_name, total, status, created_at
            FROM orders
            ORDER BY created_at DESC
            LIMIT 5
          `);
          dashboardData.recentOrders = recentOrdersQuery.rows;

          // 庫存警示
          const inventoryAlertsQuery = await this.pool.query(`
            SELECT name as product, stock_quantity as current,
                   COALESCE(min_stock_alert, 10) as minimum,
                   CASE
                     WHEN stock_quantity <= COALESCE(min_stock_alert, 10) / 2 THEN 'critical'
                     WHEN stock_quantity <= COALESCE(min_stock_alert, 10) THEN 'warning'
                     ELSE 'normal'
                   END as status
            FROM products
            WHERE stock_quantity <= COALESCE(min_stock_alert, 10)
            ORDER BY stock_quantity ASC
            LIMIT 10
          `);
          dashboardData.inventoryAlerts = inventoryAlertsQuery.rows;

          // 待處理任務統計
          const pendingOrdersQuery = await this.pool.query(`
            SELECT COUNT(*) as pending_count
            FROM orders
            WHERE status IN ('pending', 'preparing')
          `);

          dashboardData.tasks = {
            pending: parseInt(pendingOrdersQuery.rows[0]?.pending_count) || 0,
            completed: dashboardData.stats.todayOrders,
            total: dashboardData.stats.todayOrders + (parseInt(pendingOrdersQuery.rows[0]?.pending_count) || 0)
          };

        } catch (dbError) {
          console.error('資料庫查詢錯誤:', dbError);
          // 使用預設數據
        }
      }

      this.sendSuccess(res, dashboardData);
    } catch (error) {
      this.handleError(error, res, '獲取儀表板資料');
    }
  };

  /**
   * 管理員訂單管理頁面
   * GET /admin/orders
   */
  ordersPage = async (req, res) => {
    try {
      this.checkDatabaseConnection();

      // 查詢所有訂單
      const ordersQuery = await this.pool.query(`
        SELECT
          o.*,
          COALESCE(
            (SELECT COUNT(*) FROM order_items WHERE order_id = o.id),
            0
          ) as items_count
        FROM orders o
        ORDER BY o.created_at DESC
      `);

      const orders = ordersQuery.rows || [];

      res.render('admin_orders', {
        title: '訂單管理',
        orders: orders
      });
    } catch (error) {
      console.error('❌ 載入訂單管理頁面失敗:', error);
      this.handleError(error, res, '載入訂單管理頁面');
    }
  };

  /**
   * 管理員商品管理頁面
   * GET /admin/products
   */
  productsPage = async (req, res) => {
    // TODO: 從 server.js 遷移商品管理頁面邏輯
    try {
      res.render('admin_products', { title: '商品管理' });
    } catch (error) {
      this.handleError(error, res, '載入商品管理頁面');
    }
  };

  /**
   * 管理員庫存管理頁面
   * GET /admin/inventory
   */
  inventoryPage = async (req, res) => {
    try {
      this.checkDatabaseConnection();

      // 查詢所有商品庫存資料
      const inventoryQuery = await this.pool.query(`
        SELECT
          p.*,
          COALESCE(p.stock_quantity, 0) as stock_quantity,
          CASE
            WHEN p.stock_quantity <= 10 THEN 'low'
            WHEN p.stock_quantity <= 50 THEN 'medium'
            ELSE 'high'
          END as stock_level
        FROM products p
        ORDER BY p.name
      `);

      const inventoryData = inventoryQuery.rows || [];

      res.render('admin_inventory', {
        title: '庫存管理',
        inventoryData: inventoryData
      });
    } catch (error) {
      console.error('❌ 載入庫存管理頁面失敗:', error);
      this.handleError(error, res, '載入庫存管理頁面');
    }
  };

  /**
   * 管理員報表頁面
   * GET /admin/reports
   */
  reportsPage = async (req, res) => {
    // TODO: 從 server.js 遷移報表頁面邏輯
    try {
      res.render('admin_reports', { title: '報表統計' });
    } catch (error) {
      this.handleError(error, res, '載入報表頁面');
    }
  };

  /**
   * 管理員外送管理頁面
   * GET /admin/delivery
   */
  deliveryPage = async (req, res) => {
    // TODO: 從 server.js 遷移外送管理頁面邏輯
    try {
      res.render('admin_delivery_management', { title: '外送管理' });
    } catch (error) {
      this.handleError(error, res, '載入外送管理頁面');
    }
  };

  /**
   * 管理員基本設定頁面
   * GET /admin/basic-settings
   */
  basicSettingsPage = (req, res) => {
    try {
      res.render('admin_basic_settings', { title: '基本設定' });
    } catch (error) {
      this.handleError(error, res, '載入基本設定頁面');
    }
  };

  /**
   * 管理員營業時間設定頁面
   * GET /admin/business-hours
   */
  businessHoursPage = (req, res) => {
    try {
      res.render('admin_business_hours', { title: '營業時間設定' });
    } catch (error) {
      this.handleError(error, res, '載入營業時間設定頁面');
    }
  };

  /**
   * 管理員地圖監控頁面
   * GET /admin/map
   */
  mapPage = (req, res) => {
    try {
      res.render('admin_map', { title: '地圖監控' });
    } catch (error) {
      this.handleError(error, res, '載入地圖監控頁面');
    }
  };

  /**
   * 管理員WebSocket監控頁面
   * GET /admin/websocket-monitor
   */
  websocketMonitorPage = (req, res) => {
    try {
      res.render('admin_websocket_monitor', { title: 'WebSocket監控' });
    } catch (error) {
      this.handleError(error, res, '載入WebSocket監控頁面');
    }
  };

  /**
   * 管理員外送區域設定頁面
   * GET /admin/delivery-areas
   */
  deliveryAreasPage = (req, res) => {
    try {
      res.render('admin_delivery_areas', { title: '外送區域設定' });
    } catch (error) {
      this.handleError(error, res, '載入外送區域設定頁面');
    }
  };

  /**
   * 管理員外送員效能頁面
   * GET /admin/driver-performance
   */
  driverPerformancePage = async (req, res) => {
    // TODO: 從 server.js 遷移外送員效能頁面邏輯
    try {
      res.render('admin_driver_performance', { title: '外送員效能' });
    } catch (error) {
      this.handleError(error, res, '載入外送員效能頁面');
    }
  };

  /**
   * 管理員訂單管理頁面
   * GET /admin/order-management
   */
  orderManagementPage = (req, res) => {
    try {
      res.render('admin_order_management', { title: '訂單管理' });
    } catch (error) {
      this.handleError(error, res, '載入訂單管理頁面');
    }
  };
}

module.exports = AdminController;