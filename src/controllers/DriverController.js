/**
 * 外送員控制器
 * 處理外送員相關的所有功能，包括登入、訂單管理、GPS追蹤等
 */

const BaseController = require('./BaseController');

class DriverController extends BaseController {
  constructor() {
    super();
  }

  /**
   * 外送員登入頁面
   * GET /driver/login
   */
  loginPage = (req, res) => {
    try {
      res.render('driver_login', {
        title: '外送員登入',
        error: req.query.error || null
      });
    } catch (error) {
      this.handleError(error, res, '載入外送員登入頁面');
    }
  };

  /**
   * 外送員登入處理
   * POST /driver/login
   */
  login = async (req, res) => {
    try {
      const { phone, password } = req.body;

      // 輸入驗證
      if (!phone || !password || phone.trim().length === 0 || password.trim().length === 0) {
        console.log('❌ 外送員登入失敗: 手機或密碼為空');
        return res.render('driver_login', { error: '請輸入手機號碼和密碼' });
      }

      const trimmedPhone = phone.trim();
      const trimmedPassword = password.trim();

      console.log('🚛 外送員登入嘗試:', trimmedPhone);

      // 驗證外送員帳號 - 使用環境變數或資料庫驗證
      const driverPhone = process.env.DEMO_DRIVER_PHONE || '0912345678';
      const driverPassword = process.env.DEMO_DRIVER_PASSWORD || 'driver123';

      if (trimmedPhone === driverPhone && trimmedPassword === driverPassword) {
        // 成功登入
        const now = new Date();
        req.session.driverId = 1;
        req.session.driverName = '李大明';
        req.session.loginTime = now;
        req.session.lastActivity = now;
        req.session.userAgent = req.get('User-Agent'); // 記錄瀏覽器資訊

        console.log('✅ 外送員登入成功:', req.session.driverName);

        // 檢查是否有重導向URL
        const returnTo = req.session.returnTo;
        delete req.session.returnTo;

        return res.redirect(returnTo || '/driver');
      }

      // 登入失敗
      console.log('❌ 外送員登入失敗: 帳號或密碼錯誤');
      res.render('driver_login', { error: '手機號碼或密碼錯誤' });

    } catch (error) {
      console.error('❌ 外送員登入系統錯誤:', error);
      res.render('driver_login', { error: '系統錯誤，請稍後再試' });
    }
  };

  /**
   * 外送員儀表板
   * GET /driver/dashboard
   */
  dashboard = (req, res) => {
    try {
      res.render('driver_dashboard', {
        title: '外送員儀表板',
        driverName: req.session.driverName || '外送員',
        loginTime: req.session.loginTime || new Date()
      });
    } catch (error) {
      this.handleError(error, res, '載入外送員儀表板');
    }
  };

  /**
   * 外送員行動版儀表板
   * GET /driver/mobile
   */
  mobileDashboard = (req, res) => {
    try {
      res.render('driver_mobile', {
        title: '外送員行動版',
        driverName: req.session.driverName || '外送員'
      });
    } catch (error) {
      this.handleError(error, res, '載入外送員行動版儀表板');
    }
  };

  /**
   * 外送員首頁重導向
   * GET /driver
   */
  driverHome = (req, res) => {
    try {
      res.redirect('/driver/dashboard');
    } catch (error) {
      this.handleError(error, res, '外送員首頁重導向');
    }
  };

  /**
   * 外送員聊天頁面
   * GET /driver/chat
   */
  chatPage = (req, res) => {
    try {
      res.render('driver_chat', {
        title: '外送員聊天',
        driverName: req.session.driverName || '外送員'
      });
    } catch (error) {
      this.handleError(error, res, '載入外送員聊天頁面');
    }
  };

  /**
   * 外送員GPS頁面
   * GET /driver/dashboard-gps
   */
  gpsPage = (req, res) => {
    try {
      res.render('driver_gps', {
        title: '外送員GPS追蹤',
        driverName: req.session.driverName || '外送員'
      });
    } catch (error) {
      this.handleError(error, res, '載入外送員GPS頁面');
    }
  };

  /**
   * 外送員登出
   * GET /driver/logout
   */
  logout = (req, res) => {
    try {
      const driverName = req.session.driverName;
      req.session.destroy((err) => {
        if (err) {
          console.error('外送員登出時發生錯誤:', err);
        }
        console.log('✅ 外送員登出成功:', driverName);
        res.redirect('/driver/login');
      });
    } catch (error) {
      this.handleError(error, res, '外送員登出');
    }
  };

  /**
   * 獲取可用訂單
   * GET /api/driver/available-orders
   */
  getAvailableOrders = async (req, res) => {
    try {
      this.checkDatabaseConnection();

      const query = `
        SELECT DISTINCT o.*, c.name as customer_name, c.phone as customer_phone
        FROM orders o
        LEFT JOIN customers c ON o.customer_id = c.id
        WHERE o.status IN ('pending', 'confirmed')
        AND (o.driver_id IS NULL OR o.driver_id = 0)
        ORDER BY o.created_at ASC
        LIMIT 50
      `;

      const result = await this.pool.query(query);
      this.sendSuccess(res, result.rows, '可用訂單獲取成功');

    } catch (error) {
      this.handleError(error, res, '獲取可用訂單');
    }
  };

  /**
   * 獲取我的訂單
   * GET /api/driver/my-orders
   */
  getMyOrders = async (req, res) => {
    try {
      this.checkDatabaseConnection();

      const driverId = req.session.driverId;
      if (!driverId) {
        return res.status(401).json({ error: '未登入' });
      }

      const query = `
        SELECT DISTINCT o.*, c.name as customer_name, c.phone as customer_phone
        FROM orders o
        LEFT JOIN customers c ON o.customer_id = c.id
        WHERE o.driver_id = $1
        AND o.status NOT IN ('delivered', 'cancelled')
        ORDER BY o.created_at ASC
      `;

      const result = await this.pool.query(query, [driverId]);
      this.sendSuccess(res, result.rows, '我的訂單獲取成功');

    } catch (error) {
      this.handleError(error, res, '獲取我的訂單');
    }
  };

  /**
   * 接受訂單
   * POST /api/driver/take-order/:id
   */
  takeOrder = async (req, res) => {
    try {
      this.checkDatabaseConnection();

      const orderId = req.params.id;
      const driverId = req.session.driverId;

      if (!driverId) {
        return res.status(401).json({ error: '未登入' });
      }

      // 檢查訂單是否存在且可接受
      const checkQuery = `
        SELECT * FROM orders
        WHERE id = $1 AND status IN ('pending', 'confirmed')
        AND (driver_id IS NULL OR driver_id = 0)
      `;

      const checkResult = await this.pool.query(checkQuery, [orderId]);

      if (checkResult.rows.length === 0) {
        return res.status(400).json({ error: '訂單不存在或已被接受' });
      }

      // 更新訂單
      const updateQuery = `
        UPDATE orders
        SET driver_id = $1, status = 'assigned', updated_at = NOW()
        WHERE id = $2
        RETURNING *
      `;

      const updateResult = await this.pool.query(updateQuery, [driverId, orderId]);

      console.log(`✅ 外送員 ${req.session.driverName} 接受了訂單 ${orderId}`);

      this.sendSuccess(res, updateResult.rows[0], '訂單接受成功');

    } catch (error) {
      this.handleError(error, res, '接受訂單');
    }
  };

  /**
   * 完成訂單
   * POST /api/driver/complete-order/:id
   */
  completeOrder = async (req, res) => {
    try {
      this.checkDatabaseConnection();

      const orderId = req.params.id;
      const driverId = req.session.driverId;

      if (!driverId) {
        return res.status(401).json({ error: '未登入' });
      }

      // 檢查訂單是否屬於此外送員
      const checkQuery = `
        SELECT * FROM orders
        WHERE id = $1 AND driver_id = $2
        AND status IN ('assigned', 'picked_up', 'delivering')
      `;

      const checkResult = await this.pool.query(checkQuery, [orderId, driverId]);

      if (checkResult.rows.length === 0) {
        return res.status(400).json({ error: '訂單不存在或無權限' });
      }

      // 更新訂單為已完成
      const updateQuery = `
        UPDATE orders
        SET status = 'delivered', delivered_at = NOW(), updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `;

      const updateResult = await this.pool.query(updateQuery, [orderId]);

      console.log(`✅ 外送員 ${req.session.driverName} 完成了訂單 ${orderId}`);

      this.sendSuccess(res, updateResult.rows[0], '訂單完成成功');

    } catch (error) {
      this.handleError(error, res, '完成訂單');
    }
  };

  /**
   * 獲取外送員統計資料
   * GET /api/driver/stats
   */
  getDriverStats = async (req, res) => {
    try {
      this.checkDatabaseConnection();

      const driverId = req.session.driverId;
      if (!driverId) {
        return res.status(401).json({ error: '未登入' });
      }

      const statsQuery = `
        SELECT
          COUNT(*) as total_orders,
          COUNT(CASE WHEN status = 'delivered' THEN 1 END) as completed_orders,
          COUNT(CASE WHEN DATE(created_at) = CURRENT_DATE THEN 1 END) as today_orders,
          COUNT(CASE WHEN status IN ('assigned', 'picked_up', 'delivering') THEN 1 END) as active_orders
        FROM orders
        WHERE driver_id = $1
      `;

      const result = await this.pool.query(statsQuery, [driverId]);
      this.sendSuccess(res, result.rows[0], '統計資料獲取成功');

    } catch (error) {
      this.handleError(error, res, '獲取統計資料');
    }
  };
}

module.exports = DriverController;