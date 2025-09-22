/**
 * 產品控制器
 * 處理商品相關的所有功能，包括商品列表、庫存管理、價格管理等
 */

const BaseController = require('./BaseController');

class ProductController extends BaseController {
  constructor() {
    super();
  }

  /**
   * 獲取商品列表 (公開API)
   * GET /api/products
   */
  getProducts = async (req, res) => {
    try {
      this.checkDatabaseConnection();

      const query = `
        SELECT
          id, name, price, unit, category, available,
          image_url, description, stock_quantity,
          size_options, price_history
        FROM products
        WHERE available = true
        ORDER BY category, name
      `;

      const result = await this.pool.query(query);

      // 處理商品資料，確保正確的資料格式
      const products = result.rows.map(product => ({
        ...product,
        price: parseFloat(product.price) || 0,
        stock_quantity: parseInt(product.stock_quantity) || 0,
        size_options: product.size_options || null,
        price_history: product.price_history || null
      }));

      this.sendSuccess(res, products, '商品列表獲取成功');
    } catch (error) {
      this.handleError(error, res, '獲取商品列表');
    }
  };

  /**
   * 獲取支援的單位列表
   * GET /api/supported-units
   */
  getSupportedUnits = (req, res) => {
    try {
      const supportedUnits = {
        weight: ['公斤', '公克', '台斤', '兩'],
        volume: ['公升', '毫升', 'cc'],
        quantity: ['個', '顆', '包', '袋', '盒', '束', '把']
      };

      this.sendSuccess(res, supportedUnits, '支援單位列表獲取成功');
    } catch (error) {
      this.handleError(error, res, '獲取支援單位列表');
    }
  };

  /**
   * 單位轉換
   * POST /api/unit-convert
   */
  convertUnit = (req, res) => {
    try {
      const { value, fromUnit, toUnit } = req.body;

      this.validateRequiredFields(req.body, ['value', 'fromUnit', 'toUnit']);

      if (!this.services.unitConverter) {
        throw new Error('單位轉換服務未初始化');
      }

      const result = this.services.unitConverter.convert(
        parseFloat(value),
        fromUnit,
        toUnit
      );

      this.sendSuccess(res, result, '單位轉換成功');
    } catch (error) {
      this.handleError(error, res, '單位轉換');
    }
  };

  /**
   * 批量單位轉換
   * POST /api/batch-convert
   */
  batchConvertUnits = (req, res) => {
    try {
      const { conversions } = req.body;

      this.validateRequiredFields(req.body, ['conversions']);

      if (!Array.isArray(conversions)) {
        throw new Error('轉換請求必須是陣列格式');
      }

      if (!this.services.unitConverter) {
        throw new Error('單位轉換服務未初始化');
      }

      const results = conversions.map((conversion, index) => {
        try {
          const { value, fromUnit, toUnit } = conversion;
          return {
            index,
            success: true,
            result: this.services.unitConverter.convert(
              parseFloat(value),
              fromUnit,
              toUnit
            )
          };
        } catch (error) {
          return {
            index,
            success: false,
            error: error.message
          };
        }
      });

      this.sendSuccess(res, results, '批量單位轉換完成');
    } catch (error) {
      this.handleError(error, res, '批量單位轉換');
    }
  };

  /**
   * 管理員商品列表
   * GET /api/admin/products
   */
  getAdminProducts = async (req, res) => {
    try {
      this.checkDatabaseConnection();

      const { page, limit, offset } = this.getPaginationParams(req.query);
      const { category, available, search } = req.query;

      let whereConditions = [];
      let queryParams = [];
      let paramCount = 0;

      // 類別篩選
      if (category) {
        paramCount++;
        whereConditions.push(`category = $${paramCount}`);
        queryParams.push(category);
      }

      // 可用性篩選
      if (available !== undefined) {
        paramCount++;
        whereConditions.push(`available = $${paramCount}`);
        queryParams.push(available === 'true');
      }

      // 搜尋篩選
      if (search) {
        paramCount++;
        whereConditions.push(`(name ILIKE $${paramCount} OR description ILIKE $${paramCount})`);
        queryParams.push(`%${search}%`);
      }

      const whereClause = whereConditions.length > 0
        ? `WHERE ${whereConditions.join(' AND ')}`
        : '';

      // 獲取總數
      const countQuery = `SELECT COUNT(*) FROM products ${whereClause}`;
      const countResult = await this.pool.query(countQuery, queryParams);
      const total = parseInt(countResult.rows[0].count);

      // 獲取分頁資料
      const dataQuery = `
        SELECT
          id, name, price, unit, category, available,
          image_url, description, stock_quantity,
          size_options, price_history, created_at, updated_at
        FROM products
        ${whereClause}
        ORDER BY category, name
        LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
      `;

      queryParams.push(limit, offset);
      const result = await this.pool.query(dataQuery, queryParams);

      const products = result.rows.map(product => ({
        ...product,
        price: parseFloat(product.price) || 0,
        stock_quantity: parseInt(product.stock_quantity) || 0
      }));

      const paginatedResponse = this.createPaginatedResponse(
        products,
        total,
        { page, limit }
      );

      this.sendSuccess(res, paginatedResponse, '管理員商品列表獲取成功');
    } catch (error) {
      this.handleError(error, res, '獲取管理員商品列表');
    }
  };

  /**
   * 新增商品
   * POST /api/admin/products
   */
  createProduct = async (req, res) => {
    try {
      this.checkDatabaseConnection();

      const {
        name, price, unit, category, description,
        image_url, stock_quantity, size_options
      } = req.body;

      this.validateRequiredFields(req.body, ['name', 'price', 'unit', 'category']);

      const query = `
        INSERT INTO products
        (name, price, unit, category, description, image_url, stock_quantity, size_options, available)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
        RETURNING *
      `;

      const values = [
        name,
        parseFloat(price),
        unit,
        category,
        description || null,
        image_url || null,
        parseInt(stock_quantity) || 0,
        size_options || null
      ];

      const result = await this.pool.query(query, values);
      const newProduct = result.rows[0];

      this.sendSuccess(res, newProduct, '商品新增成功');
    } catch (error) {
      this.handleError(error, res, '新增商品');
    }
  };

  /**
   * 更新商品
   * PUT /api/admin/products/:id
   */
  updateProduct = async (req, res) => {
    try {
      this.checkDatabaseConnection();

      const productId = parseInt(req.params.id);
      if (!productId) {
        throw new Error('無效的商品ID');
      }

      const {
        name, price, unit, category, description,
        image_url, stock_quantity, size_options, available
      } = req.body;

      // 建立動態更新查詢
      const updateFields = [];
      const values = [];
      let paramCount = 0;

      if (name !== undefined) {
        paramCount++;
        updateFields.push(`name = $${paramCount}`);
        values.push(name);
      }

      if (price !== undefined) {
        paramCount++;
        updateFields.push(`price = $${paramCount}`);
        values.push(parseFloat(price));
      }

      if (unit !== undefined) {
        paramCount++;
        updateFields.push(`unit = $${paramCount}`);
        values.push(unit);
      }

      if (category !== undefined) {
        paramCount++;
        updateFields.push(`category = $${paramCount}`);
        values.push(category);
      }

      if (description !== undefined) {
        paramCount++;
        updateFields.push(`description = $${paramCount}`);
        values.push(description);
      }

      if (image_url !== undefined) {
        paramCount++;
        updateFields.push(`image_url = $${paramCount}`);
        values.push(image_url);
      }

      if (stock_quantity !== undefined) {
        paramCount++;
        updateFields.push(`stock_quantity = $${paramCount}`);
        values.push(parseInt(stock_quantity));
      }

      if (size_options !== undefined) {
        paramCount++;
        updateFields.push(`size_options = $${paramCount}`);
        values.push(size_options);
      }

      if (available !== undefined) {
        paramCount++;
        updateFields.push(`available = $${paramCount}`);
        values.push(available);
      }

      if (updateFields.length === 0) {
        throw new Error('沒有提供要更新的欄位');
      }

      // 加入 updated_at 欄位
      paramCount++;
      updateFields.push(`updated_at = $${paramCount}`);
      values.push(new Date());

      // 加入 WHERE 條件的 ID
      paramCount++;
      values.push(productId);

      const query = `
        UPDATE products
        SET ${updateFields.join(', ')}
        WHERE id = $${paramCount}
        RETURNING *
      `;

      const result = await this.pool.query(query, values);

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: '商品不存在',
          message: '找不到指定的商品'
        });
      }

      const updatedProduct = result.rows[0];
      this.sendSuccess(res, updatedProduct, '商品更新成功');
    } catch (error) {
      this.handleError(error, res, '更新商品');
    }
  };

  /**
   * 刪除商品
   * DELETE /api/admin/products/:id
   */
  deleteProduct = async (req, res) => {
    try {
      this.checkDatabaseConnection();

      const productId = parseInt(req.params.id);
      if (!productId) {
        throw new Error('無效的商品ID');
      }

      // 檢查商品是否存在於未完成的訂單中
      const orderCheck = await this.pool.query(`
        SELECT COUNT(*) FROM order_items oi
        JOIN orders o ON oi.order_id = o.id
        WHERE oi.product_id = $1
        AND o.status NOT IN ('completed', 'cancelled')
      `, [productId]);

      if (parseInt(orderCheck.rows[0].count) > 0) {
        return res.status(400).json({
          error: '無法刪除商品',
          message: '此商品仍有未完成的訂單，無法刪除'
        });
      }

      const deleteQuery = 'DELETE FROM products WHERE id = $1 RETURNING *';
      const result = await this.pool.query(deleteQuery, [productId]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: '商品不存在',
          message: '找不到指定的商品'
        });
      }

      this.sendSuccess(res, null, '商品刪除成功');
    } catch (error) {
      this.handleError(error, res, '刪除商品');
    }
  };

  /**
   * 切換商品可用性
   * PATCH /api/admin/products/:id/toggle-availability
   */
  toggleProductAvailability = async (req, res) => {
    try {
      this.checkDatabaseConnection();

      const productId = parseInt(req.params.id);
      if (!productId) {
        throw new Error('無效的商品ID');
      }

      const query = `
        UPDATE products
        SET available = NOT available, updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `;

      const result = await this.pool.query(query, [productId]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: '商品不存在',
          message: '找不到指定的商品'
        });
      }

      const updatedProduct = result.rows[0];
      const status = updatedProduct.available ? '啟用' : '停用';

      this.sendSuccess(res, updatedProduct, `商品${status}成功`);
    } catch (error) {
      this.handleError(error, res, '切換商品可用性');
    }
  };
}

module.exports = ProductController;