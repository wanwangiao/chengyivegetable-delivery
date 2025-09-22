/**
 * 系統控制器
 * 處理系統級別的功能，如版本檢查、健康檢查、系統監控等
 */

const BaseController = require('./BaseController');

class SystemController extends BaseController {
  constructor() {
    super();
  }

  /**
   * 獲取系統版本資訊
   * GET /api/version
   */
  getVersion = (req, res) => {
    try {
      const versionInfo = {
        version: process.env.DEPLOY_VERSION || 'v2025.09.22.refactored',
        commit: process.env.DEPLOY_COMMIT || 'refactor-init',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'production',
        uptime: process.uptime()
      };

      this.sendSuccess(res, versionInfo, '版本資訊獲取成功');
    } catch (error) {
      this.handleError(error, res, '獲取版本資訊');
    }
  };

  /**
   * 系統健康檢查
   * GET /api/health
   */
  healthCheck = async (req, res) => {
    try {
      this.checkDatabaseConnection();

      const healthStatus = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        database: 'connected'
      };

      // 測試資料庫連線
      try {
        await this.pool.query('SELECT 1');
        healthStatus.database = 'healthy';
      } catch (dbError) {
        console.warn('⚠️ 資料庫健康檢查失敗:', dbError.message);
        healthStatus.database = 'unhealthy';
        healthStatus.status = 'degraded';
      }

      // 檢查關鍵服務狀態
      if (this.services.lineNotificationService) {
        healthStatus.lineService = 'available';
      }

      if (this.services.basicSettingsService) {
        healthStatus.settingsService = 'available';
      }

      res.json(healthStatus);
    } catch (error) {
      this.handleError(error, res, '健康檢查');
    }
  };

  /**
   * 獲取系統資訊
   * GET /api/system/info
   */
  getSystemInfo = async (req, res) => {
    try {
      this.checkDatabaseConnection();

      const systemInfo = {
        server: {
          nodeVersion: process.version,
          platform: process.platform,
          arch: process.arch,
          uptime: process.uptime(),
          memory: process.memoryUsage()
        },
        database: {
          status: 'connected',
          poolSize: this.pool.totalCount || 0,
          idleCount: this.pool.idleCount || 0,
          waitingCount: this.pool.waitingCount || 0
        },
        application: {
          version: process.env.DEPLOY_VERSION || 'unknown',
          environment: process.env.NODE_ENV || 'production',
          demoMode: process.env.DEMO_MODE === 'true'
        }
      };

      // 測試資料庫並獲取統計資訊
      try {
        const dbStats = await this.pool.query(`
          SELECT
            (SELECT COUNT(*) FROM orders) as total_orders,
            (SELECT COUNT(*) FROM products WHERE available = true) as available_products,
            (SELECT COUNT(*) FROM line_users) as line_users_count
        `);

        if (dbStats.rows.length > 0) {
          systemInfo.statistics = dbStats.rows[0];
        }
      } catch (dbError) {
        console.warn('⚠️ 獲取資料庫統計失敗:', dbError.message);
        systemInfo.database.status = 'error';
        systemInfo.database.error = dbError.message;
      }

      this.sendSuccess(res, systemInfo, '系統資訊獲取成功');
    } catch (error) {
      this.handleError(error, res, '獲取系統資訊');
    }
  };

  /**
   * 獲取效能指標
   * GET /api/performance
   */
  getPerformanceMetrics = (req, res) => {
    try {
      const performance = {
        memory: process.memoryUsage(),
        uptime: process.uptime(),
        cpuUsage: process.cpuUsage(),
        timestamp: new Date().toISOString(),
        pid: process.pid
      };

      // 計算記憶體使用百分比
      const totalMemory = performance.memory.heapTotal;
      const usedMemory = performance.memory.heapUsed;
      performance.memoryUsagePercent = ((usedMemory / totalMemory) * 100).toFixed(2);

      this.sendSuccess(res, performance, '效能指標獲取成功');
    } catch (error) {
      this.handleError(error, res, '獲取效能指標');
    }
  };

  /**
   * 系統初始化檢查
   * POST /api/system/first-time-init
   */
  firstTimeInit = async (req, res) => {
    try {
      this.checkDatabaseConnection();

      const initStatus = {
        databaseConnected: false,
        tablesExist: false,
        adminConfigured: false,
        basicSettingsConfigured: false,
        productsInitialized: false
      };

      // 檢查資料庫連線
      try {
        await this.pool.query('SELECT 1');
        initStatus.databaseConnected = true;
      } catch (dbError) {
        return this.sendSuccess(res, initStatus, '資料庫連線失敗');
      }

      // 檢查關鍵表格是否存在
      try {
        const tableCheck = await this.pool.query(`
          SELECT table_name
          FROM information_schema.tables
          WHERE table_schema = 'public'
          AND table_name IN ('orders', 'products', 'basic_settings')
        `);

        initStatus.tablesExist = tableCheck.rows.length >= 3;
      } catch (error) {
        console.warn('⚠️ 檢查表格存在性失敗:', error.message);
      }

      // 檢查管理員配置
      initStatus.adminConfigured = !!process.env.ADMIN_PASSWORD;

      // 檢查基本設定
      if (this.services.basicSettingsService) {
        try {
          const settings = await this.services.basicSettingsService.getSettings();
          initStatus.basicSettingsConfigured = !!settings.store_name;
        } catch (error) {
          console.warn('⚠️ 檢查基本設定失敗:', error.message);
        }
      }

      // 檢查商品資料
      if (initStatus.tablesExist) {
        try {
          const productCount = await this.pool.query('SELECT COUNT(*) FROM products');
          initStatus.productsInitialized = parseInt(productCount.rows[0].count) > 0;
        } catch (error) {
          console.warn('⚠️ 檢查商品資料失敗:', error.message);
        }
      }

      this.sendSuccess(res, initStatus, '系統初始化狀態檢查完成');
    } catch (error) {
      this.handleError(error, res, '系統初始化檢查');
    }
  };

  /**
   * 測試頁面
   * GET /test
   */
  testPage = (req, res) => {
    try {
      const testData = {
        message: '測試頁面正常運作',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'production',
        demoMode: process.env.DEMO_MODE === 'true'
      };

      res.render('test', {
        title: '系統測試頁面',
        testData
      });
    } catch (error) {
      this.handleError(error, res, '載入測試頁面');
    }
  };

  /**
   * 處理 favicon 請求
   * GET /favicon.ico
   */
  favicon = (req, res) => {
    res.status(204).end();
  };
}

module.exports = SystemController;