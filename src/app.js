/**
 * 誠憶鮮蔬線上系統 - 重構後的主應用程式
 * 模組化架構版本
 */

const express = require('express'),
      session = require('express-session'),
      bodyParser = require('body-parser'),
      { Pool } = require('pg'),
      path = require('path'),
      helmet = require('helmet'),
      compression = require('compression'),
      cors = require('cors'),
      dns = require('dns');

// 載入環境變數
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

// 載入控制器管理器
const { controllerManager } = require('./controllers');

// 載入中間件
const { apiLimiter, orderLimiter, loginLimiter } = require('./middleware/rateLimiter'),
      { validateOrderData, validateAdminPassword, sanitizeInput } = require('./middleware/validation'),
      { apiErrorHandler, pageErrorHandler, notFoundHandler, asyncWrapper } = require('./middleware/errorHandler'),
      performanceMonitor = require('./middleware/performanceMonitor');

// 載入服務
const LineNotificationService = require('./services/LineNotificationService'),
      LineBotService = require('./services/LineBotService'),
      LineUserService = require('./services/LineUserService'),
      PriceChangeNotificationService = require('./services/PriceChangeNotificationService'),
      BasicSettingsService = require('./services/BasicSettingsService'),
      UnitConverter = require('./utils/unitConverter');

// 系統配置
const DEPLOY_VERSION = 'v2025.09.22.refactored';
const DEPLOY_COMMIT = 'controllers-framework';

class VegetableDeliveryApp {
  constructor() {
    this.app = express();
    this.port = process.env.PORT || 3000;
    this.pool = null;
    this.services = {};
    this.demoMode = process.env.DEMO_MODE === 'true';

    console.log('🚀 初始化誠憶鮮蔬線上系統...');
  }

  /**
   * 環境變數驗證
   */
  validateEnvironmentVariables() {
    const requiredVars = [
      'DATABASE_URL',
      'ADMIN_PASSWORD',
      'SESSION_SECRET'
    ];

    const missingVars = requiredVars.filter(varName => !process.env[varName]);

    if (missingVars.length > 0) {
      console.error('❌ 缺少必要的環境變數:');
      missingVars.forEach(varName => {
        console.error(`   - ${varName}`);
      });
      console.error('請檢查 .env 檔案或環境變數設定');
      process.exit(1);
    }

    if (process.env.SESSION_SECRET.length < 32) {
      console.warn('⚠️  SESSION_SECRET 長度不足，建議至少32字元');
    }

    console.log('✅ 環境變數驗證通過');
  }

  /**
   * 建立資料庫連線池
   */
  async createDatabasePool() {
    console.log('🔧 開始嘗試資料庫連線...');

    const dbConfig = {
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    };

    this.pool = new Pool(dbConfig);

    // 測試連線
    try {
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();
      console.log('✅ 資料庫連線成功');
    } catch (error) {
      console.error('❌ 資料庫連線失敗:', error.message);
      throw error;
    }

    // 設置錯誤處理
    this.pool.on('error', (err, client) => {
      console.error('❌ 資料庫連線池發生錯誤:', err);
    });
  }

  /**
   * 初始化服務
   */
  initializeServices() {
    console.log('🔧 初始化服務...');

    this.services = {
      lineNotificationService: new LineNotificationService(this.pool),
      lineBotService: new LineBotService(this.pool),
      lineUserService: new LineUserService(this.pool),
      priceChangeNotificationService: new PriceChangeNotificationService(this.pool),
      basicSettingsService: new BasicSettingsService(this.pool),
      unitConverter: new UnitConverter()
    };

    console.log('✅ 所有服務已初始化');
  }

  /**
   * 配置Express中間件
   */
  configureMiddleware() {
    console.log('🔧 配置中間件...');

    // 信任代理設定
    this.app.set('trust proxy', true);

    // 設定 view engine
    this.app.set('view engine', 'ejs');
    this.app.set('views', path.join(__dirname, '..', 'views'));

    // 效能監控
    this.app.use('/api', performanceMonitor);

    // 安全性中間件
    this.app.use(helmet({
      contentSecurityPolicy: false, // 暫時停用CSP
      crossOriginEmbedderPolicy: false
    }));

    // 壓縮回應
    this.app.use(compression({
      filter: (req, res) => {
        if (req.headers['x-no-compression']) return false;
        return compression.filter(req, res);
      },
      level: 6,
      threshold: 1024
    }));

    // CORS設定
    this.app.use(cors({
      origin: process.env.NODE_ENV === 'production'
        ? ['https://your-domain.com']
        : true,
      credentials: true
    }));

    // 編碼設定
    this.app.use((req, res, next) => {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      next();
    });

    // 解析請求體
    this.app.use(bodyParser.json({
      limit: '50mb',
      verify: (req, res, buf) => {
        req.rawBody = buf.toString('utf8');
      }
    }));
    this.app.use(bodyParser.urlencoded({
      extended: true,
      limit: '50mb',
      parameterLimit: 50000
    }));

    // Session配置
    this.app.use(session({
      secret: process.env.SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      rolling: true,
      cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000, // 24小時
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
      },
      name: 'vegetable.delivery.session'
    }));

    // 靜態文件
    this.app.use(express.static(path.join(__dirname, '..', 'public'), {
      maxAge: '1d',
      etag: true,
      lastModified: true
    }));

    console.log('✅ 中間件配置完成');
  }

  /**
   * 設置控制器
   */
  setupControllers() {
    console.log('🔧 設置控制器...');

    // 設置資料庫連線池和服務依賴
    controllerManager.setDatabasePool(this.pool);
    controllerManager.setServices(this.services);

    console.log('✅ 控制器設置完成');
  }

  /**
   * 設置路由
   */
  setupRoutes() {
    console.log('🔧 設置路由...');

    const controllers = controllerManager.getAllControllers();

    // 系統路由
    this.app.get('/favicon.ico', controllers.system.favicon);
    this.app.get('/api/version', controllers.system.getVersion);
    this.app.get('/api/health', controllers.system.healthCheck);
    this.app.get('/api/system/info', controllers.system.getSystemInfo);
    this.app.get('/api/performance', controllers.system.getPerformanceMetrics);
    this.app.get('/test', controllers.system.testPage);
    this.app.post('/api/system/first-time-init', controllers.system.firstTimeInit);

    // 產品路由
    this.app.get('/api/products', controllers.product.getProducts);
    this.app.get('/api/supported-units', controllers.product.getSupportedUnits);
    this.app.post('/api/unit-convert', controllers.product.convertUnit);
    this.app.post('/api/batch-convert', controllers.product.batchConvertUnits);

    // 管理員產品路由
    this.app.get('/api/admin/products', controllers.product.getAdminProducts);
    this.app.post('/api/admin/products', controllers.product.createProduct);
    this.app.put('/api/admin/products/:id', controllers.product.updateProduct);
    this.app.delete('/api/admin/products/:id', controllers.product.deleteProduct);
    this.app.patch('/api/admin/products/:id/toggle-availability', controllers.product.toggleProductAvailability);

    // 客戶路由
    this.app.get('/', controllers.customer.homePage);
    this.app.get('/delivery-map', controllers.customer.deliveryMapPage);
    this.app.get('/websocket-test', controllers.customer.websocketTestPage);
    this.app.get('/debug-mobile', controllers.customer.debugMobilePage);
    this.app.get('/emergency-fix', controllers.customer.emergencyFixPage);
    this.app.get('/test-dashboard', controllers.customer.testDashboardPage);
    this.app.get('/test-frontend-loading', controllers.customer.testFrontendLoadingPage);
    this.app.get('/api/test', controllers.customer.testApi);

    // 管理員路由
    this.app.get('/admin', controllers.admin.adminHome);
    this.app.get('/admin/login', controllers.admin.loginPage);
    this.app.post('/admin/login', validateAdminPassword, controllers.admin.login);
    this.app.get('/admin/logout', controllers.admin.logout);
    this.app.get('/admin/dashboard', this.ensureAdmin, controllers.admin.dashboard);
    this.app.get('/admin/products', this.ensureAdmin, controllers.admin.productsPage);
    this.app.get('/admin/orders', this.ensureAdmin, controllers.admin.ordersPage);
    this.app.get('/admin/inventory', this.ensureAdmin, controllers.admin.inventoryPage);
    this.app.get('/admin/reports', this.ensureAdmin, controllers.admin.reportsPage);
    this.app.get('/admin/delivery', this.ensureAdmin, controllers.admin.deliveryPage);
    this.app.get('/admin/basic-settings', this.ensureAdmin, controllers.admin.basicSettingsPage);
    this.app.get('/admin/business-hours', this.ensureAdmin, controllers.admin.businessHoursPage);
    this.app.get('/admin/map', this.ensureAdmin, controllers.admin.mapPage);
    this.app.get('/admin/websocket-monitor', this.ensureAdmin, controllers.admin.websocketMonitorPage);
    this.app.get('/admin/delivery-areas', this.ensureAdmin, controllers.admin.deliveryAreasPage);
    this.app.get('/admin/driver-performance', this.ensureAdmin, controllers.admin.driverPerformancePage);
    this.app.get('/admin/order-management', this.ensureAdmin, controllers.admin.orderManagementPage);

    // 外送員路由
    this.app.get('/driver/login', controllers.driver.loginPage);
    this.app.post('/driver/login', controllers.driver.login);
    this.app.get('/driver/logout', controllers.driver.logout);
    this.app.get('/driver', controllers.driver.driverHome);
    this.app.get('/driver/dashboard', this.ensureDriverPage, controllers.driver.dashboard);
    this.app.get('/driver/mobile', this.ensureDriverPage, controllers.driver.mobileDashboard);
    this.app.get('/driver/chat', this.ensureDriverPage, controllers.driver.chatPage);
    this.app.get('/driver/dashboard-gps', this.ensureDriverPage, controllers.driver.gpsPage);

    // LINE路由
    this.app.get('/auth/line/login', controllers.line.loginRedirect);
    this.app.get('/auth/line/callback', controllers.line.loginCallback);
    this.app.get('/line-connected', controllers.line.connectedPage);
    this.app.get('/line-bot-test', controllers.line.botTestPage);
    this.app.get('/liff-entry', controllers.line.liffEntryPage);
    this.app.get('/liff-debug', controllers.line.liffDebugPage);
    this.app.get('/liff', controllers.line.liffPage);
    this.app.get('/line-entry', controllers.line.lineEntryPage);
    this.app.get('/line/order-history', controllers.line.orderHistoryPage);

    // 訂單路由
    this.app.get('/checkout', controllers.order.checkoutPage);
    this.app.get('/order-success', controllers.order.orderSuccessPage);
    this.app.get('/order-tracking/:id', controllers.order.orderTrackingPage);
    this.app.get('/track-order/:id', controllers.order.trackOrderPage);

    // 載入現有的路由模組 (暫時保留)
    this.app.use('/api/driver', require('./routes/driver_simplified_api').router);
    this.app.use('/api/customer', require('./routes/customer_api'));
    this.app.use('/api/admin/reports', require('./routes/admin_reports_api'));
    this.app.use('/api/google-maps', require('./routes/google_maps_api').router);
    this.app.use('/api/google-maps-secure', require('./routes/google_maps_secure_api').router);
    this.app.use('/api/websocket', require('./routes/websocket_api').router);
    this.app.use('/api/db-setup', require('./routes/db_setup_api').router);

    console.log('✅ 路由設置完成');
  }

  /**
   * 管理員權限檢查中間件
   */
  ensureAdmin = (req, res, next) => {
    if (req.session && req.session.isAdmin) {
      next();
    } else {
      res.redirect('/admin/login');
    }
  };

  /**
   * 外送員頁面權限檢查中間件
   */
  ensureDriverPage = (req, res, next) => {
    if (req.session && req.session.isDriver) {
      next();
    } else {
      res.redirect('/driver/login');
    }
  };

  /**
   * 錯誤處理設置
   */
  setupErrorHandling() {
    // 404 處理
    this.app.use(notFoundHandler);

    // 錯誤處理
    this.app.use(apiErrorHandler);
    this.app.use(pageErrorHandler);
  }

  /**
   * 啟動應用程式
   */
  async start() {
    try {
      // 驗證環境變數
      this.validateEnvironmentVariables();

      // 建立資料庫連線
      await this.createDatabasePool();

      // 初始化服務
      this.initializeServices();

      // 配置中間件
      this.configureMiddleware();

      // 設置控制器
      this.setupControllers();

      // 設置路由
      this.setupRoutes();

      // 設置錯誤處理
      this.setupErrorHandling();

      // 啟動伺服器
      this.app.listen(this.port, () => {
        console.log(`
🌟 誠憶鮮蔬線上系統已啟動
📍 連接埠: ${this.port}
📦 版本: ${DEPLOY_VERSION}
🔧 模式: ${this.demoMode ? '示範模式' : '生產模式'}
🎯 架構: 模組化重構版本
        `);
      });

    } catch (error) {
      console.error('❌ 應用程式啟動失敗:', error);
      process.exit(1);
    }
  }
}

// 如果直接執行此文件，則啟動應用程式
if (require.main === module) {
  const app = new VegetableDeliveryApp();
  app.start().catch(console.error);
}

module.exports = VegetableDeliveryApp;