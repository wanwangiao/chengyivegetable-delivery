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
      this.checkDatabaseConnection();

      const {
        customer_name,
        customer_phone,
        delivery_address,
        items,
        total_amount,
        payment_method,
        notes
      } = req.body;

      this.validateRequiredFields(req.body, [
        'customer_name',
        'customer_phone',
        'delivery_address',
        'items',
        'total_amount'
      ]);

      // 開始交易
      const client = await this.pool.connect();

      try {
        await client.query('BEGIN');

        // 建立訂單
        const orderQuery = `
          INSERT INTO orders (
            customer_name, customer_phone, delivery_address,
            total_amount, payment_method, notes, status, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, 'pending', NOW())
          RETURNING id
        `;

        const orderResult = await client.query(orderQuery, [
          customer_name,
          customer_phone,
          delivery_address,
          total_amount,
          payment_method || 'cash',
          notes || ''
        ]);

        const orderId = orderResult.rows[0].id;

        // 建立訂單項目
        for (const item of items) {
          const itemQuery = `
            INSERT INTO order_items (
              order_id, product_id, product_name, quantity,
              unit_price, total_price
            ) VALUES ($1, $2, $3, $4, $5, $6)
          `;

          await client.query(itemQuery, [
            orderId,
            item.product_id,
            item.product_name,
            item.quantity,
            item.unit_price,
            item.total_price
          ]);
        }

        await client.query('COMMIT');

        console.log(`✅ 新訂單建立成功: ${orderId}`);

        this.sendSuccess(res, {
          orderId: orderId,
          message: '訂單建立成功'
        });

      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }

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
}

module.exports = OrderController;