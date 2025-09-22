/**
 * 基礎控制器類
 * 提供共用的控制器功能和錯誤處理
 */

class BaseController {
  constructor() {
    this.pool = null;
    this.services = {};
  }

  /**
   * 設置資料庫連線池
   * @param {Pool} pool - PostgreSQL 連線池
   */
  setDatabasePool(pool) {
    this.pool = pool;
  }

  /**
   * 設置服務依賴
   * @param {Object} services - 服務物件集合
   */
  setServices(services) {
    this.services = { ...this.services, ...services };
  }

  /**
   * 統一的錯誤處理
   * @param {Error} error - 錯誤物件
   * @param {Response} res - Express 回應物件
   * @param {string} operation - 操作描述
   */
  handleError(error, res, operation = '操作') {
    console.error(`❌ ${operation}失敗:`, error);

    // 資料庫連線錯誤
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      return res.status(503).json({
        error: '資料庫連線失敗',
        message: '系統暫時無法使用，請稍後再試'
      });
    }

    // 資料驗證錯誤
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        error: '資料驗證失敗',
        message: error.message
      });
    }

    // 權限錯誤
    if (error.name === 'UnauthorizedError') {
      return res.status(401).json({
        error: '權限不足',
        message: '您沒有執行此操作的權限'
      });
    }

    // 一般錯誤
    res.status(500).json({
      error: `${operation}失敗`,
      message: process.env.NODE_ENV === 'development' ? error.message : '系統發生錯誤'
    });
  }

  /**
   * 統一的成功回應
   * @param {Response} res - Express 回應物件
   * @param {*} data - 回應資料
   * @param {string} message - 成功訊息
   */
  sendSuccess(res, data = null, message = '操作成功') {
    const response = { success: true, message };
    if (data !== null) {
      response.data = data;
    }
    res.json(response);
  }

  /**
   * 驗證必要參數
   * @param {Object} data - 要驗證的資料
   * @param {Array} requiredFields - 必要欄位列表
   * @throws {ValidationError} 當缺少必要欄位時
   */
  validateRequiredFields(data, requiredFields) {
    const missingFields = requiredFields.filter(field => !data[field]);
    if (missingFields.length > 0) {
      const error = new Error(`缺少必要欄位: ${missingFields.join(', ')}`);
      error.name = 'ValidationError';
      throw error;
    }
  }

  /**
   * 檢查資料庫連線
   * @throws {Error} 當資料庫未連線時
   */
  checkDatabaseConnection() {
    if (!this.pool) {
      throw new Error('資料庫連線未初始化');
    }
  }

  /**
   * 異步操作包裝器
   * @param {Function} asyncFunction - 異步函數
   * @returns {Function} Express 中間件
   */
  asyncWrapper(asyncFunction) {
    return (req, res, next) => {
      Promise.resolve(asyncFunction(req, res, next)).catch(next);
    };
  }

  /**
   * 分頁處理
   * @param {Object} query - 查詢參數
   * @returns {Object} 分頁資訊
   */
  getPaginationParams(query) {
    const page = Math.max(1, parseInt(query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 20));
    const offset = (page - 1) * limit;

    return { page, limit, offset };
  }

  /**
   * 建立分頁回應
   * @param {Array} data - 資料陣列
   * @param {number} total - 總記錄數
   * @param {Object} pagination - 分頁參數
   * @returns {Object} 分頁回應物件
   */
  createPaginatedResponse(data, total, pagination) {
    const { page, limit } = pagination;
    const totalPages = Math.ceil(total / limit);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    };
  }
}

module.exports = BaseController;