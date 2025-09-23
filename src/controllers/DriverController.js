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

        return res.redirect(returnTo || '/driver/dashboard');
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
      res.render('driver_dashboard_simplified', {
        title: '外送員儀表板',
        driverName: req.session.driverName || '外送員',
        driver: {
          name: req.session.driverName || '外送員',
          id: req.session.driverId
        },
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
          COUNT(CASE WHEN status IN ('assigned', 'picked_up', 'delivering') THEN 1 END) as active_orders,
          COALESCE(SUM(CASE WHEN status = 'delivered' AND DATE(completed_at) = CURRENT_DATE THEN total_amount END), 0) as today_earnings
        FROM orders
        WHERE driver_id = $1
      `;

      const result = await this.pool.query(statsQuery, [driverId]);
      this.sendSuccess(res, result.rows[0], '統計資料獲取成功');

    } catch (error) {
      this.handleError(error, res, '獲取統計資料');
    }
  };

  /**
   * 獲取已完成訂單
   * GET /api/driver/completed-orders
   */
  getCompletedOrders = async (req, res) => {
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
        AND o.status = 'delivered'
        AND DATE(o.completed_at) = CURRENT_DATE
        ORDER BY o.completed_at DESC
      `;

      const result = await this.pool.query(query, [driverId]);
      this.sendSuccess(res, result.rows, '已完成訂單獲取成功');

    } catch (error) {
      this.handleError(error, res, '獲取已完成訂單');
    }
  };

  /**
   * 獲取訂單詳情
   * GET /api/driver/order/:id
   */
  getOrderDetail = async (req, res) => {
    try {
      this.checkDatabaseConnection();

      const orderId = req.params.id;
      const driverId = req.session.driverId;

      if (!driverId) {
        return res.status(401).json({ error: '未登入' });
      }

      const query = `
        SELECT DISTINCT o.*, c.name as customer_name, c.phone as customer_phone
        FROM orders o
        LEFT JOIN customers c ON o.customer_id = c.id
        WHERE o.id = $1 AND o.driver_id = $2
      `;

      const result = await this.pool.query(query, [orderId, driverId]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: '訂單不存在或無權限' });
      }

      this.sendSuccess(res, result.rows[0], '訂單詳情獲取成功');

    } catch (error) {
      this.handleError(error, res, '獲取訂單詳情');
    }
  };

  /**
   * 取貨確認
   * POST /api/driver/pickup-order/:id
   */
  pickupOrder = async (req, res) => {
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
        AND status IN ('assigned')
      `;

      const checkResult = await this.pool.query(checkQuery, [orderId, driverId]);

      if (checkResult.rows.length === 0) {
        return res.status(400).json({ error: '訂單不存在或無權限' });
      }

      // 更新訂單狀態為已取貨
      const updateQuery = `
        UPDATE orders
        SET status = 'picked_up', updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `;

      const updateResult = await this.pool.query(updateQuery, [orderId]);

      console.log(`✅ 外送員 ${req.session.driverName} 完成取貨訂單 ${orderId}`);

      this.sendSuccess(res, updateResult.rows[0], '取貨確認成功');

    } catch (error) {
      this.handleError(error, res, '取貨確認');
    }
  };

  /**
   * 開始配送
   * POST /api/driver/start-delivery/:id
   */
  startDelivery = async (req, res) => {
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
        AND status IN ('picked_up')
      `;

      const checkResult = await this.pool.query(checkQuery, [orderId, driverId]);

      if (checkResult.rows.length === 0) {
        return res.status(400).json({ error: '訂單不存在或無權限' });
      }

      // 更新訂單狀態為配送中
      const updateQuery = `
        UPDATE orders
        SET status = 'delivering', updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `;

      const updateResult = await this.pool.query(updateQuery, [orderId]);

      console.log(`✅ 外送員 ${req.session.driverName} 開始配送訂單 ${orderId}`);

      this.sendSuccess(res, updateResult.rows[0], '開始配送成功');

    } catch (error) {
      this.handleError(error, res, '開始配送');
    }
  };

  /**
   * 完成配送
   * POST /api/driver/complete-delivery/:id
   */
  completeDelivery = async (req, res) => {
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
        AND status IN ('delivering')
      `;

      const checkResult = await this.pool.query(checkQuery, [orderId, driverId]);

      if (checkResult.rows.length === 0) {
        return res.status(400).json({ error: '訂單不存在或無權限' });
      }

      // 更新訂單狀態為已完成
      const updateQuery = `
        UPDATE orders
        SET status = 'delivered', delivered_at = NOW(), completed_at = NOW(), updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `;

      const updateResult = await this.pool.query(updateQuery, [orderId]);

      console.log(`✅ 外送員 ${req.session.driverName} 完成配送訂單 ${orderId}`);

      this.sendSuccess(res, updateResult.rows[0], '完成配送成功');

    } catch (error) {
      this.handleError(error, res, '完成配送');
    }
  };
  /**
   * 獲取今日統計
   * GET /api/driver/today-stats
   */
  getTodayStats = async (req, res) => {
    try {
      this.checkDatabaseConnection();

      const driverId = req.session.driverId;
      if (!driverId) {
        return res.status(401).json({ error: '未登入' });
      }

      // 獲取今日已完成訂單統計
      const completedQuery = `
        SELECT COUNT(*) as completed_count, COALESCE(SUM(total_amount), 0) as total_earnings
        FROM orders
        WHERE driver_id = $1
          AND status = 'delivered'
          AND DATE(updated_at) = CURRENT_DATE
      `;
      const completedResult = await this.pool.query(completedQuery, [driverId]);

      let completedCount = 0;
      let totalEarnings = 0;
      if (completedResult.rows.length > 0) {
        completedCount = parseInt(completedResult.rows[0].completed_count || 0);
        totalEarnings = parseFloat(completedResult.rows[0].total_earnings || 0);
      }

      // 獲取進行中的訂單數量
      const activeQuery = `
        SELECT COUNT(*) as active_count
        FROM orders
        WHERE driver_id = $1
          AND status IN ('assigned', 'picked_up', 'delivering')
      `;
      const activeResult = await this.pool.query(activeQuery, [driverId]);

      let activeCount = 0;
      if (activeResult.rows.length > 0) {
        activeCount = parseInt(activeResult.rows[0].active_count || 0);
      }

      const stats = {
        todayCompleted: completedCount,
        todayEarnings: totalEarnings,
        activeOrders: activeCount
      };

      this.sendSuccess(res, stats, '今日統計獲取成功');

    } catch (error) {
      this.handleError(error, res, '獲取今日統計');
    }
  };

  /**
   * 獲取當前任務
   * GET /api/driver/current-task
   */
  getCurrentTask = async (req, res) => {
    try {
      this.checkDatabaseConnection();

      const driverId = req.session.driverId;
      if (!driverId) {
        return res.status(401).json({ error: '未登入' });
      }

      const query = `
        SELECT o.*, oi.product_name, oi.quantity, oi.unit_price
        FROM orders o
        LEFT JOIN order_items oi ON o.id = oi.order_id
        WHERE o.driver_id = $1
          AND o.status IN ('assigned', 'picked_up', 'delivering')
        ORDER BY o.updated_at ASC
        LIMIT 1
      `;
      const result = await this.pool.query(query, [driverId]);

      if (result.rows.length > 0) {
        this.sendSuccess(res, result.rows[0], '當前任務獲取成功');
      } else {
        // 返回模擬數據
        const mockTask = {
          id: 999,
          contact_name: '測試客戶',
          contact_phone: '0912-345-678',
          address: '台北市信義區市府路1號',
          total_amount: 280,
          status: 'delivering',
          lat: 25.0415,
          lng: 121.5671
        };
        this.sendSuccess(res, mockTask, '當前任務獲取成功（模擬數據）');
      }

    } catch (error) {
      this.handleError(error, res, '獲取當前任務');
    }
  };

  /**
   * 獲取待配送訂單
   * GET /api/driver/pending-orders
   */
  getPendingOrders = async (req, res) => {
    try {
      this.checkDatabaseConnection();

      const driverId = req.session.driverId;
      if (!driverId) {
        return res.status(401).json({ error: '未登入' });
      }

      const query = `
        SELECT id, contact_name, contact_phone, address, total_amount, status, lat, lng
        FROM orders
        WHERE driver_id = $1
          AND status IN ('assigned', 'picked_up')
        ORDER BY created_at ASC
      `;
      const result = await this.pool.query(query, [driverId]);

      this.sendSuccess(res, result.rows, '待配送訂單獲取成功');

    } catch (error) {
      this.handleError(error, res, '獲取待配送訂單');
    }
  };

  /**
   * 獲取下一個訂單
   * GET /api/driver/next-order/:completedOrderId
   */
  getNextOrder = async (req, res) => {
    try {
      this.checkDatabaseConnection();

      const completedOrderId = req.params.completedOrderId;
      const driverId = req.session.driverId;

      if (!driverId) {
        return res.status(401).json({ error: '未登入' });
      }

      // 獲取該外送員的下一個待配送訂單
      const query = `
        SELECT id, contact_name, contact_phone, address, total_amount, lat, lng
        FROM orders
        WHERE driver_id = $1
          AND status IN ('picked_up', 'assigned')
          AND id != $2
        ORDER BY created_at ASC
        LIMIT 1
      `;
      const result = await this.pool.query(query, [driverId, completedOrderId]);

      if (result.rows.length > 0) {
        this.sendSuccess(res, result.rows[0], '下一個訂單獲取成功');
      } else {
        this.sendSuccess(res, null, '沒有更多訂單');
      }

    } catch (error) {
      this.handleError(error, res, '獲取下一個訂單');
    }
  };

  /**
   * 更新外送員位置
   * POST /api/driver/update-location
   */
  updateLocation = async (req, res) => {
    try {
      this.checkDatabaseConnection();

      const driverId = req.session.driverId;
      if (!driverId) {
        return res.status(401).json({ error: '未登入' });
      }

      const { lat, lng, accuracy } = req.body;

      // 驗證經緯度參數
      if (!lat || !lng || isNaN(parseFloat(lat)) || isNaN(parseFloat(lng))) {
        return res.status(400).json({ error: '無效的位置資訊' });
      }

      const latitude = parseFloat(lat);
      const longitude = parseFloat(lng);

      // 檢查經緯度範圍
      if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
        return res.status(400).json({ error: '經緯度超出有效範圍' });
      }

      try {
        // 嘗試創建或更新外送員位置記錄
        const upsertQuery = `
          INSERT INTO driver_locations (driver_id, lat, lng, accuracy, updated_at)
          VALUES ($1, $2, $3, $4, NOW())
          ON CONFLICT (driver_id)
          DO UPDATE SET
            lat = EXCLUDED.lat,
            lng = EXCLUDED.lng,
            accuracy = EXCLUDED.accuracy,
            updated_at = EXCLUDED.updated_at
          RETURNING *
        `;

        const result = await this.pool.query(upsertQuery, [
          driverId,
          latitude,
          longitude,
          accuracy || null
        ]);

        console.log(`📍 外送員 ${req.session.driverName} 位置更新: ${latitude}, ${longitude}`);

        this.sendSuccess(res, {
          lat: latitude,
          lng: longitude,
          accuracy: accuracy || null,
          updated_at: result.rows[0].updated_at
        }, '位置更新成功');

      } catch (dbError) {
        // 如果driver_locations表不存在，返回友好錯誤訊息
        if (dbError.message && dbError.message.includes('does not exist')) {
          console.warn('⚠️ driver_locations表不存在，GPS功能未完全配置');
          this.sendSuccess(res, {
            lat: latitude,
            lng: longitude,
            accuracy: accuracy || null,
            updated_at: new Date()
          }, '位置更新成功（模擬模式）');
        } else {
          throw dbError;
        }
      }

    } catch (error) {
      this.handleError(error, res, '更新位置');
    }
  };

  /**
   * 獲取外送員當前位置
   * GET /api/driver/location
   */
  getLocation = async (req, res) => {
    try {
      this.checkDatabaseConnection();

      const driverId = req.session.driverId;
      if (!driverId) {
        return res.status(401).json({ error: '未登入' });
      }

      try {
        const query = `
          SELECT lat, lng, accuracy, updated_at
          FROM driver_locations
          WHERE driver_id = $1
        `;

        const result = await this.pool.query(query, [driverId]);

        if (result.rows.length > 0) {
          this.sendSuccess(res, result.rows[0], '位置獲取成功');
        } else {
          this.sendSuccess(res, null, '尚未記錄位置資訊');
        }

      } catch (dbError) {
        // 如果表不存在，返回空資料
        if (dbError.message && dbError.message.includes('does not exist')) {
          this.sendSuccess(res, null, '位置服務未配置');
        } else {
          throw dbError;
        }
      }

    } catch (error) {
      this.handleError(error, res, '獲取位置');
    }
  };

  /**
   * 開始GPS追踪
   * POST /api/driver/start-tracking
   */
  startTracking = async (req, res) => {
    try {
      const driverId = req.session.driverId;
      if (!driverId) {
        return res.status(401).json({ error: '未登入' });
      }

      // 記錄開始追蹤的時間
      req.session.trackingStartTime = new Date();

      console.log(`🛰️ 外送員 ${req.session.driverName} 開始GPS追蹤`);

      this.sendSuccess(res, {
        tracking: true,
        startTime: req.session.trackingStartTime
      }, 'GPS追蹤已啟動');

    } catch (error) {
      this.handleError(error, res, '啟動GPS追蹤');
    }
  };

  /**
   * 停止GPS追踪
   * POST /api/driver/stop-tracking
   */
  stopTracking = async (req, res) => {
    try {
      const driverId = req.session.driverId;
      if (!driverId) {
        return res.status(401).json({ error: '未登入' });
      }

      // 清除追蹤時間
      delete req.session.trackingStartTime;

      console.log(`🛑 外送員 ${req.session.driverName} 停止GPS追蹤`);

      this.sendSuccess(res, {
        tracking: false,
        stopTime: new Date()
      }, 'GPS追蹤已停止');

    } catch (error) {
      this.handleError(error, res, '停止GPS追蹤');
    }
  };

  /**
   * 外送員API認證中間件
   * 用於保護需要認證的API端點
   */
  ensureDriverApi = (req, res, next) => {
    try {
      // Session健康檢查
      if (!req.session) {
        console.warn('⚠️ ensureDriverApi: Session不存在');
        return res.status(401).json({
          success: false,
          message: '請先登入',
          code: 'SESSION_NOT_FOUND'
        });
      }

      // 檢查外送員權限
      if (!req.session.driverId) {
        console.warn('⚠️ ensureDriverApi: 外送員未登入');
        return res.status(401).json({
          success: false,
          message: '請先登入外送員帳號',
          code: 'DRIVER_NOT_AUTHENTICATED'
        });
      }

      // 檢查Session有效性
      const now = new Date();
      const lastActivity = new Date(req.session.lastActivity || req.session.loginTime);
      const sessionAge = now - lastActivity;
      const maxSessionAge = 12 * 60 * 60 * 1000; // 12小時

      if (sessionAge > maxSessionAge) {
        console.warn(`⚠️ ensureDriverApi: Session已過期 (${Math.round(sessionAge/1000/60)}分鐘)`);
        this.cleanupSession(req);
        return res.status(401).json({
          success: false,
          message: 'Session已過期，請重新登入',
          code: 'SESSION_EXPIRED'
        });
      }

      // 檢查瀏覽器是否一致（防止Session劫持）
      const currentUA = req.get('User-Agent');
      const sessionUA = req.session.userAgent;
      if (sessionUA && currentUA !== sessionUA) {
        console.warn('⚠️ ensureDriverApi: 瀏覽器不一致，可能的安全風險');
        this.cleanupSession(req);
        return res.status(401).json({
          success: false,
          message: '安全檢查失敗，請重新登入',
          code: 'SECURITY_CHECK_FAILED'
        });
      }

      // 更新最後活動時間
      req.session.lastActivity = now;

      // 添加外送員資訊到req物件
      req.driver = {
        id: req.session.driverId,
        name: req.session.driverName,
        loginTime: req.session.loginTime,
        lastActivity: now
      };

      return next();

    } catch (error) {
      console.error('❌ ensureDriverApi錯誤:', error);
      return res.status(500).json({
        success: false,
        message: '認證系統錯誤',
        code: 'AUTH_SYSTEM_ERROR'
      });
    }
  };

  /**
   * 外送員頁面認證中間件
   * 用於保護需要認證的頁面
   */
  ensureDriverPage = (req, res, next) => {
    try {
      // Session健康檢查
      if (!req.session || !req.session.driverId) {
        console.warn('⚠️ ensureDriverPage: Session不存在或未登入');
        req.session.returnTo = req.originalUrl; // 記住原始URL
        return res.redirect('/driver/login');
      }

      // 檢查Session有效性
      const now = new Date();
      const lastActivity = new Date(req.session.lastActivity || req.session.loginTime);
      const sessionAge = now - lastActivity;
      const maxSessionAge = 12 * 60 * 60 * 1000; // 12小時

      if (sessionAge > maxSessionAge) {
        console.warn(`⚠️ ensureDriverPage: Session已過期 (${Math.round(sessionAge/1000/60)}分鐘)`);
        this.cleanupSession(req);
        return res.redirect('/driver/login?error=session_expired');
      }

      // 檢查瀏覽器是否一致
      const currentUA = req.get('User-Agent');
      const sessionUA = req.session.userAgent;
      if (sessionUA && currentUA !== sessionUA) {
        console.warn('⚠️ ensureDriverPage: 瀏覽器不一致');
        this.cleanupSession(req);
        return res.redirect('/driver/login?error=security_check_failed');
      }

      // 更新最後活動時間
      req.session.lastActivity = now;

      // 添加外送員資訊到req物件
      req.driver = {
        id: req.session.driverId,
        name: req.session.driverName,
        loginTime: req.session.loginTime,
        lastActivity: now
      };

      return next();

    } catch (error) {
      console.error('❌ ensureDriverPage錯誤:', error);
      return res.redirect('/driver/login?error=system_error');
    }
  };

  /**
   * 清理Session
   * 用於登出或Session失效時
   */
  cleanupSession = (req) => {
    try {
      if (req.session) {
        // 保存重要資訊後銷毀Session
        const returnTo = req.session.returnTo;
        req.session.destroy((err) => {
          if (err) {
            console.error('Session銷毀錯誤:', err);
          }
        });
        // 如果需要，可以重新設置returnTo
        if (returnTo) {
          req.session = { returnTo };
        }
      }
    } catch (error) {
      console.error('❌ cleanupSession錯誤:', error);
    }
  };
}

module.exports = DriverController;