/**
 * 訂單控制器
 * 處理訂單相關的所有功能，包括訂單建立、查詢、狀態更新等
 */

const BaseController = require('./BaseController');

class OrderController extends BaseController {
  constructor() {
    super();
  }

  /**
   * 結帳頁面
   * GET /checkout
   */
  checkoutPage = (req, res) => {
    try {
      res.render('checkout', {
        title: '結帳',
        cart: req.session.cart || []
      });
    } catch (error) {
      this.handleError(error, res, '載入結帳頁面');
    }
  };

  /**
   * 訂單成功頁面
   * GET /order-success
   */
  orderSuccessPage = (req, res) => {
    try {
      res.render('order_success', {
        title: '訂單成功',
        orderId: req.query.orderId || null
      });
    } catch (error) {
      this.handleError(error, res, '載入訂單成功頁面');
    }
  };

  /**
   * 訂單追蹤頁面
   * GET /order-tracking/:id
   */
  orderTrackingPage = (req, res) => {
    try {
      const orderId = req.params.id;
      res.render('order_tracking', {
        title: '訂單追蹤',
        orderId: orderId
      });
    } catch (error) {
      this.handleError(error, res, '載入訂單追蹤頁面');
    }
  };

  /**
   * 追蹤訂單頁面
   * GET /track-order/:id
   */
  trackOrderPage = (req, res) => {
    try {
      const orderId = req.params.id;
      res.render('track_order', {
        title: '追蹤訂單',
        orderId: orderId
      });
    } catch (error) {
      this.handleError(error, res, '載入追蹤訂單頁面');
    }
  };

  /**
   * 建立新訂單
   * POST /api/orders
   */
  createOrder = async (req, res) => {
    try {
      const { name, phone, address, notes, paymentMethod, items, lineUserId, lineDisplayName } = req.body;

      if (!name || !phone || !address || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ success: false, message: '參數不完整' });
      }

      // 檢查是否為示範模式 - 只有明確設為true才啟用
      const demoMode = process.env.DEMO_MODE === 'true';
      console.log('🔧 DEMO_MODE檢查:', process.env.DEMO_MODE, '→ demoMode:', demoMode);

      // 示範模式處理
      if (demoMode) {
        console.log('📋 示範模式：模擬訂單建立');
        const mockOrderId = Math.floor(Math.random() * 9000) + 1000;

        // 簡化示範商品資料
        const demoProducts = [
          { id: 1, name: "高麗菜", price: 40, is_priced_item: false },
          { id: 2, name: "白蘿蔔", price: 30, is_priced_item: false },
          { id: 3, name: "紅蘿蔔", price: 25, is_priced_item: false }
        ];

        // 計算模擬訂單金額
        let subtotal = 0;
        for (const it of items) {
          const { productId, quantity } = it;
          const product = demoProducts.find(p => p.id == productId);
          if (product && !product.is_priced_item) {
            subtotal += Number(product.price) * Number(quantity);
          }
        }

        const deliveryFee = subtotal >= 200 ? 0 : 50;
        const total = subtotal + deliveryFee;

        return res.json({
          success: true,
          orderId: mockOrderId,
          message: '✨ 示範模式：訂單已模擬建立！實際部署後將連接真實資料庫',
          data: {
            orderId: mockOrderId,
            total,
            estimatedDelivery: '2-3小時內（示範模式）'
          }
        });
      }

      // 正常資料庫模式
      this.checkDatabaseConnection();

      let subtotal = 0;
      const orderItems = [];
      for (const it of items) {
        const { productId, quantity, selectedUnit } = it;
        const { rows } = await this.pool.query('SELECT * FROM products WHERE id=$1', [productId]);
        if (rows.length === 0) {
          continue;
        }
        const p = rows[0];
        let lineTotal = 0;
        if (!p.is_priced_item) {
          lineTotal = Number(p.price) * Number(quantity);
          subtotal += lineTotal;
        }
        orderItems.push({
          product_id: p.id,
          name: p.name,
          is_priced_item: p.is_priced_item,
          quantity: Number(quantity),
          unit_price: p.price,
          line_total: lineTotal,
          actual_weight: null,
          selectedUnit: selectedUnit || p.unit_hint
        });
      }

      const deliveryFee = subtotal >= 200 ? 0 : 50;
      const total = subtotal + deliveryFee;

      console.log('Creating order with data:', { name, phone, address, notes, paymentMethod, subtotal, deliveryFee, total, lineUserId });

      // 插入訂單
      const insertOrder = await this.pool.query(
        'INSERT INTO orders (contact_name, contact_phone, address, notes, subtotal, delivery_fee, total, payment_method, status, line_user_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id',
        [name, phone, address, notes || '', subtotal, deliveryFee, total, paymentMethod || 'cash', 'placed', lineUserId || null]
      );
      const orderId = insertOrder.rows[0].id;

      // 處理LINE用戶綁定
      if (lineUserId && lineDisplayName) {
        try {
          const existingUser = await this.pool.query(`
            SELECT id FROM users WHERE line_user_id = $1
          `, [lineUserId]);

          if (existingUser.rows.length > 0) {
            await this.pool.query(`
              UPDATE users
              SET phone = $1, name = $2, line_display_name = $3
              WHERE line_user_id = $4
            `, [phone, name, lineDisplayName, lineUserId]);
            console.log(`📱 更新現有 LINE 用戶資料: ${lineDisplayName} (${lineUserId})`);
          } else {
            await this.pool.query(`
              INSERT INTO users (phone, name, line_user_id, line_display_name, created_at)
              VALUES ($1, $2, $3, $4, NOW())
            `, [phone, name, lineUserId, lineDisplayName]);
            console.log(`📱 創建新 LINE 用戶: ${lineDisplayName} (${lineUserId})`);
          }
        } catch (userError) {
          console.warn('⚠️ LINE 用戶資料處理失敗，但訂單已成功創建:', userError.message);
        }
      }

      // 插入訂單項目
      for (const item of orderItems) {
        await this.pool.query(
          'INSERT INTO order_items (order_id, product_id, name, is_priced_item, quantity, unit_price, line_total, actual_weight) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
          [orderId, item.product_id, item.name, item.is_priced_item, item.quantity, item.unit_price, item.line_total, item.actual_weight]
        );
      }

      console.log(`✅ 新訂單建立成功: ${orderId}`);

      this.sendSuccess(res, {
        orderId: orderId,
        total: total,
        message: '訂單建立成功'
      });

    } catch (error) {
      this.handleError(error, res, '建立訂單');
    }
  };

  /**
   * 查詢訂單狀態
   * GET /api/orders/:id/status
   */
  getOrderStatus = async (req, res) => {
    try {
      this.checkDatabaseConnection();

      const orderId = req.params.id;

      const query = `
        SELECT o.*, d.name as driver_name, d.phone as driver_phone
        FROM orders o
        LEFT JOIN drivers d ON o.driver_id = d.id
        WHERE o.id = $1
      `;

      const result = await this.pool.query(query, [orderId]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: '訂單不存在' });
      }

      this.sendSuccess(res, result.rows[0], '訂單狀態查詢成功');

    } catch (error) {
      this.handleError(error, res, '查詢訂單狀態');
    }
  };

  /**
   * 更新訂單狀態
   * PUT /api/orders/:orderId/status
   */
  updateOrderStatus = async (req, res) => {
    try {
      this.checkDatabaseConnection();

      const orderId = req.params.orderId;
      const { status, notes } = req.body;

      const validStatuses = ['pending', 'confirmed', 'assigned', 'picked_up', 'delivering', 'delivered', 'cancelled'];

      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: '無效的訂單狀態' });
      }

      const updateQuery = `
        UPDATE orders
        SET status = $1, notes = COALESCE($2, notes), updated_at = NOW()
        WHERE id = $3
        RETURNING *
      `;

      const result = await this.pool.query(updateQuery, [status, notes, orderId]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: '訂單不存在' });
      }

      console.log(`✅ 訂單 ${orderId} 狀態更新為: ${status}`);

      this.sendSuccess(res, result.rows[0], '訂單狀態更新成功');

    } catch (error) {
      this.handleError(error, res, '更新訂單狀態');
    }
  };

  /**
   * 取消訂單
   * POST /api/orders/:id/cancel
   */
  cancelOrder = async (req, res) => {
    try {
      this.checkDatabaseConnection();

      const orderId = req.params.id;
      const { reason } = req.body;

      const updateQuery = `
        UPDATE orders
        SET status = 'cancelled',
            cancel_reason = $1,
            cancelled_at = NOW(),
            updated_at = NOW()
        WHERE id = $2
        AND status IN ('pending', 'confirmed')
        RETURNING *
      `;

      const result = await this.pool.query(updateQuery, [reason || '客戶取消', orderId]);

      if (result.rows.length === 0) {
        return res.status(400).json({ error: '訂單無法取消或不存在' });
      }

      console.log(`✅ 訂單 ${orderId} 已取消`);

      this.sendSuccess(res, result.rows[0], '訂單取消成功');

    } catch (error) {
      this.handleError(error, res, '取消訂單');
    }
  };

  /**
   * 獲取訂單列表
   * GET /api/orders
   */
  getOrders = async (req, res) => {
    try {
      this.checkDatabaseConnection();

      const pagination = this.getPaginationParams(req.query);
      const { status, customer_phone, date_from, date_to } = req.query;

      let whereConditions = [];
      let queryParams = [];
      let paramIndex = 1;

      // 狀態篩選
      if (status) {
        whereConditions.push(`o.status = $${paramIndex}`);
        queryParams.push(status);
        paramIndex++;
      }

      // 客戶電話篩選
      if (customer_phone) {
        whereConditions.push(`o.customer_phone LIKE $${paramIndex}`);
        queryParams.push(`%${customer_phone}%`);
        paramIndex++;
      }

      // 日期範圍篩選
      if (date_from) {
        whereConditions.push(`DATE(o.created_at) >= $${paramIndex}`);
        queryParams.push(date_from);
        paramIndex++;
      }

      if (date_to) {
        whereConditions.push(`DATE(o.created_at) <= $${paramIndex}`);
        queryParams.push(date_to);
        paramIndex++;
      }

      const whereClause = whereConditions.length > 0 ?
        'WHERE ' + whereConditions.join(' AND ') : '';

      // 查詢總數
      const countQuery = `
        SELECT COUNT(*) as total
        FROM orders o
        ${whereClause}
      `;

      const countResult = await this.pool.query(countQuery, queryParams);
      const total = parseInt(countResult.rows[0].total);

      // 查詢資料
      const dataQuery = `
        SELECT o.*, d.name as driver_name
        FROM orders o
        LEFT JOIN drivers d ON o.driver_id = d.id
        ${whereClause}
        ORDER BY o.created_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;

      queryParams.push(pagination.limit, pagination.offset);

      const dataResult = await this.pool.query(dataQuery, queryParams);

      const response = this.createPaginatedResponse(dataResult.rows, total, pagination);

      this.sendSuccess(res, response, '訂單列表獲取成功');

    } catch (error) {
      this.handleError(error, res, '獲取訂單列表');
    }
  };

  /**
   * 根據電話號碼搜尋訂單
   * GET /api/orders/search/:phone
   */
  searchOrdersByPhone = async (req, res) => {
    try {
      this.checkDatabaseConnection();

      const phone = req.params.phone;

      const query = `
        SELECT o.*, d.name as driver_name, d.phone as driver_phone
        FROM orders o
        LEFT JOIN drivers d ON o.driver_id = d.id
        WHERE o.customer_phone = $1
        ORDER BY o.created_at DESC
      `;

      const result = await this.pool.query(query, [phone]);

      this.sendSuccess(res, result.rows, '訂單搜尋成功');

    } catch (error) {
      this.handleError(error, res, '搜尋訂單');
    }
  };

  /**
   * 獲取訂單詳情
   * GET /api/orders/:orderId/details/:phone
   */
  getOrderDetails = async (req, res) => {
    try {
      this.checkDatabaseConnection();

      const { orderId, phone } = req.params;

      const query = `
        SELECT
          o.*,
          oi.product_name,
          oi.quantity,
          oi.price,
          (oi.quantity * oi.price) as subtotal
        FROM orders o
        LEFT JOIN order_items oi ON o.id = oi.order_id
        WHERE o.id = $1 AND o.contact_phone = $2
        ORDER BY oi.id
      `;

      const result = await this.pool.query(query, [orderId, phone]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: '找不到訂單或訂單不屬於此手機號碼'
        });
      }

      // 整理訂單資料
      const orderData = {
        id: result.rows[0].id,
        contact_name: result.rows[0].contact_name,
        contact_phone: result.rows[0].contact_phone,
        address: result.rows[0].address,
        total: result.rows[0].total,
        payment_method: result.rows[0].payment_method,
        status: result.rows[0].status,
        notes: result.rows[0].notes,
        created_at: result.rows[0].created_at,
        items: result.rows.map(row => ({
          product_name: row.product_name,
          quantity: row.quantity,
          price: row.price,
          subtotal: row.subtotal
        })).filter(item => item.product_name) // 過濾掉空的項目
      };

      this.sendSuccess(res, orderData, '訂單詳情獲取成功');

    } catch (error) {
      this.handleError(error, res, '獲取訂單詳情');
    }
  };
}

module.exports = OrderController;