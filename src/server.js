const express = require('express'),
      session = require('express-session'),
      bodyParser = require('body-parser'),
      { Pool } = require('pg'),
      path = require('path'),
      helmet = require('helmet'),
      compression = require('compression'),
      cors = require('cors'),
      dns = require('dns');

// 載入環境變數，優先從同級目錄，後備到上級目錄
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

// Railway PostgreSQL 配置

const { apiLimiter, orderLimiter, loginLimiter } = require('./middleware/rateLimiter'),
      { validateOrderData, validateAdminPassword, sanitizeInput } = require('./middleware/validation'),
      { apiErrorHandler, pageErrorHandler, notFoundHandler, asyncWrapper } = require('./middleware/errorHandler'),
      performanceMonitor = require('./middleware/performanceMonitor'),
      { createAgentSystem } = require('./agents'),
      { router: driverSimplifiedApiRoutes, setDatabasePool: setDriverSimplifiedDatabasePool } = require('./routes/driver_simplified_api'),
      customerApiRoutes = require('./routes/customer_api'),
      adminReportsApiRoutes = require('./routes/admin_reports_api'),
      { router: googleMapsApiRoutes, setDatabasePool: setGoogleMapsDatabasePool } = require('./routes/google_maps_api'),
      { router: googleMapsSecureApiRoutes, setDatabasePool: setGoogleMapsSecureDatabasePool } = require('./routes/google_maps_secure_api'),
      { router: websocketApiRoutes, setWebSocketManager } = require('./routes/websocket_api'),
      dbSetupRoutes = require('./routes/db_setup'),
      { router: dbSetupApiRoutes, setDatabasePool: setDbSetupDatabasePool, setBasicSettingsService: setDbSetupBasicSettingsService } = require('./routes/db_setup_api'),
      // WebSocketManager = require('./services/WebSocketManager'), // 已移除
      // SmartRouteService = require('./services/SmartRouteService'), // 已簡化
      LineNotificationService = require('./services/LineNotificationService'),
      LineBotService = require('./services/LineBotService'),
      LineUserService = require('./services/LineUserService'),
      PriceChangeNotificationService = require('./services/PriceChangeNotificationService'),
      BasicSettingsService = require('./services/BasicSettingsService'),
      UnitConverter = require('./utils/unitConverter');

let agentSystem = null;
let smartRouteService = null;
let webSocketManager = null;
let lineNotificationService = null;
let lineBotService = null;
let lineUserService = null;
let priceChangeNotificationService = null;
let basicSettingsService = null;

// 系統模式設定
let demoMode = true; // 啟用示範模式 // 關閉示範模式，使用真實資料庫數據

// 版本資訊 - 用於測試部署
const DEPLOY_VERSION = 'v2025.09.18.optimized - 訂單流程優化與狀態統一版本';
const DEPLOY_COMMIT = '29089aa';

const app = express(),
      port = process.env.PORT || 3000;

// 信任代理設定（Vercel 需要）
app.set('trust proxy', true);

let pool;

async function createDatabasePool() {
  // 設置 Node.js 環境使用 UTF-8 編碼
  process.env.LC_ALL = 'zh_TW.UTF-8';
  process.env.LANG = 'zh_TW.UTF-8';
  
  console.log('🔧 開始嘗試資料庫連線...');
  console.log('🔍 環境變數檢查:');
  console.log('  DATABASE_URL:', process.env.DATABASE_URL ? '已設定' : '未設定');
  console.log('  NODE_ENV:', process.env.NODE_ENV);
  console.log('🔍 LINE 環境變數檢查:');
  console.log('  LINE_CHANNEL_ID:', process.env.LINE_CHANNEL_ID ? '已設定 (' + process.env.LINE_CHANNEL_ID + ')' : '未設定');
  console.log('  LINE_LIFF_ID:', process.env.LINE_LIFF_ID ? '已設定 (' + process.env.LINE_LIFF_ID + ')' : '未設定');
  console.log('  LINE_CHANNEL_SECRET:', process.env.LINE_CHANNEL_SECRET ? '已設定 (length: ' + process.env.LINE_CHANNEL_SECRET.length + ')' : '未設定');
  console.log('  LINE_CHANNEL_ACCESS_TOKEN:', process.env.LINE_CHANNEL_ACCESS_TOKEN ? '已設定 (length: ' + process.env.LINE_CHANNEL_ACCESS_TOKEN.length + ')' : '未設定');
  
  const errors = [];
  
  // 方法1: 優先使用環境變數（正確方式）
  if (process.env.DATABASE_URL) {
    console.log('方法1: 使用環境變數 DATABASE_URL...');
    try {
      pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 60000,
        idleTimeoutMillis: 30000,
        max: 5,
        family: 4,  // 強制使用IPv4，解決家庭網路不支援IPv6問題
        // 確保資料庫連線使用 UTF-8 編碼
        options: '--client_encoding=UTF8'
      });
      
      const testResult = await pool.query('SELECT NOW() as current_time');
      console.log('✅ 資料庫連線成功 (環境變數)', testResult.rows[0]);
      demoMode = true; // 啟用示範模式
      return pool;
      
    } catch (error1) {
      console.log('❌ 環境變數連線失敗:', error1.code, error1.message);
      errors.push({ method: '環境變數', error: error1.message });
    }
  } else {
    console.log('⚠️ DATABASE_URL 環境變數未設定');
    errors.push({ method: '環境變數', error: 'DATABASE_URL 未設定' });
  }
  
  // 方法2: 直接IP地址連線（專家建議）
  console.log('方法2: 使用直接IP地址連線...');
  try {
    const directIP = SUPABASE_IPv4_MAP['db.cywcuzgbuqmxjxwyrrsp.supabase.co'];
    console.log(`🔗 嘗試直接連線到 IP: ${directIP}`);
    
    pool = new Pool({
      host: directIP,
      port: 5432,
      database: 'postgres',
      user: 'postgres',
      password: 'Chengyivegetable2025!',
      ssl: { 
        rejectUnauthorized: false,
        // 因為使用IP而非域名，需要指定servername
        servername: 'db.cywcuzgbuqmxjxwyrrsp.supabase.co'
      },
      connectionTimeoutMillis: 30000,
      idleTimeoutMillis: 30000,
      max: 5,
      family: 4  // 強制IPv4
    });
    
    const testResult = await pool.query('SELECT NOW() as current_time');
    console.log('✅ 資料庫連線成功 (直接IP)', testResult.rows[0]);
    demoMode = true; // 啟用示範模式
    return pool;
    
  } catch (error2) {
    console.log('❌ 直接IP連線失敗:', error2.code, error2.message);
    errors.push({ method: '直接IP', error: error2.message });
  }
  
  // 方法3: 使用Supabase標準IPv4池
  console.log('方法3: 使用Supabase IPv4連線池...');
  try {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL?.replace('db.cywcuzgbuqmxjxwyrrsp.supabase.co', 'aws-0-us-east-1.pooler.supabase.com'),
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 30000,
      idleTimeoutMillis: 30000,
      max: 5,
      family: 4  // 強制IPv4
    });
    
    const testResult = await pool.query('SELECT NOW() as current_time');
    console.log('✅ 資料庫連線成功 (Supabase連線池)', testResult.rows[0]);
    demoMode = true; // 啟用示範模式
    return pool;
    
  } catch (error3) {
    console.log('❌ Supabase連線池失敗:', error3.code, error3.message);
    errors.push({ method: 'Supabase連線池', error: error3.message });
  }
  
  
  // 方法3: 使用解析的IP地址直接連線
  console.log('方法3: 使用IP地址直接連線...');
  try {
    // 手動解析為IPv4地址
    const { promisify } = require('util');

// 暫時註解即時通知系統服務導入，避免啟動錯誤
// const SSENotificationService = require('./services/SSENotificationService');
// const OrderNotificationService = require('./services/OrderNotificationService');
// const DriverLocationService = require('./services/DriverLocationService');
// const DeliveryEstimationService = require('./services/DeliveryEstimationService');
// const initializeRealtimeRoutes = require('./routes/realtime_api');

// 即時通知服務實例
let sseNotificationService = null;
let orderNotificationService = null;
let driverLocationService = null;
let deliveryEstimationService = null;
    const resolve4 = promisify(dns.resolve4);
    const ipAddresses = await resolve4('db.cywcuzgbuqmxjxwyrrsp.supabase.co');
    const ipAddress = ipAddresses[0]; // 使用第一個IPv4地址
    
    console.log(`🔍 解析到IPv4地址: ${ipAddress}`);
    
    pool = new Pool({
      host: ipAddress,
      port: 5432,
      database: 'postgres',
      user: 'postgres',
      password: 'Chengyivegetable2025!',
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 60000,
      idleTimeoutMillis: 30000,
      max: 5,
      // 確保使用IPv4
      family: 4
    });
    
    const testResult = await pool.query('SELECT NOW() as current_time');
    console.log('✅ 資料庫連線成功 (IP直連)', testResult.rows[0]);
    demoMode = true; // 啟用示範模式
    return pool;
    
  } catch (error3) {
    console.log('❌ IP直連失敗:', error3.code, error3.message);
    errors.push({ method: 'IP直連', error: error3.message });
  }
  
  // 記錄所有錯誤
  console.log('❌ 所有連線方法都失敗了');
  errors.forEach((err, index) => {
    console.log(`❌ 錯誤${index + 1} (${err.method}):`, err.error);
  });
  
  // 最後選擇 - 臨時啟動模式（允許服務先啟動，稍後重試資料庫）
  console.warn('⚠️ 所有資料庫連線方式都失敗');
  console.warn('🔄 啟動臨時模式 - 服務將正常啟動，但部分功能受限');
  console.warn('📋 請稍後檢查：');
  console.warn('1. Railway DATABASE_URL 環境變數設定');
  console.warn('2. 資料庫服務狀態');
  console.warn('3. 網路連線狀況');
  
  demoMode = true; // 啟用示範模式
  pool = null; // 設為 null，讓服務知道沒有資料庫連線
  
  console.log('🚀 臨時模式啟動 - 服務將嘗試在背景重新連接資料庫');
  
  // 不終止程式，讓服務繼續啟動
}

// 初始化資料庫連線並啟動服務
createDatabasePool().then(async () => {
  // 執行智能啟動遷移
  try {
    console.log('🧠 載入智能遷移模組...');
    const { smartAutoMigration } = require('../smart_auto_migration');
    
    console.log('🚀 執行智能遷移（不會阻止服務啟動）...');
    const migrationResult = await smartAutoMigration(pool);
    
    if (migrationResult.success) {
      console.log('✅ 智能遷移成功:', migrationResult.message);
    } else if (migrationResult.skipped) {
      console.log('⏭️ 遷移已跳過:', migrationResult.reason);
    } else {
      console.warn('⚠️ 遷移失敗但服務繼續:', migrationResult.message);
    }
  } catch (migrationError) {
    console.warn('⚠️ 遷移模組載入失敗，跳過遷移:', migrationError.message);
    // 絕不讓遷移問題阻止服務啟動
  }

  // 初始化 Agent 系統
  try {
    agentSystem = createAgentSystem(pool);
    await agentSystem.initialize();
    console.log('🤖 Agent 系統已啟動');
  } catch (error) {
    console.error('❌ Agent 系統啟動失敗:', error);
    // 即使 Agent 系統啟動失敗，伺服器仍可繼續運行
  }
  
  // 初始化 Google Maps API 服務
  try {
    setGoogleMapsDatabasePool(pool);
    setGoogleMapsSecureDatabasePool(pool);
    setDriverSimplifiedDatabasePool(pool, demoMode);
    setDbSetupDatabasePool(pool);
    console.log('🗺️ Google Maps API 服務已初始化');
    console.log('🔒 Google Maps 安全API 服務已初始化');
    console.log('🔧 資料庫設置 API 已初始化');

  // 暫時註解即時通知系統初始化
  // try {
    // 1. 創建SSE通知服務
    // sseNotificationService = new SSENotificationService();
    // console.log('📡 SSE通知服務已初始化');
    // 
    // // 2. 創建訂單通知服務
    // orderNotificationService = new OrderNotificationService(pool, sseNotificationService);
    // console.log('📋 訂單通知服務已初始化');
    // 
    // // 3. 創建外送員位置服務
    // driverLocationService = new DriverLocationService(pool, sseNotificationService);
    // console.log('🚚 外送員位置服務已初始化');
    // 
    // // 4. 創建配送時間預估服務
    // deliveryEstimationService = new DeliveryEstimationService(pool, null);
    // console.log('⏰ 配送時間預估服務已初始化');
    // 
    // // 5. 設置心跳包發送
    // setInterval(() => {
    //   if (sseNotificationService) {
    //     sseNotificationService.sendHeartbeat();
    //   }
    // }, 30000); // 每30秒發送心跳包
    // 
    // console.log('🎉 即時通知系統已完全初始化');
    
  // } catch (error) {
  //   console.error('❌ 即時通知系統初始化失敗:', error);
  // }
  } catch (error) {
    console.error('❌ Google Maps API 服務初始化失敗:', error);
  }
  
  // 初始化智能路線服務（已簡化）
  // try {
  //   smartRouteService = new SmartRouteService(pool);
  //   console.log('🧠 SmartRouteService 已初始化');
  // } catch (error) {
  //   console.error('❌ SmartRouteService 初始化失敗:', error);
  // }
  
}).catch(console.error);

// 設定 view engine 與靜態檔案
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));
// 設置 EJS 模板的 UTF-8 編碼
app.set('view options', { 
  rmWhitespace: true,
  charset: 'utf-8'
});
// 靜態資源快取策略 - 性能優化
app.use('/css', express.static(path.join(__dirname, '../public/css'), {
  maxAge: '7d', // CSS文件快取7天
  etag: true,
  lastModified: true,
  setHeaders: (res, path) => {
    res.setHeader('Cache-Control', 'public, max-age=604800'); // 7天
  }
}));

app.use('/js', express.static(path.join(__dirname, '../public/js'), {
  maxAge: '7d', // JS文件快取7天
  etag: true,
  lastModified: true,
  setHeaders: (res, path) => {
    res.setHeader('Cache-Control', 'public, max-age=604800'); // 7天
  }
}));

app.use('/images', express.static(path.join(__dirname, '../public/images'), {
  maxAge: '30d', // 圖片快取30天
  etag: true,
  lastModified: true,
  setHeaders: (res, path) => {
    res.setHeader('Cache-Control', 'public, max-age=2592000'); // 30天
  }
}));

// 其他靜態資源
app.use(express.static(path.join(__dirname, '../public'), {
  maxAge: '1d', // 其他文件快取1天
  etag: true,
  lastModified: true
}));

// 處理 favicon.ico 請求
app.get('/favicon.ico', (req, res) => {
  res.status(204).send(); // 返回 204 No Content
});

// 性能監控中間件
app.use(performanceMonitor.requestMonitor());

// 安全性中間件 - 暫時禁用 CSP 來修復 502 錯誤
app.use(helmet({
  contentSecurityPolicy: false // 暫時禁用 CSP
}));

// 壓縮回應 - 增強版本
app.use(compression({
  filter: (req, res) => {
    // 不壓縮已經壓縮過的響應
    if (req.headers['x-no-compression']) {
      return false;
    }
    // 使用compression預設的過濾器
    return compression.filter(req, res);
  },
  level: process.env.NODE_ENV === 'production' ? 6 : 1, // 生產環境使用更高壓縮率
  threshold: 1024, // 只有超過1KB的響應才壓縮
  windowBits: 15
}));

// CORS設定
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? [process.env.FRONTEND_URL] 
    : ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true
}));

// 強化中文編碼支援
app.use((req, res, next) => {
  // 設置響應頭
  res.setHeader('Accept-Charset', 'utf-8');
  next();
});

// 一般API限制
app.use('/api/', apiLimiter);

// 解析請求體 - 強化中文編碼處理
app.use(bodyParser.json({ 
  limit: '10mb',
  type: ['application/json', 'application/json; charset=utf-8']
}));

app.use(bodyParser.urlencoded({ 
  extended: false, 
  limit: '10mb'
}));

// 為API響應設置正確的編碼
app.use('/api/', (req, res, next) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  next();
});

// 為頁面響應設置正確的編碼
app.use((req, res, next) => {
  if (!res.getHeader('Content-Type')) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
  }
  next();
});

// Session配置 - 優化版本
app.use(session({
  secret: process.env.SESSION_SECRET || 'chengyi-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  rolling: true, // Rolling session - 每次請求重新設定過期時間
  cookie: {
    secure: false, // 暫時停用 secure 以解決 Vercel 相容性問題
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7天有效期
    sameSite: 'lax' // 使用 lax 以提升相容性
  },
  // Session存儲配置
  name: 'chengyi.sid', // 自定義session name，增強安全性
  // 錯誤處理
  genid: () => {
    const crypto = require('crypto');
    return crypto.randomBytes(16).toString('hex'); // 更安全的session ID生成
  }
}));

// Session健康檢查和錯誤處理中間件
app.use((req, res, next) => {
  // 檢查Session是否正常運作
  if (!req.session) {
    console.warn('⚠️ Session未初始化，重新創建...');
    req.session = {};
  }
  
  // Session活動追蹤（用於debug）
  if (req.session && (req.session.adminPassword || req.session.driverId)) {
    req.session.lastActivity = new Date();
    
    // Debug log (只在開發環境)
    if (process.env.NODE_ENV !== 'production') {
      console.log(`🔐 Session活動: ${req.session.adminPassword ? 'Admin' : 'Driver'} - ${req.path}`);
    }
  }
  
  next();
});

// 將 LINE 綁定狀態傳遞至所有模板
app.use((req, res, next) => {
  res.locals.sessionLine = req.session ? req.session.line : null;
  next();
});

// Session清理中間件（用於logout等操作）
function cleanupSession(req) {
  if (req.session) {
    req.session.destroy((err) => {
      if (err) {
        console.error('Session清理失敗:', err);
      } else {
        console.log('✅ Session已清理');
      }
    });
  }
}

// API響應快取系統 - 提升性能
const apiCache = new Map();
const CACHE_TTL = 30 * 1000; // 30秒快取

function createCacheKey(req) {
  return `${req.method}:${req.path}:${JSON.stringify(req.query)}:${req.session?.driverId || 'anonymous'}`;
}

function apiCacheMiddleware(ttl = CACHE_TTL) {
  return (req, res, next) => {
    // 只快取GET請求
    if (req.method !== 'GET') {
      return next();
    }

    const cacheKey = createCacheKey(req);
    const cached = apiCache.get(cacheKey);
    
    if (cached && (Date.now() - cached.timestamp) < ttl) {
      console.log(`🚀 API快取命中: ${req.path}`);
      res.setHeader('X-Cache', 'HIT');
      res.setHeader('X-Cache-TTL', Math.round((ttl - (Date.now() - cached.timestamp)) / 1000));
      return res.json(cached.data);
    }

    // 覆寫res.json來快取響應
    const originalJson = res.json;
    res.json = function(data) {
      // 只快取成功的響應
      if (res.statusCode === 200 && data) {
        apiCache.set(cacheKey, {
          data: data,
          timestamp: Date.now()
        });
        
        // 清理過期快取（每100次請求清理一次）
        if (Math.random() < 0.01) {
          cleanExpiredCache();
        }
      }
      
      res.setHeader('X-Cache', 'MISS');
      return originalJson.call(this, data);
    };

    next();
  };
}

function cleanExpiredCache() {
  const now = Date.now();
  let cleaned = 0;
  
  for (const [key, value] of apiCache.entries()) {
    if (now - value.timestamp > CACHE_TTL * 2) {
      apiCache.delete(key);
      cleaned++;
    }
  }
  
  if (cleaned > 0) {
    console.log(`🧹 清理了${cleaned}個過期快取項目`);
  }
}

// 手動清除特定API快取
function clearApiCache(pattern) {
  let cleared = 0;
  for (const key of apiCache.keys()) {
    if (key.includes(pattern)) {
      apiCache.delete(key);
      cleared++;
    }
  }
  console.log(`🔄 清除了${cleared}個相關快取: ${pattern}`);
}

// 設置全局變數供路由使用
app.use((req, res, next) => {
  req.app.locals.pool = pool;
  req.app.locals.db = pool; // 同時設置為 db 供遷移路由使用
  req.app.locals.demoMode = demoMode;
  next();
});

// 版本測試端點
app.get('/api/version', (req, res) => {
    res.json({
        version: DEPLOY_VERSION,
        commit: DEPLOY_COMMIT,
        timestamp: new Date().toISOString(),
        status: 'deployed'
    });
});

// 外送員API路由 (統一簡化版)
app.use('/api/driver', driverSimplifiedApiRoutes);

// 客戶端API路由
app.use('/api/customer', customerApiRoutes);

// 後台報表API路由
app.use('/api/admin/reports', adminReportsApiRoutes);

// 後台遷移API路由
const adminMigrationRoutes = require('./routes/admin_migration');
app.use('/admin/migration', adminMigrationRoutes);

// Google Maps API路由
app.use('/api/maps', googleMapsApiRoutes);

// Google Maps 安全API路由
app.use('/api/google-maps-secure', googleMapsSecureApiRoutes);

// WebSocket API路由
app.use('/api/websocket', websocketApiRoutes);

// 資料庫設置路由 (僅管理員)
app.use('/admin/db-setup', dbSetupRoutes);
app.use('/api/db-setup', dbSetupApiRoutes);

// 智能路線API端點
app.post('/api/smart-route/plan', ensureAdmin, async (req, res) => {
  try {
    const { orderIds, options = {} } = req.body;
    
    if (!Array.isArray(orderIds) || orderIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: '訂單ID列表必填且不能為空'
      });
    }

    if (!smartRouteService) {
      return res.status(503).json({
        success: false,
        message: '智能路線服務尚未初始化'
      });
    }

    const routePlan = await smartRouteService.planSmartRoute(orderIds, options);

    res.json({
      success: true,
      message: '智能路線規劃完成',
      data: routePlan
    });

  } catch (error) {
    console.error('智能路線規劃API錯誤:', error);
    res.status(500).json({
      success: false,
      message: '智能路線規劃失敗: ' + error.message
    });
  }
});

app.get('/api/smart-route/plans', ensureAdmin, async (req, res) => {
  try {
    if (!smartRouteService) {
      return res.status(503).json({
        success: false,
        message: '智能路線服務尚未初始化'
      });
    }

    const options = {
      status: req.query.status,
      limit: parseInt(req.query.limit) || 50,
      offset: parseInt(req.query.offset) || 0,
      startDate: req.query.startDate,
      endDate: req.query.endDate
    };

    const plans = await smartRouteService.getRoutePlans(options);

    res.json({
      success: true,
      data: plans,
      count: plans.length
    });

  } catch (error) {
    console.error('獲取路線計劃API錯誤:', error);
    res.status(500).json({
      success: false,
      message: '獲取路線計劃失敗: ' + error.message
    });
  }
});

app.get('/api/smart-route/plans/:planId', ensureAdmin, async (req, res) => {
  try {
    const { planId } = req.params;

    if (!smartRouteService) {
      return res.status(503).json({
        success: false,
        message: '智能路線服務尚未初始化'
      });
    }

    const planDetails = await smartRouteService.getRoutePlanDetails(planId);

    res.json({
      success: true,
      data: planDetails
    });

  } catch (error) {
    console.error('獲取路線計劃詳情API錯誤:', error);
    res.status(500).json({
      success: false,
      message: '獲取路線計劃詳情失敗: ' + error.message
    });
  }
});

// 地理編碼：將地址轉為座標
async function geocodeAddress(address) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return { lat: null, lng: null, status: 'no_api_key' };
  }
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (data.status === 'OK' && data.results && data.results[0]) {
      const loc = data.results[0].geometry.location;
      return { lat: loc.lat, lng: loc.lng, status: 'OK' };
    }
    return { lat: null, lng: null, status: data.status };
  } catch (e) {
    return { lat: null, lng: null, status: 'error' };
  }
}

// 儲存或更新使用者（依手機為主鍵）
async function upsertUser(phone, name, lineUserId, lineDisplayName) {
  if (demoMode) {
    console.log('📝 示範模式：模擬用戶資料儲存', { phone, name, lineUserId });
    return;
  }
  
  try {
    await pool.query(
      'INSERT INTO users (phone, name, line_user_id, line_display_name) VALUES ($1,$2,$3,$4) ON CONFLICT (phone) DO UPDATE SET line_user_id=EXCLUDED.line_user_id, line_display_name=EXCLUDED.line_display_name, name=EXCLUDED.name',
      [phone, name || null, lineUserId || null, lineDisplayName || null]
    );
  } catch (e) {
    console.error('Upsert user error:', e.message);
  }
}

// 示範產品資料（包含公克單位商品）
const demoProducts = [
  { id: 1, name: '🥬 有機高麗菜', price: 80, is_priced_item: false, unit_hint: '每顆', unit: '顆', is_available: true },
  { id: 2, name: '🍅 新鮮番茄', price: 45, is_priced_item: true, unit_hint: '每公斤', unit: '公斤', is_available: true },
  { id: 3, name: '🥬 青江菜', price: 40, is_priced_item: false, unit_hint: '每把', unit: '把', is_available: true },
  { id: 4, name: '🥕 胡蘿蔔', price: 30, is_priced_item: true, unit_hint: '每斤', unit: '斤', is_available: false },
  { id: 5, name: '🥒 小黃瓜', price: 60, is_priced_item: false, unit_hint: '每包', unit: '包', is_available: true },
  { id: 6, name: '🧅 洋蔥', price: 25, is_priced_item: true, unit_hint: '每台斤', unit: '台斤', is_available: true },
  // 新增公克單位商品
  { id: 7, name: '🌶️ 辣椒', price: 0.5, is_priced_item: true, unit_hint: '每公克', unit: '公克', is_available: true },
  { id: 8, name: '🧄 蒜頭', price: 0.3, is_priced_item: true, unit_hint: '每公克', unit: '公克', is_available: false },
  { id: 9, name: '🍄 香菇', price: 1.2, is_priced_item: true, unit_hint: '每公克', unit: '公克', is_available: true },
  { id: 10, name: '🫚 薑', price: 0.4, is_priced_item: true, unit_hint: '每公克', unit: '公克', is_available: true }
];

// 取得產品資料
async function fetchProducts() {
  // 如果是示範模式，直接返回示範資料
  if (demoMode) {
    console.log('📦 使用示範產品資料 (共', demoProducts.length, '項)');
    return demoProducts;
  }
  
  try {
    if (!pool) {
      await createDatabasePool();
    }
    
    // 如果初始化後仍是示範模式
    if (demoMode) {
      return demoProducts;
    }
    
    // 獲取商品基本資訊
    const { rows: products } = await pool.query('SELECT * FROM products ORDER BY id');
    
    // 為每個商品載入選項群組和選項
    for (const product of products) {
      let optionGroupsResult = { rows: [] };
      try {
        optionGroupsResult = await pool.query(`
          SELECT pog.*, 
                 po.id as option_id,
                 po.name as option_name,
                 po.description as option_description,
                 po.price_modifier,
                 po.is_default,
                 po.sort_order as option_sort_order
          FROM product_option_groups pog
          LEFT JOIN product_options po ON pog.id = po.group_id
          WHERE pog.product_id = $1
          ORDER BY pog.sort_order, po.sort_order
        `, [product.id]);
      } catch (error) {
        console.log('⚠️ product_option_groups 表不存在，跳過選項查詢 (修復版本)');
        optionGroupsResult = { rows: [] };
      }
      
      // 組織選項群組結構
      const optionGroupsMap = new Map();
      for (const row of optionGroupsResult.rows) {
        if (!optionGroupsMap.has(row.id)) {
          optionGroupsMap.set(row.id, {
            id: row.id,
            name: row.name,
            description: row.description,
            is_required: row.is_required,
            selection_type: row.selection_type,
            sort_order: row.sort_order,
            options: []
          });
        }
        
        if (row.option_id) {
          optionGroupsMap.get(row.id).options.push({
            id: row.option_id,
            name: row.option_name,
            description: row.option_description,
            price_modifier: row.price_modifier,
            is_default: row.is_default,
            sort_order: row.option_sort_order
          });
        }
      }
      
      product.optionGroups = Array.from(optionGroupsMap.values());
    }
    
    console.log('✅ 成功從資料庫獲取', products.length, '個產品（含選項）');
    return products;
    
  } catch (error) {
    console.log('❌ 資料庫查詢失敗，但不切換到示範模式:', error.message);
    // 不自動切換demo模式，而是返回空陣列或重試
    console.log('🔄 嘗試重新查詢基本商品資料...');
    try {
      const { rows } = await pool.query('SELECT * FROM products ORDER BY id');
      console.log('✅ 重新查詢成功，獲取', rows.length, '個商品');
      return rows;
    } catch (retryError) {
      console.log('❌ 重試也失敗，返回空商品列表:', retryError.message);
      return [];
    }
  }
}

// 前台：首頁，列出商品
// 簡單測試路由
app.get('/test', (req, res) => {
  res.json({ 
    message: '蔬果外送系統測試成功！', 
    timestamp: new Date().toISOString(),
    session: !!req.session,
    demoMode: demoMode
  });
});

// 🎨 產品表情符號映射函數
function getProductEmoji(productName) {
  const emojiMap = {
    '高麗菜': '🥬',
    '白蘿蔔': '🥕',
    '紅蘿蔔': '🥕',
    '菠菜': '🥬', 
    '小白菜': '🥬',
    '韭菜': '🌿',
    '花椰菜': '🥦',
    '青花菜': '🥦',
    '蔥': '🧅',
    '薑': '🫚',
    '蒜': '🧄',
    '馬鈴薯': '🥔',
    '番茄': '🍅',
    '茄子': '🍆',
    '青椒': '🫑',
    '玉米': '🌽',
    '香菇': '🍄',
    '豆腐': '🥛',
    '豆芽菜': '🌱',
    '芹菜': '🌿',
    '蘆筍': '🌿'
  };
  
  for (const [key, emoji] of Object.entries(emojiMap)) {
    if (productName.includes(key)) {
      return emoji;
    }
  }
  return '🥬'; // 預設蔬菜表情符號
}

// 健康檢查端點 - 用於測試 Railway 部署
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: '誠憶鮮蔬外送系統',
    version: DEPLOY_VERSION,
    database: pool ? '已連接' : '未連接',
    mode: demoMode ? '示範模式' : '線上模式'
  });
});

// 系統資訊端點
app.get('/api/system/info', (req, res) => {
  try {
    const systemInfo = {
      success: true,
      service: '誠憶鮮蔬外送系統',
      version: DEPLOY_VERSION,
      status: 'online',
      timestamp: new Date().toISOString(),
      server: {
        nodeVersion: process.version,
        platform: process.platform,
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage()
      },
      database: {
        status: pool ? 'connected' : 'disconnected',
        mode: demoMode ? 'demo' : 'production'
      },
      features: {
        orderSystem: true,
        productManagement: true,
        inventoryTracking: true,
        driverPortal: true,
        adminDashboard: true,
        realtimeNotifications: true,
        lineIntegration: true,
        googleMapsIntegration: true
      },
      endpoints: {
        orders: '/api/orders',
        orderSubmit: '/api/orders/submit',
        products: '/api/products',
        health: '/api/health',
        systemInfo: '/api/system/info'
      }
    };
    
    res.json(systemInfo);
  } catch (err) {
    console.error('System info error:', err);
    res.status(500).json({
      success: false,
      message: '無法獲取系統資訊',
      error: err.message
    });
  }
});

// 性能監控端點
app.get('/api/performance', (req, res) => {
  try {
    const report = performanceMonitor.getPerformanceReport();
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      performance: report
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '無法獲取性能數據',
      error: error.message
    });
  }
});

app.get('/', async (req, res, next) => {
  try {
    const products = await fetchProducts();
    
    // 獲取網站設定 - 實際從資料庫載入或使用預設值
    let settings = defaultBasicSettings;
    
    if (!demoMode && basicSettingsService) {
      try {
        const dbSettings = await basicSettingsService.getAllSettings();
        // 合併資料庫設定與預設值
        settings = BasicSettingsService.mergeWithDefaults(dbSettings, defaultBasicSettings);
        console.log('✅ 前台載入資料庫設定成功');
      } catch (error) {
        console.error('⚠️ 載入資料庫設定失敗，使用預設值:', error.message);
        // 使用預設值作為fallback
      }
    }
    
    res.render('index_new_design', { 
      products: products,
      sessionLine: req.session.line || null,
      getProductEmoji: getProductEmoji,
      settings: settings
    });
  } catch (err) {
    next(err);
  }
});

// 🚛 外送員登入頁面
app.get('/driver/login', (req, res) => {
  res.render('driver_login', { error: null });
});

// 🚛 外送員登入處理
app.post('/driver/login', async (req, res) => {
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
    
    // 驗證外送員帳號（這裡可以從資料庫驗證）
    // 暫時使用預設帳號：手機 0912345678，密碼 driver123
    if (trimmedPhone === '0912345678' && trimmedPassword === 'driver123') {
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
});

// 🚛 外送員工作台 (新的簡化版本)
app.get('/driver/dashboard', ensureDriverPage, (req, res) => {
  
  res.render('driver_dashboard_simplified', {
    driver: {
      id: req.session.driverId,
      name: req.session.driverName || '外送員'
    }
  });
});

// 移動端外送員介面 - 重導向到統一介面
app.get('/driver/mobile', ensureDriverPage, (req, res) => {
  res.redirect('/driver');
});

// 舊版本路由已刪除，統一使用driver_dashboard_simplified

// 🚀 外送員PWA工作台
app.get('/driver', ensureDriverPage, (req, res) => {
  
  res.render('driver_dashboard_simplified', {
    driver: {
      id: req.session.driverId,
      name: req.session.driverName || '外送員'
    }
  });
});

// 🚛 外送員通訊中心 - 重導向到統一介面
app.get('/driver/chat', ensureDriverPage, (req, res) => {
  res.redirect('/driver');
});

// 🚛 外送員登出
app.get('/driver/logout', (req, res) => {
  console.log(`🚛 外送員登出: ${req.session.driverName || 'Unknown'}`);
  cleanupSession(req);
  res.redirect('/driver/login');
});

// 📱 手機除錯頁面
app.get('/debug-mobile', (req, res) => {
  res.render('debug_mobile');
});

// 🚨 緊急修復頁面 - 直接可用的外送員系統
app.get('/emergency-fix', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'emergency_fix.html'));
});

// 🛰️ 外送員GPS追蹤工作台 (重定向到簡化版)
app.get('/driver/dashboard-gps', ensureDriverPage, (req, res) => {
  res.redirect('/driver/dashboard');
});

// 🚛 外送員API - 可接訂單 (添加快取優化)
app.get('/api/driver/available-orders', apiCacheMiddleware(15000), async (req, res) => { // 15秒快取
  try {
    let orders = [];
    
    if (!demoMode && pool) {
      // 從資料庫獲取已包裝但未接取的訂單
      const query = `
        SELECT o.*, 
               c.name as customer_name, 
               c.phone as customer_phone,
               c.address,
               COALESCE(o.delivery_fee, 0) as delivery_fee
        FROM orders o
        JOIN customers c ON o.customer_id = c.id
        WHERE o.status = 'packed' 
          AND o.driver_id IS NULL
        ORDER BY o.created_at ASC
      `;
      
      const result = await pool.query(query);
      orders = result.rows;
      
      // 為每個訂單獲取商品詳情
      for (let order of orders) {
        const itemsQuery = `
          SELECT oi.*, p.name as product_name
          FROM order_items oi
          JOIN products p ON oi.product_id = p.id
          WHERE oi.order_id = $1
        `;
        const itemsResult = await pool.query(itemsQuery, [order.id]);
        order.items = itemsResult.rows;
        order.total = parseFloat(order.total_amount || 0);
        order.packed_at = order.packed_at || order.updated_at;
      }
    } else {
      // Demo模式的範例數據
      orders = [
        {
          id: 1234,
          customer_name: '王小明',
          customer_phone: '0912-345-678',
          address: '新北市三峽區中山路123號',
          total: 185,
          delivery_fee: 0,
          packed_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
          items: [
            { product_name: '高麗菜', quantity: 2, price: 45 },
            { product_name: '葡萄', quantity: 1, price: 95 }
          ]
        },
        {
          id: 1235,
          customer_name: '李小華',
          customer_phone: '0923-456-789',
          address: '新北市北大特區學成路456號',
          total: 230,
          delivery_fee: 0,
          packed_at: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
          items: [
            { product_name: '番茄', quantity: 3, price: 60 },
            { product_name: '胡蘿蔔', quantity: 2, price: 35 }
          ]
        }
      ];
    }
    
    res.json({ success: true, orders });
  } catch (error) {
    console.error('獲取可接訂單失敗:', error);
    res.status(500).json({ success: false, message: '獲取訂單失敗' });
  }
});

// 🚛 外送員API - 我的配送
app.get('/api/driver/my-orders', async (req, res) => {
  try {
    const driverId = req.session.driverId;
    if (!driverId) {
      return res.status(401).json({ success: false, message: '請先登入' });
    }
    
    let orders = [];
    
    if (!demoMode && pool) {
      // 從資料庫獲取該外送員正在配送的訂單
      const query = `
        SELECT o.*, 
               c.name as customer_name, 
               c.phone as customer_phone,
               c.address,
               COALESCE(o.delivery_fee, 0) as delivery_fee,
               o.taken_at
        FROM orders o
        JOIN customers c ON o.customer_id = c.id
        WHERE o.driver_id = $1 
          AND o.status = 'delivering'
        ORDER BY o.taken_at ASC
      `;
      
      const result = await pool.query(query, [driverId]);
      orders = result.rows;
      
      // 為每個訂單獲取商品詳情
      for (let order of orders) {
        const itemsQuery = `
          SELECT oi.*, p.name as product_name
          FROM order_items oi
          JOIN products p ON oi.product_id = p.id
          WHERE oi.order_id = $1
        `;
        const itemsResult = await pool.query(itemsQuery, [order.id]);
        order.items = itemsResult.rows;
        order.total = parseFloat(order.total_amount || 0);
      }
    }
    
    res.json({ success: true, orders });
  } catch (error) {
    console.error('獲取我的配送訂單失敗:', error);
    res.status(500).json({ success: false, message: '獲取訂單失敗' });
  }
});

// 🚛 外送員API - 已完成訂單
app.get('/api/driver/completed-orders', async (req, res) => {
  try {
    const driverId = req.session.driverId;
    if (!driverId) {
      return res.status(401).json({ success: false, message: '請先登入' });
    }
    
    let orders = [];
    
    if (!demoMode && pool) {
      // 從資料庫獲取該外送員今日已完成的訂單
      const query = `
        SELECT o.*, 
               c.name as customer_name, 
               c.phone as customer_phone,
               c.address,
               COALESCE(o.delivery_fee, 50) as delivery_fee,
               o.completed_at
        FROM orders o
        JOIN customers c ON o.customer_id = c.id
        WHERE o.driver_id = $1 
          AND o.status = 'delivered'
          AND DATE(o.completed_at) = CURRENT_DATE
        ORDER BY o.completed_at DESC
      `;
      
      const result = await pool.query(query, [driverId]);
      orders = result.rows;
      
      // 為每個訂單獲取商品詳情
      for (let order of orders) {
        const itemsQuery = `
          SELECT oi.*, p.name as product_name
          FROM order_items oi
          JOIN products p ON oi.product_id = p.id
          WHERE oi.order_id = $1
        `;
        const itemsResult = await pool.query(itemsQuery, [order.id]);
        order.items = itemsResult.rows;
        order.total = parseFloat(order.total_amount || 0);
      }
    }
    
    res.json({ success: true, orders });
  } catch (error) {
    console.error('獲取已完成訂單失敗:', error);
    res.status(500).json({ success: false, message: '獲取訂單失敗' });
  }
});

// 🚛 外送員API - 統計數據 (添加快取優化)
app.get('/api/driver/stats', apiCacheMiddleware(60000), async (req, res) => { // 60秒快取
  try {
    const driverId = req.session.driverId;
    if (!driverId) {
      return res.status(401).json({ success: false, message: '請先登入' });
    }
    
    let todayEarnings = 0;
    let todayCompleted = 0;
    
    if (!demoMode && pool) {
      // 計算今日收入和完成訂單數
      const statsQuery = `
        SELECT 
          COUNT(*) as completed_count,
          COALESCE(SUM(delivery_fee), 0) as total_earnings
        FROM orders 
        WHERE driver_id = $1 
          AND status = 'delivered'
          AND DATE(completed_at) = CURRENT_DATE
      `;
      
      const result = await pool.query(statsQuery, [driverId]);
      if (result.rows.length > 0) {
        todayCompleted = parseInt(result.rows[0].completed_count || 0);
        todayEarnings = parseFloat(result.rows[0].total_earnings || 0);
      }
    }
    
    res.json({
      success: true,
      todayEarnings: todayEarnings,
      todayCompleted: todayCompleted
    });
  } catch (error) {
    console.error('獲取統計數據失敗:', error);
    res.status(500).json({ success: false, message: '獲取統計失敗' });
  }
});

// 🚛 外送員API - 訂單詳情
app.get('/api/driver/order/:id', (req, res) => {
  const orderId = req.params.id;
  
  // 模擬訂單詳情
  const order = {
    id: orderId,
    customer_name: '王小明',
    customer_phone: '0912-345-678',
    address: '新北市三峽區中山路123號',
    total: 185,
    subtotal: 185,
    delivery_fee: 0,
    payment_method: 'LINEPAY',
    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    items: [
      { product_name: '高麗菜', quantity: 2, price: 45 },
      { product_name: '葡萄', quantity: 1, price: 95 }
    ]
  };
  
  res.json(order);
});

// 🚛 外送員API - 接取訂單
app.post('/api/driver/take-order/:id', async (req, res) => {
  const orderId = req.params.id;
  const driverId = req.session.driverId;
  
  if (!driverId) {
    return res.status(401).json({ success: false, message: '請先登入' });
  }
  
  try {
    if (!demoMode && pool) {
      // 檢查訂單是否還可以接取
      const checkQuery = `
        SELECT id, status, driver_id 
        FROM orders 
        WHERE id = $1 AND status = 'packed' AND driver_id IS NULL
      `;
      const checkResult = await pool.query(checkQuery, [orderId]);
      
      if (checkResult.rows.length === 0) {
        return res.status(400).json({ 
          success: false, 
          message: '此訂單已被其他外送員接取或狀態已變更' 
        });
      }
      
      // 更新訂單狀態為配送中，並指派給外送員
      const updateQuery = `
        UPDATE orders 
        SET status = 'delivering', 
            driver_id = $1, 
            taken_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
      `;
      await pool.query(updateQuery, [driverId, orderId]);
      
      console.log(`✅ 外送員 ${driverId} 成功接取訂單 ${orderId}`);
    } else {
      console.log(`📝 Demo模式: 外送員 ${driverId} 接取了訂單 ${orderId}`);
    }
    
    // 清除相關API快取
    clearApiCache('available-orders');
    clearApiCache('driver/stats');
    clearApiCache('today-stats');
    
    res.json({ success: true, message: '訂單接取成功' });
  } catch (error) {
    console.error('接取訂單失敗:', error);
    res.status(500).json({ success: false, message: '接取訂單失敗，請重試' });
  }
});

// 🚛 外送員API - 完成配送
app.post('/api/driver/complete-order/:id', async (req, res) => {
  const orderId = req.params.id;
  const driverId = req.session.driverId;
  
  if (!driverId) {
    return res.status(401).json({ success: false, message: '請先登入' });
  }
  
  try {
    if (!demoMode && pool) {
      // 檢查訂單是否屬於該外送員且正在配送中
      const checkQuery = `
        SELECT id, status, driver_id, customer_id
        FROM orders 
        WHERE id = $1 AND driver_id = $2 AND status = 'delivering'
      `;
      const checkResult = await pool.query(checkQuery, [orderId, driverId]);
      
      if (checkResult.rows.length === 0) {
        return res.status(400).json({ 
          success: false, 
          message: '此訂單不存在或不屬於您，或狀態已變更' 
        });
      }
      
      // 更新訂單狀態為已完成
      const updateQuery = `
        UPDATE orders 
        SET status = 'delivered', 
            completed_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `;
      await pool.query(updateQuery, [orderId]);
      
      // TODO: 這裡可以發送LINE通知給客戶
      const customerId = checkResult.rows[0].customer_id;
      console.log(`✅ 外送員 ${driverId} 完成訂單 ${orderId}，應發送通知給客戶 ${customerId}`);
      
    } else {
      console.log(`📝 Demo模式: 外送員 ${driverId} 完成了訂單 ${orderId}`);
    }
    
    // 清除相關API快取
    clearApiCache('driver/stats');
    clearApiCache('today-stats');
    clearApiCache('my-orders');
    clearApiCache('completed-orders');
    
    res.json({ success: true, message: '配送完成' });
  } catch (error) {
    console.error('完成配送失敗:', error);
    res.status(500).json({ success: false, message: '完成配送失敗，請重試' });
  }
});

// 🚀 PWA 外送員API - 今日統計 (添加快取優化)
app.get('/api/driver/today-stats', apiCacheMiddleware(45000), async (req, res) => { // 45秒快取
  const driverId = req.session.driverId;
  
  if (!driverId) {
    return res.status(401).json({ success: false, message: '請先登入' });
  }
  
  try {
    let completed = 0;
    let active = 0;
    let earnings = 0;
    
    if (!demoMode && pool) {
      // 今日完成訂單數和收入
      const completedQuery = `
        SELECT COUNT(*) as completed_count, COALESCE(SUM(total_amount), 0) as total_earnings
        FROM orders 
        WHERE driver_id = $1 
          AND status = 'delivered' 
          AND DATE(updated_at) = CURRENT_DATE
      `;
      const completedResult = await pool.query(completedQuery, [driverId]);
      
      if (completedResult.rows.length > 0) {
        completed = parseInt(completedResult.rows[0].completed_count || 0);
        earnings = parseFloat(completedResult.rows[0].total_earnings || 0);
      }
      
      // 進行中訂單數
      const activeQuery = `
        SELECT COUNT(*) as active_count
        FROM orders 
        WHERE driver_id = $1 
          AND status IN ('assigned', 'picked_up', 'delivering')
      `;
      const activeResult = await pool.query(activeQuery, [driverId]);
      
      if (activeResult.rows.length > 0) {
        active = parseInt(activeResult.rows[0].active_count || 0);
      }
    } else {
      // Demo 模式數據
      completed = 3;
      active = 1;
      earnings = 285;
    }
    
    res.json({
      completed,
      active,
      earnings
    });
  } catch (error) {
    console.error('獲取今日統計失敗:', error);
    res.status(500).json({ success: false, message: '獲取統計失敗' });
  }
});

// 🚀 PWA 外送員API - 當前任務
app.get('/api/driver/current-task', async (req, res) => {
  const driverId = req.session.driverId;
  
  if (!driverId) {
    return res.status(401).json({ success: false, message: '請先登入' });
  }
  
  try {
    let currentTask = null;
    
    if (!demoMode && pool) {
      const query = `
        SELECT o.*, oi.item_name, oi.quantity, oi.unit_price
        FROM orders o
        LEFT JOIN order_items oi ON o.id = oi.order_id
        WHERE o.driver_id = $1 
          AND o.status IN ('assigned', 'picked_up', 'delivering')
        ORDER BY o.updated_at ASC
        LIMIT 1
      `;
      const result = await pool.query(query, [driverId]);
      
      if (result.rows.length > 0) {
        currentTask = result.rows[0];
      }
    } else {
      // Demo 模式數據
      currentTask = {
        id: 1001,
        contact_name: '王小明',
        contact_phone: '0912-345-678',
        address: '台北市信義區市府路1號',
        total_amount: 280,
        status: 'delivering',
        lat: 25.0415,
        lng: 121.5671
      };
    }
    
    res.json(currentTask);
  } catch (error) {
    console.error('獲取當前任務失敗:', error);
    res.status(500).json({ success: false, message: '獲取當前任務失敗' });
  }
});

// 🚀 PWA 外送員API - 待配送訂單
app.get('/api/driver/pending-orders', async (req, res) => {
  const driverId = req.session.driverId;
  
  if (!driverId) {
    return res.status(401).json({ success: false, message: '請先登入' });
  }
  
  try {
    let orders = [];
    
    if (!demoMode && pool) {
      const query = `
        SELECT id, contact_name, contact_phone, address, total_amount, status, lat, lng
        FROM orders 
        WHERE driver_id = $1 
          AND status IN ('assigned', 'picked_up')
        ORDER BY created_at ASC
      `;
      const result = await pool.query(query, [driverId]);
      orders = result.rows;
    } else {
      // Demo 模式數據
      orders = [
        {
          id: 1002,
          contact_name: '李大華',
          contact_phone: '0923-456-789',
          address: '台北市大安區忠孝東路四段100號',
          total_amount: 350,
          status: 'assigned'
        },
        {
          id: 1003,
          contact_name: '陳美玲',
          contact_phone: '0934-567-890',
          address: '台北市松山區南京東路五段200號',
          total_amount: 195,
          status: 'assigned'
        }
      ];
    }
    
    res.json(orders);
  } catch (error) {
    console.error('獲取待配送訂單失敗:', error);
    res.status(500).json({ success: false, message: '獲取訂單失敗' });
  }
});

// 🚀 PWA 外送員API - 取貨確認
app.post('/api/driver/pickup-order/:id', async (req, res) => {
  const orderId = req.params.id;
  const driverId = req.session.driverId;
  
  if (!driverId) {
    return res.status(401).json({ success: false, message: '請先登入' });
  }
  
  try {
    if (!demoMode && pool) {
      await pool.query(`
        UPDATE orders 
        SET status = 'picked_up', updated_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND driver_id = $2
      `, [orderId, driverId]);
    }
    
    res.json({ success: true, message: '取貨確認成功' });
  } catch (error) {
    console.error('取貨確認失敗:', error);
    res.status(500).json({ success: false, message: '取貨確認失敗' });
  }
});

// 🚀 PWA 外送員API - 開始配送
app.post('/api/driver/start-delivery/:id', async (req, res) => {
  const orderId = req.params.id;
  const driverId = req.session.driverId;
  
  if (!driverId) {
    return res.status(401).json({ success: false, message: '請先登入' });
  }
  
  try {
    if (!demoMode && pool) {
      await pool.query(`
        UPDATE orders 
        SET status = 'delivering', updated_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND driver_id = $2
      `, [orderId, driverId]);
    }
    
    res.json({ success: true, message: '開始配送' });
  } catch (error) {
    console.error('開始配送失敗:', error);
    res.status(500).json({ success: false, message: '開始配送失敗' });
  }
});

// 🚀 PWA 外送員API - 完成配送
app.post('/api/driver/complete-delivery/:id', async (req, res) => {
  const orderId = req.params.id;
  const driverId = req.session.driverId;
  
  if (!driverId) {
    return res.status(401).json({ success: false, message: '請先登入' });
  }
  
  try {
    if (!demoMode && pool) {
      await pool.query(`
        UPDATE orders 
        SET status = 'delivered', 
            delivered_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND driver_id = $2
      `, [orderId, driverId]);
    }
    
    res.json({ success: true, message: '配送完成' });
  } catch (error) {
    console.error('完成配送失敗:', error);
    res.status(500).json({ success: false, message: '完成配送失敗' });
  }
});

// 🚀 PWA 外送員API - 獲取下一個訂單
app.get('/api/driver/next-order/:completedOrderId', async (req, res) => {
  const completedOrderId = req.params.completedOrderId;
  const driverId = req.session.driverId;
  
  if (!driverId) {
    return res.status(401).json({ success: false, message: '請先登入' });
  }
  
  try {
    let nextOrder = null;
    
    if (!demoMode && pool) {
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
      const result = await pool.query(query, [driverId, completedOrderId]);
      
      if (result.rows.length > 0) {
        nextOrder = result.rows[0];
      }
    } else {
      // Demo 模式：模擬下一個訂單
      nextOrder = {
        id: parseInt(completedOrderId) + 1,
        contact_name: '下一位客戶',
        contact_phone: '0912-000-000',
        address: '台北市中正區重慶南路一段122號',
        total_amount: 220,
        lat: 25.0415,
        lng: 121.5671
      };
    }
    
    res.json(nextOrder);
  } catch (error) {
    console.error('獲取下一個訂單失敗:', error);
    res.status(500).json({ success: false, message: '獲取下一個訂單失敗' });
  }
});

// 🚀 管理後台路由
app.get('/admin/dashboard', ensureAdmin, async (req, res, next) => {
  console.log('📊 管理後台被訪問');
  
  try {
    // 準備儀表板數據
    const dashboardData = {
      stats: {
        todayRevenue: 12450,
        todayOrders: 47,
        todayCustomers: 38,
        avgOrderValue: 265
      },
      recentOrders: [],
      inventoryAlerts: [],
      deliveryStatus: {}
    };
    
    if (!demoMode) {
      // 從資料庫獲取真實數據
      try {
        const revenueQuery = await pool.query(`
          SELECT COALESCE(SUM(total_amount), 0) as today_revenue,
                 COUNT(*) as today_orders
          FROM orders 
          WHERE DATE(created_at) = CURRENT_DATE
        `);
        
        if (revenueQuery.rows.length > 0) {
          dashboardData.stats.todayRevenue = parseFloat(revenueQuery.rows[0].today_revenue || 0);
          dashboardData.stats.todayOrders = parseInt(revenueQuery.rows[0].today_orders || 0);
        }
      } catch (dbError) {
        console.warn('⚠️ 無法從資料庫獲取數據，使用demo數據:', dbError.message);
      }
    }
    
    res.render('admin_dashboard', { 
      title: '誠意鮮蔬 - 管理後台',
      dashboardData: dashboardData,
      user: {
        name: '黃士嘉',
        role: '系統管理員'
      },
      googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY
    });
  } catch (error) {
    console.error('❌ 管理後台載入錯誤:', error);
    next(error);
  }
});

// API: 獲取儀表板數據
app.get('/api/admin/dashboard', ensureAdmin, asyncWrapper(async (req, res) => {
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
    
    if (!demoMode) {
      // 從資料庫獲取真實數據
      try {
        // 今日統計
        const revenueQuery = await pool.query(`
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
        const recentOrdersQuery = await pool.query(`
          SELECT id, contact_name, total, status, created_at
          FROM orders 
          ORDER BY created_at DESC 
          LIMIT 5
        `);
        dashboardData.recentOrders = recentOrdersQuery.rows;
        
        // 庫存警示 (模擬數據，需要庫存系統)
        dashboardData.inventoryAlerts = [
          { product: '有機小白菜', current: 5, minimum: 10, status: 'warning' },
          { product: '紅蘿蔔', current: 2, minimum: 15, status: 'critical' }
        ];
        
        // 待處理任務統計
        const pendingOrdersQuery = await pool.query(`
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
    
    res.json({
      success: true,
      data: dashboardData
    });
    
  } catch (error) {
    console.error('取得儀表板數據失敗:', error);
    res.status(500).json({
      success: false,
      message: '取得儀表板數據失敗'
    });
  }
}));

// 前台：結帳頁
app.get('/checkout', (req, res) => {
  res.render('checkout_new');
});

// API：提交訂單
app.post('/api/orders', orderLimiter, sanitizeInput, validateOrderData, asyncWrapper(async (req, res) => {
  const { name, phone, address, notes, paymentMethod, items, lineUserId, lineDisplayName } = req.body;
  try {
    if (!name || !phone || !address || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: '參數不完整' });
    }
    
    // 示範模式處理
    if (demoMode) {
      console.log('📋 示範模式：模擬訂單建立');
      const mockOrderId = Math.floor(Math.random() * 9000) + 1000;
      
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
    let subtotal = 0;
    const orderItems = [];
    for (const it of items) {
      const { productId, quantity, selectedUnit } = it;
      const { rows } = await pool.query('SELECT * FROM products WHERE id=$1', [productId]);
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
        selectedUnit: selectedUnit || p.unit_hint // 保存客戶選擇的單位
      });
    }
    const deliveryFee = subtotal >= 200 ? 0 : 50;
    const total = subtotal + deliveryFee;
    // 簡化訂單創建，先不做地理編碼
    console.log('Creating order with data:', { name, phone, address, notes, paymentMethod, subtotal, deliveryFee, total, lineUserId });
    // 簡化插入，包含 LINE 用戶 ID（如果有的話）
    const insertOrder = await pool.query(
      'INSERT INTO orders (contact_name, contact_phone, address, notes, subtotal, delivery_fee, total, payment_method, status, line_user_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id',
      [name, phone, address, notes || '', subtotal, deliveryFee, total, paymentMethod || 'cash', 'placed', lineUserId || null]
    );
    const orderId = insertOrder.rows[0].id;
    
    // 如果有 LINE 用戶資料，同時處理用戶資料綁定
    if (lineUserId && lineDisplayName) {
      try {
        // 使用我們修復過的安全方式處理用戶資料
        const existingUser = await pool.query(`
          SELECT id FROM users WHERE line_user_id = $1
        `, [lineUserId]);
        
        if (existingUser.rows.length > 0) {
          // 更新現有用戶的聯繫資料
          await pool.query(`
            UPDATE users 
            SET phone = $1, name = $2, line_display_name = $3
            WHERE line_user_id = $4
          `, [phone, name, lineDisplayName, lineUserId]);
          console.log(`📱 更新現有 LINE 用戶資料: ${lineDisplayName} (${lineUserId})`);
        } else {
          // 創建新用戶記錄
          await pool.query(`
            INSERT INTO users (phone, name, line_user_id, line_display_name, created_at)
            VALUES ($1, $2, $3, $4, NOW())
          `, [phone, name, lineUserId, lineDisplayName]);
          console.log(`📱 創建新 LINE 用戶: ${lineDisplayName} (${lineUserId})`);
        }
      } catch (userError) {
        console.warn('⚠️ LINE 用戶資料處理失敗，但訂單已成功創建:', userError.message);
      }
    }
    
    // 🔄 自動扣庫存機制 - 直接資料庫操作
    try {
      const inventoryItems = orderItems
        .filter(item => !item.is_priced_item); // 只有固定價格商品需要扣庫存
        
      if (inventoryItems.length > 0) {
        let stockUpdated = 0;
        let stockErrors = [];
        
        for (const item of inventoryItems) {
          try {
            // 檢查庫存是否足夠
            const stockCheck = await pool.query(
              'SELECT current_stock FROM inventory WHERE product_id = $1',
              [item.product_id]
            );
            
            if (stockCheck.rows.length === 0) {
              // 如果沒有庫存記錄，創建一個初始記錄（假設無限庫存）
              await pool.query(
                'INSERT INTO inventory (product_id, current_stock, min_stock_alert) VALUES ($1, $2, $3)',
                [item.product_id, 999, 10]
              );
              console.log(`⚠️ 商品 ${item.name} 無庫存記錄，已創建初始庫存`);
            } else {
              const currentStock = stockCheck.rows[0].current_stock;
              
              if (currentStock >= item.quantity) {
                // 扣除庫存
                await pool.query(
                  'UPDATE inventory SET current_stock = current_stock - $1, last_updated = CURRENT_TIMESTAMP WHERE product_id = $2',
                  [item.quantity, item.product_id]
                );
                
                // 記錄庫存異動
                await pool.query(
                  'INSERT INTO stock_movements (product_id, movement_type, quantity, reason, reference_order_id, operator_name) VALUES ($1, $2, $3, $4, $5, $6)',
                  [item.product_id, 'out', item.quantity, `訂單出貨 #${orderId}`, orderId, '系統自動']
                );
                
                stockUpdated++;
                console.log(`✅ 商品 ${item.name} 庫存已扣除: ${item.quantity} 件`);
              } else {
                stockErrors.push(`${item.name}: 庫存不足 (需要${item.quantity}件，剩餘${currentStock}件)`);
                console.log(`⚠️ 商品 ${item.name} 庫存不足，跳過扣除`);
              }
            }
          } catch (itemError) {
            stockErrors.push(`${item.name}: ${itemError.message}`);
            console.error(`❌ 商品 ${item.name} 庫存處理失敗:`, itemError.message);
          }
        }
        
        if (stockUpdated > 0) {
          console.log(`✅ 訂單 #${orderId} 庫存扣除完成: ${stockUpdated}/${inventoryItems.length} 項商品`);
        }
        
        if (stockErrors.length > 0) {
          console.log(`⚠️ 訂單 #${orderId} 部分商品庫存處理異常: ${stockErrors.join(', ')}`);
        }
      }
    } catch (inventoryError) {
      console.error(`❌ 庫存扣除失敗 (訂單 #${orderId}):`, inventoryError.message);
      // 庫存扣除失敗不影響訂單建立，但要記錄錯誤
      // 管理員可以在後台手動處理庫存
    }
    
    // 插入品項
    for (const item of orderItems) {
      await pool.query(
        'INSERT INTO order_items (order_id, product_id, name, is_priced_item, quantity, unit_price, line_total, actual_weight) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
        [orderId, item.product_id, item.name, item.is_priced_item, item.quantity, item.unit_price, item.line_total, item.actual_weight]
      );
    }
    // 🔗 LINE 用戶整合 - 自動註冊和關聯
    try {
      // 檢查是否有 LINE 用戶資訊（從請求參數或 session 獲取）
      const lineUserId = req.body.line_user_id || (req.session.line && req.session.line.userId);
      const lineDisplayName = req.body.line_name || (req.session.line && req.session.line.displayName);
      
      if (lineUserId && lineUserService) {
        // 自動更新 LINE 用戶的電話號碼綁定
        await lineUserService.bindUserPhone(lineUserId, phone);
        
        // 關聯訂單與 LINE 用戶
        await lineUserService.linkOrderToLineUser(orderId, lineUserId);
        
        console.log(`🔗 訂單 #${orderId} 已自動關聯 LINE 用戶: ${lineDisplayName} (${lineUserId})`);
      } else {
        // 嘗試透過電話號碼查詢是否已有 LINE 用戶
        const existingUserId = await lineUserService?.getLineUserIdByPhone(phone);
        if (existingUserId) {
          await lineUserService.linkOrderToLineUser(orderId, existingUserId);
          console.log(`🔗 訂單 #${orderId} 已關聯到現有 LINE 用戶: ${existingUserId}`);
        }
      }
    } catch (lineError) {
      console.warn('⚠️ LINE 用戶整合失敗 (不影響訂單建立):', lineError.message);
    }

    // 保持原有用戶表邏輯 (向後相容)
    if (req.session.line && req.session.line.userId) {
      await upsertUser(phone, name, req.session.line.userId, req.session.line.displayName);
    } else {
      await upsertUser(phone, name, null, null);
    }
    res.json({ 
      success: true, 
      orderId,
      message: '訂單已成功建立',
      data: {
        orderId,
        total,
        estimatedDelivery: '2-3小時內'
      }
    });
  } catch (err) {
    console.error('Create order error:', err);
    res.status(500).json({ 
      success: false, 
      message: '建立訂單時發生錯誤，請稍後再試',
      error: err.message, // 暫時在生產環境也顯示錯誤資訊
      errorCode: err.code,
      debug: err.stack
    });
  }
}));

// API：訂單提交端點 - 兼容性端點，重定向到主要訂單處理邏輯
app.post('/api/orders/submit', orderLimiter, sanitizeInput, validateOrderData, asyncWrapper(async (req, res) => {
  // 這是一個兼容性端點，直接使用與 /api/orders 相同的邏輯
  const { name, phone, address, notes, paymentMethod, items } = req.body;
  try {
    if (!name || !phone || !address || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: '參數不完整' });
    }
    
    // 示範模式處理
    if (demoMode) {
      console.log('📋 示範模式：模擬訂單建立（通過 /api/orders/submit）');
      const mockOrderId = Math.floor(Math.random() * 9000) + 1000;
      
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
        message: '✅ 訂單提交成功！（示範模式）',
        data: {
          orderId: mockOrderId,
          total,
          estimatedDelivery: '2-3小時內（示範模式）'
        }
      });
    }

    // 正常資料庫模式 - 與主要端點共用邏輯
    let subtotal = 0;
    const orderItems = [];
    for (const it of items) {
      const { productId, quantity, selectedUnit } = it;
      const { rows } = await pool.query('SELECT * FROM products WHERE id=$1', [productId]);
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
    
    console.log('Creating order via /api/orders/submit with data:', { name, phone, address, notes, paymentMethod, subtotal, deliveryFee, total });
    
    const insertOrder = await pool.query(
      'INSERT INTO orders (contact_name, contact_phone, address, notes, subtotal, delivery_fee, total, payment_method, status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id',
      [name, phone, address, notes || '', subtotal, deliveryFee, total, paymentMethod || 'cash', 'placed']
    );
    const orderId = insertOrder.rows[0].id;
    
    // 插入品項
    for (const item of orderItems) {
      await pool.query(
        'INSERT INTO order_items (order_id, product_id, name, is_priced_item, quantity, unit_price, line_total, actual_weight) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
        [orderId, item.product_id, item.name, item.is_priced_item, item.quantity, item.unit_price, item.line_total, item.actual_weight]
      );
    }
    
    // 自動扣庫存機制（簡化版）
    try {
      const inventoryItems = orderItems.filter(item => !item.is_priced_item);
      
      for (const item of inventoryItems) {
        try {
          const stockCheck = await pool.query(
            'SELECT current_stock FROM inventory WHERE product_id = $1',
            [item.product_id]
          );
          
          if (stockCheck.rows.length === 0) {
            await pool.query(
              'INSERT INTO inventory (product_id, current_stock, min_stock_alert) VALUES ($1, $2, $3)',
              [item.product_id, 999, 10]
            );
          } else {
            const currentStock = stockCheck.rows[0].current_stock;
            if (currentStock >= item.quantity) {
              await pool.query(
                'UPDATE inventory SET current_stock = current_stock - $1, last_updated = CURRENT_TIMESTAMP WHERE product_id = $2',
                [item.quantity, item.product_id]
              );
            }
          }
        } catch (itemError) {
          console.error(`庫存處理錯誤 (商品 ${item.name}):`, itemError.message);
        }
      }
    } catch (inventoryError) {
      console.error(`庫存扣除失敗 (訂單 #${orderId}):`, inventoryError.message);
    }
    
    console.log(`✅ 訂單提交成功 (透過 /api/orders/submit): #${orderId}`);
    
    res.json({
      success: true,
      orderId: orderId,
      message: '✅ 訂單提交成功！',
      data: {
        orderId: orderId,
        subtotal: subtotal,
        deliveryFee: deliveryFee,
        total: total,
        estimatedDelivery: '2-3小時內'
      }
    });
  } catch (err) {
    console.error('Order submit error:', err);
    res.status(500).json({ 
      success: false, 
      message: '訂單提交失敗，請稍後再試',
      error: err.message
    });
  }
}));

// API：取得所有產品（供前端 checkout 重新計算小計）
app.get('/api/products', asyncWrapper(async (req, res) => {
  try {
    let products;
    
    if (demoMode) {
      console.log('📦 API：使用示範產品資料');
      products = demoProducts;
    } else {
      const { rows } = await pool.query('SELECT * FROM products ORDER BY id');
      products = rows;
    }
    
    res.json({ 
      success: true,
      products,
      count: products.length,
      mode: demoMode ? 'demo' : 'database'
    });
  } catch (error) {
    console.log('❌ API產品查詢失敗，使用示範資料');
    res.json({ 
      success: true,
      products: demoProducts,
      count: demoProducts.length,
      mode: 'demo'
    });
  }
}));

// API：單位換算服務
app.post('/api/unit-convert', (req, res) => {
  try {
    const { value, fromUnit, toUnit } = req.body;
    
    if (!value || !fromUnit || !toUnit) {
      return res.status(400).json({
        success: false,
        message: '缺少必要參數'
      });
    }
    
    const convertedValue = UnitConverter.convert(value, fromUnit, toUnit);
    const formatted = UnitConverter.formatWeight(convertedValue, toUnit);
    
    res.json({
      success: true,
      original: {
        value: value,
        unit: fromUnit,
        display: UnitConverter.formatWeight(value, fromUnit)
      },
      converted: {
        value: convertedValue,
        unit: toUnit,
        display: formatted
      },
      conversionRate: convertedValue / value
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: '換算失敗：' + error.message
    });
  }
});

// API：取得支援的單位列表
app.get('/api/supported-units', (req, res) => {
  res.json({
    success: true,
    units: UnitConverter.getSupportedUnits(),
    conversionRates: UnitConverter.CONVERSION_RATES
  });
});

// API：批量單位換算
app.post('/api/batch-convert', (req, res) => {
  try {
    const { items, targetUnit } = req.body;
    
    if (!Array.isArray(items) || !targetUnit) {
      return res.status(400).json({
        success: false,
        message: '缺少必要參數'
      });
    }
    
    const results = UnitConverter.batchConvert(items, targetUnit);
    
    res.json({
      success: true,
      targetUnit: targetUnit,
      results: results
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: '批量換算失敗：' + error.message
    });
  }
});

// 前台：訂單成功頁（供外部連結使用）
app.get('/order-success', async (req, res) => {
  const id = parseInt(req.query.id, 10) || parseInt(req.query.orderId, 10);
  if (!id) return res.status(400).send('訂單不存在');
  
  if (demoMode) {
    // 示範模式：顯示模擬訂單成功頁
    const mockOrder = {
      id: id,
      contact_name: '示範用戶',
      contact_phone: '0912345678',
      address: '台北市信義區信義路五段 7 號',
      subtotal: 180,
      delivery_fee: 20,
      total: 200,
      payment_method: 'cash',
      notes: '請送到一樓大廳',
      status: 'placed',
      created_at: new Date(),
      items: [
        { name: '有機高麗菜', quantity: 1, is_priced_item: false, line_total: 80 },
        { name: '新鮮玉米筍', quantity: 2, is_priced_item: false, line_total: 100 }
      ]
    };
    return res.render('order_success', { order: mockOrder, sessionLine: null });
  }
  
  try {
    // 載入訂單基本資料
    const { rows: orders } = await pool.query('SELECT * FROM orders WHERE id=$1', [id]);
    if (orders.length === 0) return res.status(404).send('訂單不存在');
    const order = orders[0];
    
    // 載入訂單明細
    const { rows: items } = await pool.query(
      'SELECT * FROM order_items WHERE order_id=$1 ORDER BY id', 
      [id]
    );
    order.items = items;
    
    // 傳遞 LINE 綁定狀態
    const sessionLine = req.session?.lineUserId || null;
    
    res.render('order_success', { order, sessionLine });
  } catch (err) {
    console.error('Order success error:', err);
    res.status(500).send('錯誤');
  }
});

// 管理後台根路徑重定向
app.get('/admin', (req, res) => {
  if (req.session && req.session.isAdmin) {
    res.redirect('/admin/dashboard');
  } else {
    res.redirect('/admin/login');
  }
});

// 登入頁
app.get('/admin/login', (req, res) => {
  res.render('admin_login', { error: null });
});

// 處理登入
app.post('/admin/login', validateAdminPassword, (req, res) => {
  try {
    const { password } = req.body;
    const adminPassword = process.env.ADMIN_PASSWORD || 'shnf830629';
    
    // 輸入驗證
    if (!password || password.trim().length === 0) {
      console.log('❌ 登入失敗: 密碼為空');
      return res.render('admin_login', { error: '請輸入密碼' });
    }
    
    const trimmedPassword = password.trim();
    console.log('🔐 管理員登入嘗試');
    
    if (trimmedPassword === adminPassword) {
      // 成功登入
      req.session.isAdmin = true;
      req.session.loginTime = new Date();
      req.session.lastActivity = new Date();
      req.session.userAgent = req.get('User-Agent'); // 記錄瀏覽器資訊
      
      console.log('✅ 管理員登入成功，重導向到 dashboard');
      return res.redirect('/admin/dashboard');
    }
    
    // 密碼錯誤
    console.log('❌ 管理員登入失敗: 密碼錯誤');
    res.render('admin_login', { error: '密碼錯誤，請重新輸入' });
    
  } catch (error) {
    console.error('❌ 登入處理錯誤:', error);
    res.render('admin_login', { error: '系統錯誤，請稍後再試' });
  }
});

// 管理員登出
app.get('/admin/logout', (req, res) => {
  console.log('🔐 管理員登出');
  cleanupSession(req);
  res.redirect('/admin/login');
});

// 管理員驗證中介 - 增強版本
function ensureAdmin(req, res, next) {
  // Session健康檢查
  if (!req.session) {
    console.warn('⚠️ ensureAdmin: Session不存在，重定向到登入');
    return res.redirect('/admin/login');
  }
  
  // 檢查管理員權限
  if (req.session.isAdmin) {
    // 更新最後活動時間
    req.session.lastActivity = new Date();
    
    // 檢查Session是否過期（額外安全檢查）
    if (req.session.lastActivity && 
        (new Date() - new Date(req.session.lastActivity)) > 7 * 24 * 60 * 60 * 1000) {
      console.warn('⚠️ ensureAdmin: Session已過期，清理並重定向');
      cleanupSession(req);
      return res.redirect('/admin/login');
    }
    return next();
  }
  return res.redirect('/admin/login');
}

// 外送員驗證中介 - 強化版本
function ensureDriver(req, res, next) {
  try {
    // Session健康檢查
    if (!req.session) {
      console.warn('⚠️ ensureDriver: Session不存在');
      return res.status(401).json({ 
        success: false, 
        message: '請先登入',
        code: 'SESSION_NOT_FOUND'
      });
    }
    
    // 檢查外送員權限
    if (!req.session.driverId) {
      console.warn('⚠️ ensureDriver: 外送員未登入');
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
      console.warn(`⚠️ ensureDriver: Session已過期 (${Math.round(sessionAge/1000/60)}分鐘)`);
      cleanupSession(req);
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
      console.warn('⚠️ ensureDriver: 瀏覽器不一致，可能的安全風險');
      cleanupSession(req);
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
    console.error('❌ ensureDriver錯誤:', error);
    return res.status(500).json({ 
      success: false, 
      message: '認證系統錯誤',
      code: 'AUTH_SYSTEM_ERROR'
    });
  }
}

// 外送員頁面驗證中介 - 強化版本
function ensureDriverPage(req, res, next) {
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
      cleanupSession(req);
      req.flash('error', 'Session已過期，請重新登入');
      return res.redirect('/driver/login');
    }
    
    // 檢查瀏覽器是否一致
    const currentUA = req.get('User-Agent');
    const sessionUA = req.session.userAgent;
    if (sessionUA && currentUA !== sessionUA) {
      console.warn('⚠️ ensureDriverPage: 瀏覽器不一致');
      cleanupSession(req);
      req.flash('error', '安全檢查失敗，請重新登入');
      return res.redirect('/driver/login');
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
    req.flash('error', '認證系統錯誤');
    return res.redirect('/driver/login');
  }
}

// ---------------- LINE 登入與綁定 ----------------
// 產生登入 URL
app.get('/auth/line/login', (req, res) => {
  const clientId = process.env.LINE_CHANNEL_ID;
  const redirectUri = process.env.LINE_REDIRECT_URI;
  if (!clientId || !redirectUri) {
    return res.status(500).send('LINE 設定尚未完成');
  }
  // 生成亂數 state 防止 CSRF
  const state = Math.random().toString(36).substring(2);
  req.session.lineState = state;
  const scope = 'profile';
  const authUrl =
    'https://access.line.me/oauth2/v2.1/authorize' +
    '?response_type=code' +
    '&client_id=' + encodeURIComponent(clientId) +
    '&redirect_uri=' + encodeURIComponent(redirectUri) +
    '&state=' + encodeURIComponent(state) +
    '&scope=' + encodeURIComponent(scope);
  res.redirect(authUrl);
});

// LINE 登入回呼
app.get('/auth/line/callback', async (req, res) => {
  const { code, state } = req.query;
  const sessionState = req.session.lineState;
  // 檢查 state
  if (!state || !sessionState || state !== sessionState) {
    return res.status(400).send('狀態驗證失敗');
  }
  // 移除狀態
  delete req.session.lineState;
  try {
    const clientId = process.env.LINE_CHANNEL_ID;
    const clientSecret = process.env.LINE_CHANNEL_SECRET;
    const redirectUri = process.env.LINE_REDIRECT_URI;
    // 交換 token
    const tokenRes = await fetch('https://api.line.me/oauth2/v2.1/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUri,
        client_id: clientId,
        client_secret: clientSecret
      })
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      console.error('LINE token error:', tokenData);
      return res.status(400).send('LINE 登入失敗');
    }
    // 取得使用者資料
    const profileRes = await fetch('https://api.line.me/v2/profile', {
      headers: { Authorization: 'Bearer ' + tokenData.access_token }
    });
    const profile = await profileRes.json();
    if (!profile.userId) {
      console.error('LINE profile error:', profile);
      return res.status(400).send('無法取得 LINE 使用者資料');
    }
    // 將資料存入 session
    req.session.line = {
      userId: profile.userId,
      displayName: profile.displayName
    };
    res.redirect('/line-connected');
  } catch (err) {
    console.error('LINE login callback error:', err);
    res.status(500).send('LINE 登入發生錯誤');
  }
});

// 綁定成功頁面
app.get('/line-connected', (req, res) => {
  res.render('line_connected', {
    line: req.session.line
  });
});

// ---------------- Google Maps & 地圖 API ----------------

// 配送地圖頁面（獨立頁面）
app.get('/delivery-map', (req, res) => {
  try {
    res.render('delivery_map', {
      title: '配送地圖 - 誠意鮮蔬',
      googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY || 'demo-key'
    });
  } catch (err) {
    console.error('配送地圖頁面錯誤:', err);
    res.status(500).render('error', { 
      message: '地圖載入失敗',
      error: err
    });
  }
});

// 管理員地圖頁
app.get('/admin/map', ensureAdmin, (req, res) => {
  // 讓前端取得 API 金鑰
  res.render('admin_map', {
    googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY
  });
});

// 管理員WebSocket監控中心
app.get('/admin/websocket-monitor', ensureAdmin, (req, res) => {
  res.render('admin_websocket_monitor');
});


// WebSocket測試頁面 (開發模式限定)
app.get('/websocket-test', (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).send('Not Found');
  }
  res.render('websocket_test');
});

// 返回含座標的訂單清單
app.get('/api/admin/orders-geo', ensureAdmin, async (req, res) => {
  if (demoMode) {
    res.json({ orders: [] });
    return;
  }
  
  try {
    const { rows: orders } = await pool.query('SELECT id, contact_name, contact_phone, address, status, total_amount as total, lat, lng FROM orders WHERE lat IS NOT NULL AND lng IS NOT NULL');
    res.json({ orders });
  } catch (err) {
    console.error(err);
    res.status(500).json({ orders: [] });
  }
});

// 後台：訂單列表
app.get('/admin/orders', ensureAdmin, async (req, res, next) => {
  if (demoMode) {
    const mockOrders = [
      {
        id: 1001,
        contact_name: '示範客戶',
        contact_phone: '0912345678',
        address: '台北市大安區示範路123號',
        total: 280,
        status: 'placed',
        created_at: new Date()
      }
    ];
    return res.render('admin_orders', { orders: mockOrders });
  }
  
  try {
    const { rows: orders } = await pool.query('SELECT * FROM orders ORDER BY id DESC');
    res.render('admin_orders', { orders });
  } catch (err) {
    next(err);
  }
});


// 後台：單一訂單編輯
app.get('/admin/orders/:id', ensureAdmin, async (req, res, next) => {
  const id = parseInt(req.params.id, 10);
  try {
    const { rows: orders } = await pool.query('SELECT * FROM orders WHERE id=$1', [id]);
    if (orders.length === 0) return res.status(404).send('訂單不存在');
    const order = orders[0];
    const { rows: items } = await pool.query('SELECT * FROM order_items WHERE order_id=$1 ORDER BY id', [id]);
    order.items = items;
    res.render('admin_order_edit', { order });
  } catch (err) {
    next(err);
  }
});

// 後台：更新訂單
app.post('/admin/orders/:id', ensureAdmin, async (req, res, next) => {
  const id = parseInt(req.params.id, 10);
  try {
    const ordersData = await pool.query('SELECT * FROM orders WHERE id=$1', [id]);
    if (ordersData.rows.length === 0) return res.status(404).send('訂單不存在');
    const order = ordersData.rows[0];
    // 抓取訂單項目
    const { rows: items } = await pool.query('SELECT * FROM order_items WHERE order_id=$1 ORDER BY id', [id]);
    let lineTotals = req.body.lineTotal;
    let actualWeights = req.body.actualWeight;
    if (!Array.isArray(lineTotals)) lineTotals = [lineTotals];
    if (!Array.isArray(actualWeights)) actualWeights = [actualWeights];
    // 更新每一項目
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      let lineTotal = parseFloat(lineTotals[i]);
      if (isNaN(lineTotal)) lineTotal = 0;
      let actualWeight = parseFloat(actualWeights[i]);
      if (isNaN(actualWeight)) actualWeight = null;
      if (item.is_priced_item) {
        await pool.query(
          'UPDATE order_items SET line_total=$1, actual_weight=$2 WHERE id=$3',
          [lineTotal, actualWeight, item.id]
        );
      } else {
        // 確保固定價維持原金額
        const fixedTotal = Number(item.unit_price) * Number(item.quantity);
        await pool.query(
          'UPDATE order_items SET line_total=$1, actual_weight=NULL WHERE id=$2',
          [fixedTotal, item.id]
        );
      }
    }
    // 重新計算 totals
    const { rows: updatedItems } = await pool.query('SELECT * FROM order_items WHERE order_id=$1', [id]);
    let newSubtotal = 0;
    updatedItems.forEach(it => {
      newSubtotal += Number(it.line_total || 0);
    });
    const newDelivery = newSubtotal >= 200 ? 0 : 50;
    const newTotal = newSubtotal + newDelivery;
    await pool.query('UPDATE orders SET subtotal=$1, delivery_fee=$2, total=$3, status=$4 WHERE id=$5', [newSubtotal, newDelivery, newTotal, 'quoted', id]);
    res.redirect('/admin/orders/' + id);
  } catch (err) {
    next(err);
  }
});

// 後台：產品管理列表
app.get('/admin/products', ensureAdmin, async (req, res, next) => {
  if (demoMode) {
    return res.render('admin_products', { products: demoProducts });
  }
  
  try {
    const { rows: products } = await pool.query('SELECT * FROM products ORDER BY id');
    res.render('admin_products', { products });
  } catch (err) {
    next(err);
  }
});

// 後台：更新某產品
app.post('/admin/products/:id/update', ensureAdmin, async (req, res, next) => {
  const id = parseInt(req.params.id, 10);
  const { price, isPricedItem, unitHint, weightPricePerUnit } = req.body;
  try {
    const priceVal = price === '' || price === null ? null : parseFloat(price);
    const priced = isPricedItem === 'on' || isPricedItem === 'true';
    const weightPriceVal = weightPricePerUnit === '' || weightPricePerUnit === null ? null : parseFloat(weightPricePerUnit);
    
    // 獲取舊價格以供價格變動檢測
    let oldPrice = null;
    let productName = null;
    if (!demoMode) {
      try {
        const oldProductResult = await pool.query('SELECT price, name FROM products WHERE id = $1', [id]);
        if (oldProductResult.rows.length > 0) {
          oldPrice = oldProductResult.rows[0].price;
          productName = oldProductResult.rows[0].name;
        }
      } catch (error) {
        console.error('獲取舊價格失敗:', error);
      }
    }
    
    // 檢查是否需要添加稱重商品欄位
    const result = await pool.query('SELECT column_name FROM information_schema.columns WHERE table_name = $1', ['products']);
    const columns = result.rows.map(row => row.column_name);
    
    if (columns.includes('weight_price_per_unit')) {
      await pool.query(
        'UPDATE products SET price=$1, is_priced_item=$2, unit_hint=$3, weight_price_per_unit=$4 WHERE id=$5',
        [priceVal, priced, unitHint || null, weightPriceVal, id]
      );
    } else {
      // 如果欄位不存在，僅更新原有欄位
      await pool.query(
        'UPDATE products SET price=$1, is_priced_item=$2, unit_hint=$3 WHERE id=$4',
        [priceVal, priced, unitHint || null, id]
      );
    }
    
    // 價格變動檢測和通知
    if (priceChangeNotificationService && oldPrice !== null && priceVal !== null && oldPrice !== priceVal) {
      try {
        console.log(`💰 檢測到價格變動: ${productName} ${oldPrice} → ${priceVal}`);
        
        // 非同步檢測和發送通知，不阻塞頁面回應
        setTimeout(async () => {
          try {
            await priceChangeNotificationService.checkAndNotifyPriceChanges([{
              id: id,
              name: productName,
              oldPrice: parseFloat(oldPrice),
              newPrice: priceVal
            }]);
          } catch (error) {
            console.error('價格變動通知失敗:', error);
          }
        }, 100);
        
      } catch (error) {
        console.error('價格變動檢測失敗:', error);
      }
    }
    
    res.redirect('/admin/products');
  } catch (err) {
    console.log('商品更新錯誤:', err.message);
    next(err);
  }
});

// 後台：新增產品表單
app.get('/admin/products/new', ensureAdmin, (req, res) => {
  res.render('admin_product_new');
});

// 後台：新增產品
app.post('/admin/products/new', ensureAdmin, async (req, res, next) => {
  const { name, price, isPricedItem, unitHint, initialStock, minStockAlert, supplierName, optionGroups, imageData } = req.body;
  
  if (demoMode) {
    console.log('📝 示範模式：模擬新增商品', { name, price });
    return res.redirect('/admin/products');
  }
  
  try {
    if (!name) {
      return res.render('admin_product_new', { error: '品名必填' });
    }
    
    const priceVal = price === '' || price === null ? null : parseFloat(price);
    const priced = isPricedItem === 'on' || isPricedItem === 'true';
    
    // 開始交易
    await pool.query('BEGIN');
    
    try {
      // 處理圖片上傳
      let imageUrl = null;
      if (imageData && imageData.startsWith('data:image/')) {
        // 將base64圖片儲存為靜態檔案
        const base64Data = imageData.replace(/^data:image\/[a-z]+;base64,/, '');
        const imageBuffer = Buffer.from(base64Data, 'base64');
        const fileName = `product_${Date.now()}.jpg`;
        const imagePath = `uploads/products/${fileName}`;
        
        // 確保上傳目錄存在
        const fs = require('fs');
        const path = require('path');
        const uploadDir = path.join(__dirname, '..', 'public', 'uploads', 'products');
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }
        
        // 儲存圖片檔案
        const fullPath = path.join(uploadDir, fileName);
        fs.writeFileSync(fullPath, imageBuffer);
        imageUrl = `/uploads/products/${fileName}`;
        
        console.log(`📷 圖片已儲存: ${imageUrl}`);
      }
      
      // 新增商品
      const productResult = await pool.query(
        'INSERT INTO products (name, price, is_priced_item, unit_hint, image_url, image_uploaded_at) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id',
        [name, priceVal, priced, unitHint || null, imageUrl, imageUrl ? new Date() : null]
      );
      
      const productId = productResult.rows[0].id;
      
      // 自動創建庫存記錄
      const stockVal = parseInt(initialStock) || 0;
      const minAlertVal = parseInt(minStockAlert) || 10;
      const unitCostVal = priceVal ? parseFloat(priceVal) * 0.7 : 0; // 假設成本是售價的70%
      
      await pool.query(
        'INSERT INTO inventory (product_id, current_stock, min_stock_alert, max_stock_capacity, unit_cost, supplier_name) VALUES ($1,$2,$3,$4,$5,$6)',
        [productId, stockVal, minAlertVal, 1000, unitCostVal, supplierName || null]
      );
      
      // 記錄初始庫存
      if (stockVal > 0) {
        await pool.query(
          'INSERT INTO stock_movements (product_id, movement_type, quantity, unit_cost, reason, operator_name) VALUES ($1,$2,$3,$4,$5,$6)',
          [productId, 'in', stockVal, unitCostVal, '新商品初始庫存', '管理員']
        );
      }
      
      // 處理商品選項群組
      if (optionGroups && typeof optionGroups === 'object') {
        for (const groupKey of Object.keys(optionGroups)) {
          const group = optionGroups[groupKey];
          if (group.name) {
            // 建立選項群組
            const groupResult = await pool.query(
              'INSERT INTO product_option_groups (product_id, name, description, is_required, selection_type, sort_order) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id',
              [productId, group.name, group.description || '', true, 'single', parseInt(groupKey)]
            );
            
            const groupId = groupResult.rows[0].id;
            
            // 建立選項
            if (group.options && typeof group.options === 'object') {
              for (const optionKey of Object.keys(group.options)) {
                const option = group.options[optionKey];
                if (option.name) {
                  await pool.query(
                    'INSERT INTO product_options (group_id, name, description, price_modifier, is_default, sort_order) VALUES ($1,$2,$3,$4,$5,$6)',
                    [
                      groupId, 
                      option.name, 
                      option.description || '', 
                      parseFloat(option.priceModifier || 0), 
                      option.isDefault === 'on', 
                      parseInt(optionKey)
                    ]
                  );
                }
              }
            }
          }
        }
      }
      
      // 提交交易
      await pool.query('COMMIT');
      console.log(`✅ 成功新增商品：${name}，初始庫存：${stockVal}`);
      
      res.redirect('/admin/products');
    } catch (error) {
      // 回滾交易
      await pool.query('ROLLBACK');
      throw error;
    }
  } catch (err) {
    console.error('新增商品錯誤:', err);
    res.render('admin_product_new', { 
      error: '新增商品失敗：' + err.message,
      formData: req.body 
    });
  }
});

// 📋 後台：庫存管理頁面
app.get('/admin/inventory', ensureAdmin, async (req, res, next) => {
  try {
    let inventoryData = [];
    
    if (!demoMode && pool) {
      // 從資料庫獲取庫存資料
      const query = `
        SELECT 
          p.id,
          p.name,
          p.price,
          p.unit_hint,
          COALESCE(i.current_stock, 0) as current_stock,
          COALESCE(i.min_stock_alert, 10) as min_stock_alert,
          COALESCE(i.max_stock_capacity, 1000) as max_stock_capacity,
          COALESCE(i.unit_cost, 0) as unit_cost,
          i.supplier_name,
          i.last_updated
        FROM products p
        LEFT JOIN inventory i ON p.id = i.product_id
        ORDER BY p.name
      `;
      const result = await pool.query(query);
      inventoryData = result.rows;
    } else {
      // Demo模式數據
      inventoryData = [
        { id: 1, name: '🥬 有機高麗菜', current_stock: 45, min_stock_alert: 10, unit_cost: 25.00, supplier_name: '新鮮農場' },
        { id: 2, name: '🍅 新鮮番茄', current_stock: 8, min_stock_alert: 15, unit_cost: 18.00, supplier_name: '陽光果園' },
        { id: 3, name: '🥬 青江菜', current_stock: 23, min_stock_alert: 10, unit_cost: 12.00, supplier_name: '綠野農場' }
      ];
    }
    
    res.render('admin_inventory', { 
      inventoryData,
      title: '庫存管理',
      lowStockCount: inventoryData.filter(item => item.current_stock <= item.min_stock_alert).length
    });
  } catch (err) {
    console.error('庫存管理頁面錯誤:', err);
    next(err);
  }
});

// 📋 API：更新庫存
app.post('/api/admin/inventory/update', ensureAdmin, async (req, res) => {
  try {
    const { productId, currentStock, minStockAlert, maxStockCapacity, unitCost, supplierName } = req.body;
    
    if (!demoMode && pool) {
      // 檢查是否已有庫存記錄
      const existingQuery = 'SELECT id FROM inventory WHERE product_id = $1';
      const existingResult = await pool.query(existingQuery, [productId]);
      
      if (existingResult.rows.length > 0) {
        // 更新現有記錄
        await pool.query(`
          UPDATE inventory 
          SET current_stock = $1, min_stock_alert = $2, max_stock_capacity = $3, 
              unit_cost = $4, supplier_name = $5, last_updated = CURRENT_TIMESTAMP
          WHERE product_id = $6
        `, [currentStock, minStockAlert, maxStockCapacity, unitCost, supplierName, productId]);
      } else {
        // 新增庫存記錄
        await pool.query(`
          INSERT INTO inventory (product_id, current_stock, min_stock_alert, max_stock_capacity, unit_cost, supplier_name)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [productId, currentStock, minStockAlert, maxStockCapacity, unitCost, supplierName]);
      }
      
      // 記錄庫存異動
      await pool.query(`
        INSERT INTO stock_movements (product_id, movement_type, quantity, unit_cost, reason, operator_name)
        VALUES ($1, 'adjustment', $2, $3, '庫存調整', '管理員')
      `, [productId, currentStock, unitCost]);
    }
    
    res.json({ success: true, message: '庫存更新成功' });
  } catch (err) {
    console.error('更新庫存錯誤:', err);
    res.status(500).json({ success: false, message: '更新失敗' });
  }
});

// 📋 API：進貨操作
app.post('/api/admin/inventory/restock', ensureAdmin, async (req, res) => {
  try {
    const { productId, quantity, unit, unitCost, supplierName, reason } = req.body;
    
    if (!demoMode && pool) {
      // 更新庫存數量
      await pool.query(`
        UPDATE inventory 
        SET current_stock = current_stock + $1, unit_cost = $2, supplier_name = $3, last_updated = CURRENT_TIMESTAMP
        WHERE product_id = $4
      `, [quantity, unitCost, supplierName, productId]);
      
      // 記錄進貨
      const fullReason = `${reason || '進貨補充'} (${quantity}${unit || '單位'})`;
      await pool.query(`
        INSERT INTO stock_movements (product_id, movement_type, quantity, unit_cost, reason, operator_name)
        VALUES ($1, 'in', $2, $3, $4, '管理員')
      `, [productId, quantity, unitCost, fullReason]);
    }
    
    res.json({ success: true, message: '進貨記錄成功' });
  } catch (err) {
    console.error('進貨操作錯誤:', err);
    res.status(500).json({ success: false, message: '進貨失敗' });
  }
});


// 📈 後台：統計報表頁面
app.get('/admin/reports', ensureAdmin, async (req, res, next) => {
  try {
    // 準備報表數據
    const reportData = {
      revenue: {
        total: 287650,
        growth: 8.3,
        orders: 1247,
        avgOrderValue: 231
      },
      products: [],
      customers: {
        total: 1456,
        returnRate: 68,
        newCustomers: 234
      },
      delivery: {
        avgTime: 42,
        onTimeRate: 94.2,
        cost: 12450
      }
    };
    
    if (!demoMode && pool) {
      try {
        // 從資料庫獲取真實統計數據
        const revenueQuery = await pool.query(`
          SELECT 
            DATE(created_at) as date,
            COUNT(*) as orders,
            SUM(total_amount) as revenue
          FROM orders 
          WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
          GROUP BY DATE(created_at)
          ORDER BY date
        `);
        
        const productQuery = await pool.query(`
          SELECT 
            p.name,
            COUNT(oi.id) as sales_count,
            SUM(oi.line_total) as sales_revenue
          FROM products p
          LEFT JOIN order_items oi ON p.id = oi.product_id
          LEFT JOIN orders o ON oi.order_id = o.id
          WHERE o.created_at >= CURRENT_DATE - INTERVAL '30 days'
          GROUP BY p.id, p.name
          ORDER BY sales_revenue DESC
          LIMIT 10
        `);
        
        reportData.revenueData = revenueQuery.rows;
        reportData.productData = productQuery.rows;
      } catch (dbError) {
        console.warn('⚠️ 無法從資料庫獲取報表數據，使用demo數據:', dbError.message);
      }
    }
    
    res.render('admin_reports', { 
      title: '統計報表分析',
      reportData: reportData
    });
  } catch (err) {
    console.error('❌ 統計報表頁面錯誤:', err);
    next(err);
  }
});

// 🏆 外送員績效統計頁面
app.get('/admin/driver-performance', ensureAdmin, async (req, res, next) => {
  try {
    res.render('admin_driver_performance');
  } catch (err) {
    console.error('❌ 外送員績效頁面錯誤:', err);
    next(err);
  }
});

// 📈 API：獲取報表數據
app.get('/api/admin/reports/:type', ensureAdmin, async (req, res) => {
  try {
    const { type } = req.params;
    const { timeRange = '30', startDate, endDate } = req.query;
    
    let data = {};
    
    if (!demoMode && pool) {
      const days = parseInt(timeRange);
      const whereClause = startDate && endDate 
        ? `created_at BETWEEN '${startDate}' AND '${endDate}'`
        : `created_at >= CURRENT_DATE - INTERVAL '${days} days'`;
      
      switch (type) {
        case 'revenue':
          const revenueResult = await pool.query(`
            SELECT 
              DATE(created_at) as date,
              COUNT(*) as orders,
              SUM(total_amount) as revenue,
              AVG(total_amount) as avg_order_value
            FROM orders 
            WHERE ${whereClause}
            GROUP BY DATE(created_at)
            ORDER BY date
          `);
          data = revenueResult.rows;
          break;
          
        case 'products':
          const productsResult = await pool.query(`
            SELECT 
              p.name,
              COUNT(oi.id) as sales_count,
              SUM(oi.line_total) as sales_revenue,
              AVG(oi.line_total) as avg_price
            FROM products p
            LEFT JOIN order_items oi ON p.id = oi.product_id
            LEFT JOIN orders o ON oi.order_id = o.id
            WHERE o.${whereClause}
            GROUP BY p.id, p.name
            ORDER BY sales_revenue DESC
          `);
          data = productsResult.rows;
          break;
          
        case 'customers':
          const customersResult = await pool.query(`
            SELECT 
              contact_name,
              contact_phone,
              COUNT(*) as order_count,
              SUM(total_amount) as total_spent,
              MAX(created_at) as last_order
            FROM orders 
            WHERE ${whereClause}
            GROUP BY contact_name, contact_phone
            ORDER BY total_spent DESC
          `);
          data = customersResult.rows;
          break;
          
        default:
          // Demo數據
          data = generateDemoData(type, days);
      }
    } else {
      // Demo模式
      data = generateDemoData(type, parseInt(timeRange));
    }
    
    res.json({ success: true, data });
  } catch (err) {
    console.error('報表數據API錯誤:', err);
    res.status(500).json({ success: false, message: '獲取報表數據失敗' });
  }
});

// 生成示範數據
function generateDemoData(type, days) {
  const data = [];
  const today = new Date();
  
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    
    switch (type) {
      case 'revenue':
        data.push({
          date: date.toISOString().split('T')[0],
          orders: Math.floor(Math.random() * 50) + 20,
          revenue: Math.floor(Math.random() * 15000) + 5000,
          avg_order_value: Math.floor(Math.random() * 100) + 180
        });
        break;
        
      case 'products':
        const products = ['🥬 高麗菜', '🍇 葡萄', '🥬 大白菜', '🍅 番茄', '🥕 胡蘿蔔'];
        products.forEach((name, index) => {
          data.push({
            name,
            sales_count: Math.floor(Math.random() * 200) + 100,
            sales_revenue: Math.floor(Math.random() * 20000) + 10000,
            avg_price: Math.floor(Math.random() * 50) + 20
          });
        });
        break;
    }
  }
  
  return data;
}

// 🕰️ 後台：營業時間管理頁面
app.get('/admin/business-hours', ensureAdmin, (req, res) => {
  res.render('admin_business_hours');
});

// 🕰️ 後台：更新營業時間
app.post('/admin/business-hours', ensureAdmin, async (req, res, next) => {
  try {
    const businessHours = req.body;
    console.log('📝 營業時間設定已更新:', businessHours);
    res.json({ success: true, message: '營業時間設定已儲存' });
  } catch (err) {
    console.error('❌ 營業時間更新失敗:', err);
    res.status(500).json({ success: false, message: '儲存失敗' });
  }
});

// 🕰️ API：取得營業時間資料
app.get('/api/business-hours', (req, res) => {
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
});

// 🤖 Agent 系統管理 API
app.get('/api/admin/agents/status', ensureAdmin, (req, res) => {
  try {
    const status = agentSystem ? agentSystem.getSystemStatus() : { status: 'not_initialized' };
    res.json({ success: true, ...status });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/admin/agents/restart/:agentName', ensureAdmin, async (req, res) => {
  try {
    const { agentName } = req.params;
    
    if (!agentSystem) {
      return res.status(400).json({ success: false, message: 'Agent 系統未初始化' });
    }

    await agentSystem.restartAgent(agentName);
    res.json({ success: true, message: `${agentName} 重啟成功` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/admin/agents/health-check', ensureAdmin, async (req, res) => {
  try {
    const healthReport = agentSystem ? await agentSystem.healthCheck() : { systemHealthy: false };
    res.json({ success: true, health: healthReport });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// =====================================
// 🛠️ 資料庫初始化 API
// =====================================

// 臨時初始化API - 僅供首次部署使用（無需管理員權限）
app.post('/api/system/first-time-init', async (req, res) => {
  // 檢查是否已經初始化（如果products表存在且有資料，則認為已初始化）
  try {
    const checkResult = await pool.query('SELECT COUNT(*) FROM products');
    if (parseInt(checkResult.rows[0].count) > 0) {
      return res.status(400).json({
        success: false,
        message: '系統已經初始化，無需重複執行',
        alreadyInitialized: true
      });
    }
  } catch (error) {
    // 如果查詢失敗，可能是表不存在，繼續初始化流程
    console.log('產品表檢查失敗，繼續執行初始化:', error.message);
  }
  
  console.log('🔧 執行首次系統初始化（無需管理員權限）...');
  
  try {
    // 檢查資料庫連接
    const timeResult = await pool.query('SELECT NOW(), version()');
    console.log('✅ 資料庫連接成功');
    console.log(`📅 時間: ${timeResult.rows[0].now}`);
    
    // 讀取並執行SQL檔案
    const sqlFiles = [
      { name: 'schema.sql', desc: '主要資料庫架構' },
      { name: 'realtime_notifications_schema.sql', desc: '即時通訊系統架構' },
      { name: 'smart_route_system_schema.sql', desc: '智能路線系統架構' },
      { name: 'geocoding_cache_schema.sql', desc: '地理編碼快取架構' },
      { name: 'gps_tracking_schema.sql', desc: 'GPS追蹤系統架構' },
      { name: 'intelligent_routing_schema.sql', desc: '智能路線規劃架構' }
    ];
    
    const results = [];
    
    for (const { name, desc } of sqlFiles) {
      try {
        const filePath = path.join(__dirname, '..', name);
        if (require('fs').existsSync(filePath)) {
          const sql = require('fs').readFileSync(filePath, 'utf8');
          
          // 分割SQL語句
          const statements = sql.split(';').filter(stmt => stmt.trim().length > 0);
          
          for (const statement of statements) {
            if (statement.trim()) {
              await pool.query(statement);
            }
          }
          
          results.push({ file: name, status: 'success', description: desc });
          console.log(`✅ ${desc} 完成`);
        } else {
          results.push({ file: name, status: 'not_found', description: desc });
          console.log(`⚠️ ${name} 檔案不存在`);
        }
      } catch (error) {
        console.error(`❌ ${name} 執行失敗:`, error.message);
        if (error.message.includes('already exists')) {
          results.push({ file: name, status: 'already_exists', description: desc });
        } else {
          results.push({ file: name, status: 'error', error: error.message, description: desc });
        }
      }
    }
    
    // 初始化基礎資料
    try {
      await pool.query(`
        INSERT INTO products (name, price, is_priced_item, unit_hint) VALUES
        ('高麗菜', 50.00, false, '顆'),
        ('白蘿蔔', 30.00, false, '條'),
        ('紅蘿蔔', 25.00, false, '條'),
        ('青花菜', 40.00, false, '顆'),
        ('空心菜', 20.00, false, '把'),
        ('菠菜', 25.00, false, '把'),
        ('韭菜', 30.00, false, '把'),
        ('青江菜', 20.00, false, '把'),
        ('大白菜', 35.00, false, '顆'),
        ('小白菜', 15.00, false, '把')
        ON CONFLICT (name) DO NOTHING
      `);
      results.push({ task: 'products_init', status: 'success', description: '基礎商品資料' });
      console.log('✅ 基礎商品資料初始化完成');
    } catch (error) {
      results.push({ task: 'products_init', status: 'error', error: error.message });
    }
    
    try {
      await pool.query(`
        INSERT INTO system_settings (setting_key, setting_value, description) VALUES
        ('store_location', '{"lat": 24.1477, "lng": 120.6736}', '店鋪位置座標'),
        ('max_delivery_radius', '15', '最大配送半徑(公里)'),
        ('average_preparation_time', '20', '平均準備時間(分鐘)'),
        ('delivery_fee', '50', '配送費用(元)')
        ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value
      `);
      results.push({ task: 'settings_init', status: 'success', description: '系統設定' });
      console.log('✅ 系統設定初始化完成');
    } catch (error) {
      results.push({ task: 'settings_init', status: 'error', error: error.message });
    }
    
    // 檢查最終狀態
    const tableResult = await pool.query(`
      SELECT table_name, 
             (SELECT count(*) FROM information_schema.columns 
              WHERE table_name = t.table_name AND table_schema = 'public') as column_count
      FROM information_schema.tables t
      WHERE table_schema = 'public' 
        AND table_name NOT LIKE 'pg_%'
        AND table_name NOT LIKE 'sql_%'
      ORDER BY table_name
    `);
    
    // 統計資料
    let statistics = [];
    try {
      const productCount = await pool.query('SELECT COUNT(*) FROM products');
      statistics.push({ table: 'products', count: parseInt(productCount.rows[0].count) });
      
      const settingCount = await pool.query('SELECT COUNT(*) FROM system_settings');
      statistics.push({ table: 'system_settings', count: parseInt(settingCount.rows[0].count) });
    } catch (error) {
      console.log('ℹ️ 部分統計查詢失敗，可能表尚未建立');
    }
    
    console.log('🎉 首次系統初始化完成！');
    
    res.json({
      success: true,
      message: 'Railway資料庫首次初始化完成',
      results: results,
      tables: tableResult.rows,
      statistics: statistics,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ 首次初始化失敗:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// 專用商品初始化API
app.post('/api/system/init-products', async (req, res) => {
  try {
    console.log('🛒 開始商品資料初始化...');
    
    // 檢查是否已有商品資料
    const existingProducts = await pool.query('SELECT COUNT(*) FROM products');
    const productCount = parseInt(existingProducts.rows[0].count);
    
    if (productCount > 0) {
      return res.json({
        success: true,
        message: `商品資料已存在 (${productCount}個商品)`,
        skipped: true,
        productCount: productCount
      });
    }
    
    // 新增商品資料
    await pool.query(`
      INSERT INTO products (name, price, is_priced_item, unit_hint) VALUES
      ('高麗菜', 50.00, false, '顆'),
      ('白蘿蔔', 30.00, false, '條'),
      ('紅蘿蔔', 25.00, false, '條'),
      ('青花菜', 40.00, false, '顆'),
      ('空心菜', 20.00, false, '把'),
      ('菠菜', 25.00, false, '把'),
      ('韭菜', 30.00, false, '把'),
      ('青江菜', 20.00, false, '把'),
      ('大白菜', 35.00, false, '顆'),
      ('小白菜', 15.00, false, '把')
    `);
    
    // 檢查插入結果
    const newProductCount = await pool.query('SELECT COUNT(*) FROM products');
    const insertedCount = parseInt(newProductCount.rows[0].count);
    
    console.log(`✅ 成功新增 ${insertedCount} 個商品`);
    
    res.json({
      success: true,
      message: `成功初始化 ${insertedCount} 個基礎商品`,
      productCount: insertedCount,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ 商品初始化失敗:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// 重新檢測資料庫連接狀態API
app.post('/api/system/refresh-db-status', async (req, res) => {
  try {
    console.log('🔄 重新檢測資料庫連接狀態...');
    
    // 測試資料庫連接
    await pool.query('SELECT NOW()');
    
    // 檢查是否有商品資料
    const productResult = await pool.query('SELECT COUNT(*) FROM products');
    const productCount = parseInt(productResult.rows[0].count);
    
    // 更新demoMode狀態
    const oldDemoMode = demoMode;
    demoMode = true; // 啟用示範模式 // 強制切換到資料庫模式
    
    console.log(`✅ 資料庫連接正常，商品數量: ${productCount}`);
    console.log(`🔄 Demo模式: ${oldDemoMode} → ${demoMode}`);
    
    res.json({
      success: true,
      message: '資料庫連接狀態已刷新',
      database: {
        connected: true,
        productCount: productCount
      },
      mode: {
        previous: oldDemoMode ? 'demo' : 'database',
        current: demoMode ? 'demo' : 'database'
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ 資料庫檢測失敗:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      currentMode: demoMode ? 'demo' : 'database',
      timestamp: new Date().toISOString()
    });
  }
});

// SQL修復API - 修復資料庫結構問題
app.post('/api/system/fix-database', async (req, res) => {
  try {
    console.log('🔧 開始修復資料庫結構問題...');
    
    const fixes = [];
    
    // 修復1: 添加total_amount欄位到orders表
    try {
      await pool.query('ALTER TABLE orders ADD COLUMN IF NOT EXISTS total_amount NUMERIC;');
      await pool.query('UPDATE orders SET total_amount = total WHERE total_amount IS NULL;');
      fixes.push({ fix: 'orders.total_amount', status: 'success', description: '新增total_amount欄位並複製total值' });
      console.log('✅ 修復orders.total_amount欄位完成');
    } catch (error) {
      fixes.push({ fix: 'orders.total_amount', status: 'error', error: error.message });
      console.error('❌ 修復orders.total_amount失敗:', error.message);
    }
    
    // 修復2: 確保driver_id欄位存在
    try {
      await pool.query('ALTER TABLE orders ADD COLUMN IF NOT EXISTS driver_id INTEGER;');
      fixes.push({ fix: 'orders.driver_id', status: 'success', description: '確保driver_id欄位存在' });
      console.log('✅ 修復orders.driver_id欄位完成');
    } catch (error) {
      fixes.push({ fix: 'orders.driver_id', status: 'error', error: error.message });
    }
    
    // 修復3: 添加system_settings表（如果不存在）
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS system_settings (
          setting_key VARCHAR(100) PRIMARY KEY,
          setting_value TEXT NOT NULL,
          description TEXT,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      fixes.push({ fix: 'system_settings', status: 'success', description: '確保system_settings表存在' });
      console.log('✅ 修復system_settings表完成');
    } catch (error) {
      fixes.push({ fix: 'system_settings', status: 'error', error: error.message });
    }
    
    // 檢查修復結果
    const tableResult = await pool.query(`
      SELECT table_name, 
             (SELECT count(*) FROM information_schema.columns 
              WHERE table_name = t.table_name AND table_schema = 'public') as column_count
      FROM information_schema.tables t
      WHERE table_schema = 'public' 
        AND table_name IN ('orders', 'system_settings')
      ORDER BY table_name
    `);
    
    console.log('🎉 資料庫結構修復完成！');
    
    res.json({
      success: true,
      message: '資料庫結構修復完成',
      fixes: fixes,
      tables: tableResult.rows,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ 資料庫修復失敗:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// 正式的資料庫初始化API（需要管理員權限）
app.post('/api/admin/init-database', ensureAdmin, async (req, res) => {
  console.log('🔧 開始Railway資料庫初始化...');
  
  try {
    // 檢查資料庫連接
    const timeResult = await pool.query('SELECT NOW(), version()');
    console.log('✅ 資料庫連接成功');
    console.log(`📅 時間: ${timeResult.rows[0].now}`);
    
    // 讀取並執行SQL檔案
    const sqlFiles = [
      { name: 'schema.sql', desc: '主要資料庫架構' },
      { name: 'realtime_notifications_schema.sql', desc: '即時通訊系統架構' },
      { name: 'smart_route_system_schema.sql', desc: '智能路線系統架構' },
      { name: 'geocoding_cache_schema.sql', desc: '地理編碼快取架構' },
      { name: 'gps_tracking_schema.sql', desc: 'GPS追蹤系統架構' },
      { name: 'intelligent_routing_schema.sql', desc: '智能路線規劃架構' }
    ];
    
    const results = [];
    
    for (const { name, desc } of sqlFiles) {
      try {
        const filePath = path.join(__dirname, '..', name);
        if (require('fs').existsSync(filePath)) {
          const sql = require('fs').readFileSync(filePath, 'utf8');
          
          // 分割SQL語句
          const statements = sql.split(';').filter(stmt => stmt.trim().length > 0);
          
          for (const statement of statements) {
            if (statement.trim()) {
              await pool.query(statement);
            }
          }
          
          results.push({ file: name, status: 'success', description: desc });
          console.log(`✅ ${desc} 完成`);
        } else {
          results.push({ file: name, status: 'not_found', description: desc });
          console.log(`⚠️ ${name} 檔案不存在`);
        }
      } catch (error) {
        console.error(`❌ ${name} 執行失敗:`, error.message);
        if (error.message.includes('already exists')) {
          results.push({ file: name, status: 'already_exists', description: desc });
        } else {
          results.push({ file: name, status: 'error', error: error.message, description: desc });
        }
      }
    }
    
    // 初始化基礎資料
    try {
      await pool.query(`
        INSERT INTO products (name, price, is_priced_item, unit_hint) VALUES
        ('高麗菜', 50.00, false, '顆'),
        ('白蘿蔔', 30.00, false, '條'),
        ('紅蘿蔔', 25.00, false, '條'),
        ('青花菜', 40.00, false, '顆'),
        ('空心菜', 20.00, false, '把'),
        ('菠菜', 25.00, false, '把'),
        ('韭菜', 30.00, false, '把'),
        ('青江菜', 20.00, false, '把'),
        ('大白菜', 35.00, false, '顆'),
        ('小白菜', 15.00, false, '把')
        ON CONFLICT (name) DO NOTHING
      `);
      results.push({ task: 'products_init', status: 'success', description: '基礎商品資料' });
      console.log('✅ 基礎商品資料初始化完成');
    } catch (error) {
      results.push({ task: 'products_init', status: 'error', error: error.message });
    }
    
    try {
      await pool.query(`
        INSERT INTO system_settings (setting_key, setting_value, description) VALUES
        ('store_location', '{"lat": 24.1477, "lng": 120.6736}', '店鋪位置座標'),
        ('max_delivery_radius', '15', '最大配送半徑(公里)'),
        ('average_preparation_time', '20', '平均準備時間(分鐘)'),
        ('delivery_fee', '50', '配送費用(元)')
        ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value
      `);
      results.push({ task: 'settings_init', status: 'success', description: '系統設定' });
      console.log('✅ 系統設定初始化完成');
    } catch (error) {
      results.push({ task: 'settings_init', status: 'error', error: error.message });
    }
    
    // 檢查最終狀態
    const tableResult = await pool.query(`
      SELECT table_name, 
             (SELECT count(*) FROM information_schema.columns 
              WHERE table_name = t.table_name AND table_schema = 'public') as column_count
      FROM information_schema.tables t
      WHERE table_schema = 'public' 
        AND table_name NOT LIKE 'pg_%'
        AND table_name NOT LIKE 'sql_%'
      ORDER BY table_name
    `);
    
    // 統計資料
    let statistics = [];
    try {
      const productCount = await pool.query('SELECT COUNT(*) FROM products');
      statistics.push({ table: 'products', count: parseInt(productCount.rows[0].count) });
      
      const settingCount = await pool.query('SELECT COUNT(*) FROM system_settings');
      statistics.push({ table: 'system_settings', count: parseInt(settingCount.rows[0].count) });
    } catch (error) {
      console.log('ℹ️ 部分統計查詢失敗，可能表尚未建立');
    }
    
    console.log('🎉 Railway資料庫初始化完成！');
    
    res.json({
      success: true,
      message: 'Railway資料庫初始化完成',
      results: results,
      tables: tableResult.rows,
      statistics: statistics,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ 資料庫初始化失敗:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// =====================================
// 📋 基本設定管理 API
// =====================================

// 預設基本設定
const defaultBasicSettings = {
  // 通知訊息設定
  notification_packaging_complete: '🎉 您好！\n\n📦 您的訂單已完成包裝，即將出貨！\n🔢 訂單編號：#{orderId}\n💰 訂單金額：${totalAmount}\n\n⏰ 預計30分鐘內送達\n📞 如有問題請來電：0912-345-678\n\n🙏 謝謝您選擇誠憶鮮蔬！',
  notification_delivering: '🚚 您好！\n\n🛵 您的訂單正在配送中！\n🔢 訂單編號：#{orderId}\n📍 預計很快送達您的地址\n\n📞 如有問題請來電：0912-345-678\n\n🙏 謝謝您選擇誠憶鮮蔬！',
  notification_delivered: '🎉 您好！\n\n✅ 您的訂單已成功送達！\n🔢 訂單編號：#{orderId}\n💰 訂單金額：${totalAmount}\n\n🌟 感謝您選擇誠憶鮮蔬！\n❤️ 期待您的下次訂購\n\n📞 如有任何問題請來電：0912-345-678',
  
  // 主題色彩設定
  primary_color: '#2d5a3d',
  accent_color: '#7cb342',
  
  // 商店基本資訊
  store_name: '誠憶鮮蔬',
  store_slogan: '新鮮 × 健康 × 便利',
  contact_phone: '0912-345-678',
  contact_address: '台北市信義區信義路五段7號',
  
  // 營業設定
  free_shipping_threshold: 300,
  delivery_fee: 50,
  minimum_order_amount: 100,
  service_hours_start: '08:00',
  service_hours_end: '20:00',
  
  // 功能開關
  line_notification_enabled: true,
  sms_notification_enabled: false,
  auto_accept_orders: false,
  
  // 進階主題設定
  custom_css: '',
  font_family: '系統預設',
  
  // 服務設定
  service_area: '台北市、新北市、桃園市',
  delivery_time_slots: '09:00-12:00\n13:00-17:00\n18:00-21:00',
  
  // 頁面內容
  homepage_banner_text: '新鮮蔬果，送到您家',
  about_us_content: '我們致力於提供最新鮮的蔬果給每一位客戶',
  
  // 移動端設定
  mobile_app_enabled: true,
  pwa_enabled: true,
  
  // 配送區域設定
  delivery_enabled_areas: [],
  delivery_coverage_info: '目前開放台北市、新北市、桃園市部分區域配送服務',
  
  // 網站內容管理
  banner_image_url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAYdTdlixB_n8Zy86hYdXUVXOGl7hsTam3iliOOdgIsoqecsdP7UhM1ozScaYbdZb9f9nSJFTvYzh4wNmW1xO8dtv4cdTg4i5oEzI9zkTMP3d3nK5iH9hWtQpYYAoE2s8EVZloq9FpYJWxupyb4uKlJXHejcUAqs0fzI80q8JTx6wcfpGidZdAmOO94v437EZt4YwQg3J6XKaBaxM2PDov2Tm1ABBVZxWOITZWvk4jeniENA2cbJLThbeBLAcN0qSgyK8aMh7i-P1qV',
  announcement_content: `<p><span class="font-semibold">服務範圍：</span>大台北地區（詳細請見店家資訊）。</p>
<p><span class="font-semibold">外送門檻：</span>消費滿 $200 免運費。</p>
<p><span class="font-semibold">付款方式：</span>線上刷卡、貨到付款。</p>
<p><span class="font-semibold">配送時間：</span>週一至週五 9:00 - 18:00。</p>`,
  store_name: '誠憶鮮蔬',
  store_tagline: '新鮮蔬果，品質保證'
};

// 設定分類結構
const basicSettingsCategories = {
  'notifications': [
    {
      key: 'notification_packaging_complete',
      display_name: '📦 包裝完成通知',
      description: '當商品包裝完成時發送給客戶的訊息。可使用 {orderId} 和 {totalAmount} 作為變數。',
      type: 'textarea',
      value: defaultBasicSettings.notification_packaging_complete
    },
    {
      key: 'notification_delivering',
      display_name: '🚚 配送中通知',
      description: '當訂單開始配送時發送給客戶的訊息。可使用 {orderId} 作為變數。',
      type: 'textarea',
      value: defaultBasicSettings.notification_delivering
    },
    {
      key: 'notification_delivered',
      display_name: '🎉 已送達通知',
      description: '當訂單成功送達時發送給客戶的訊息。可使用 {orderId} 和 {totalAmount} 作為變數。',
      type: 'textarea',
      value: defaultBasicSettings.notification_delivered
    },
    {
      key: 'notification_price_increase',
      display_name: '📈 價格上漲通知',
      description: '當商品價格上漲超過閾值時發送的通知模板。可使用變數: {productName} {oldPrice} {newPrice} {changePercent} {orderId}',
      type: 'textarea',
      value: defaultBasicSettings.notification_price_increase || '⚠️ 價格異動通知\n\n您的訂單 #{orderId} 中的【{productName}】價格有所調整：\n💰 昨日參考價: ${oldPrice}\n💰 今日實際價: ${newPrice}\n📊 變動幅度: {changePercent}\n\n如需調整訂單，請於30分鐘內至訂單管理頁面處理，逾時將視為接受此價格。\n\n感謝您的理解 🙏'
    },
    {
      key: 'notification_price_decrease',
      display_name: '📉 價格下跌通知', 
      description: '當商品價格下跌超過閾值時發送的通知模板。可使用變數: {productName} {oldPrice} {newPrice} {changePercent} {orderId}',
      type: 'textarea',
      value: defaultBasicSettings.notification_price_decrease || '🎉 好消息！價格調降通知\n\n您的訂單 #{orderId} 中的【{productName}】價格已調降：\n💰 昨日參考價: ${oldPrice}\n💰 今日實際價: ${newPrice}\n📊 降幅: {changePercent}\n\n系統已自動為您更新至最新優惠價格！\n\n謝謝您的支持 ❤️'
    }
  ],
  'theme': [
    {
      key: 'primary_color',
      display_name: '主要色彩',
      description: '系統的主要品牌顏色，用於導航欄和主要按鈕',
      type: 'color',
      value: defaultBasicSettings.primary_color
    },
    {
      key: 'accent_color',
      display_name: '強調色彩',
      description: '用於突出顯示和次要按鈕的顏色',
      type: 'color',
      value: defaultBasicSettings.accent_color
    }
  ],
  'store': [
    {
      key: 'store_name',
      display_name: '商店名稱',
      description: '顯示在網站標題和訂單確認訊息中的商店名稱',
      type: 'text',
      value: defaultBasicSettings.store_name
    },
    {
      key: 'store_slogan',
      display_name: '商店標語',
      description: '簡短的品牌標語，顯示在首頁',
      type: 'text',
      value: defaultBasicSettings.store_slogan
    },
    {
      key: 'contact_phone',
      display_name: '聯絡電話',
      description: '客戶服務電話號碼',
      type: 'text',
      value: defaultBasicSettings.contact_phone
    },
    {
      key: 'contact_address',
      display_name: '商店地址',
      description: '商店的實體地址',
      type: 'text',
      value: defaultBasicSettings.contact_address
    }
  ],
  'business': [
    {
      key: 'free_shipping_threshold',
      display_name: '免運費門檻',
      description: '超過此金額免收配送費（新台幣）',
      type: 'number',
      value: defaultBasicSettings.free_shipping_threshold
    },
    {
      key: 'delivery_fee',
      display_name: '配送費用',
      description: '基本配送費用（新台幣）',
      type: 'number',
      value: defaultBasicSettings.delivery_fee
    },
    {
      key: 'minimum_order_amount',
      display_name: '最低訂購金額',
      description: '接受訂單的最低金額（新台幣）',
      type: 'number',
      value: defaultBasicSettings.minimum_order_amount
    },
    {
      key: 'service_area',
      display_name: '服務區域',
      description: '選擇具體服務的區域（到區/鄉鎮級別）',
      type: 'district_selector',
      areas: {
        '新北市': ['三峽區', '樹林區', '鶯歌區', '板橋區', '中和區', '永和區', '新莊區', '泰山區', '林口區', '蘆洲區', '五股區', '八里區', '淡水區', '三重區', '新店區', '汐止區', '土城區', '深坑區', '石碇區', '坪林區', '烏來區', '雙溪區', '貢寮區', '平溪區', '瑞芳區', '金山區', '萬里區', '石門區', '三芝區'],
        '台北市': ['中正區', '大同區', '中山區', '松山區', '大安區', '萬華區', '信義區', '士林區', '北投區', '內湖區', '南港區', '文山區'],
        '桃園市': ['桃園區', '中壢區', '平鎮區', '八德區', '楊梅區', '蘆竹區', '龜山區', '龍潭區', '大溪區', '大園區', '觀音區', '新屋區', '復興區'],
        '台中市': ['中區', '東區', '南區', '西區', '北區', '北屯區', '西屯區', '南屯區', '太平區', '大里區', '霧峰區', '烏日區', '豐原區', '后里區', '石岡區', '東勢區', '和平區', '新社區', '潭子區', '大雅區', '神岡區', '大肚區', '沙鹿區', '龍井區', '梧棲區', '清水區', '大甲區', '外埔區', '大安區'],
        '台南市': ['中西區', '東區', '南區', '北區', '安平區', '安南區', '永康區', '歸仁區', '新化區', '左鎮區', '玉井區', '楠西區', '南化區', '仁德區', '關廟區', '龍崎區', '官田區', '麻豆區', '佳里區', '西港區', '七股區', '將軍區', '學甲區', '北門區', '新營區', '後壁區', '白河區', '東山區', '六甲區', '下營區', '柳營區', '鹽水區', '善化區', '大內區', '山上區', '新市區', '安定區'],
        '高雄市': ['新興區', '前金區', '苓雅區', '鹽埕區', '鼓山區', '旗津區', '前鎮區', '三民區', '楠梓區', '小港區', '左營區', '仁武區', '大社區', '東沙群島', '南沙群島', '岡山區', '路竹區', '阿蓮區', '田寮區', '燕巢區', '橋頭區', '梓官區', '彌陀區', '永安區', '湖內區', '鳳山區', '大寮區', '林園區', '鳥松區', '大樹區', '旗山區', '美濃區', '六龜區', '內門區', '杉林區', '甲仙區', '桃源區', '那瑪夏區', '茂林區', '茄萣區']
      },
      value: [
        { city: '新北市', district: '三峽區' },
        { city: '新北市', district: '樹林區' },
        { city: '新北市', district: '鶯歌區' },
        { city: '桃園市', district: '桃園區' }
      ]
    },
    {
      key: 'weekly_schedule',
      display_name: '每週營業時間',
      description: '設定每週各天的營業時間和休假日',
      type: 'weekly_schedule',
      value: {
        'monday': { open: true, start: '06:00', end: '11:00' },
        'tuesday': { open: true, start: '06:00', end: '11:00' },
        'wednesday': { open: true, start: '06:00', end: '11:00' },
        'thursday': { open: true, start: '06:00', end: '11:00' },
        'friday': { open: true, start: '06:00', end: '11:00' },
        'saturday': { open: true, start: '06:00', end: '11:00' },
        'sunday': { open: true, start: '06:00', end: '11:00' }
      }
    },
    {
      key: 'order_cutoff_time',
      display_name: '當日訂單截止時間',
      description: '超過此時間後無法下當日配送的訂單',
      type: 'time',
      value: '11:00'
    },
    {
      key: 'next_day_order_start',
      display_name: '隔日預訂開放時間',
      description: '從此時間開始可以下隔日配送的訂單',
      type: 'time',
      value: '14:00'
    },
    {
      key: 'price_change_threshold',
      display_name: '價格變動通知閾值 (%)',
      description: '當商品價格變動超過此百分比時，發送通知給已預訂客戶',
      type: 'number',
      min: 0,
      max: 100,
      step: 1,
      value: defaultBasicSettings.price_change_threshold || 15
    },
    {
      key: 'price_notification_timeout',
      display_name: '客戶回應時限 (分鐘)',
      description: '發送價格變動通知後，客戶需在此時間內回應，逾時視為接受',
      type: 'number',
      min: 10,
      max: 120,
      step: 5,
      value: defaultBasicSettings.price_notification_timeout || 30
    }
  ],
  'features': [
    {
      key: 'line_notification_enabled',
      display_name: 'LINE 通知',
      description: '啟用 LINE Bot 推送通知功能',
      type: 'boolean',
      value: defaultBasicSettings.line_notification_enabled
    },
    {
      key: 'sms_notification_enabled',
      display_name: '簡訊通知',
      description: '啟用簡訊備用通知功能',
      type: 'boolean',
      value: defaultBasicSettings.sms_notification_enabled
    },
    {
      key: 'auto_accept_orders',
      display_name: '自動接受訂單',
      description: '新訂單自動標記為已確認',
      type: 'boolean',
      value: defaultBasicSettings.auto_accept_orders
    }
  ],
  'theme_advanced': [
    {
      key: 'custom_css',
      display_name: '自訂CSS樣式',
      description: '額外的CSS樣式代碼，用於自訂外觀',
      type: 'textarea',
      value: ''
    },
    {
      key: 'font_family',
      display_name: '字體系列',
      description: '網站使用的主要字體',
      type: 'select',
      options: ['系統預設', 'Microsoft JhengHei', 'Noto Sans TC', 'PingFang TC'],
      value: '系統預設'
    }
  ],
  'content': [
    {
      key: 'homepage_banner_text',
      display_name: '首頁橫幅文字',
      description: '顯示在首頁頂部的宣傳文字',
      type: 'text',
      value: '新鮮蔬果，送到您家'
    },
    {
      key: 'about_us_content',
      display_name: '關於我們內容',
      description: '關於我們頁面的詳細內容',
      type: 'textarea',
      value: '我們致力於提供最新鮮的蔬果給每一位客戶'
    }
  ],
  'mobile': [
    {
      key: 'mobile_app_enabled',
      display_name: '手機App功能',
      description: '啟用手機應用程式相關功能',
      type: 'boolean',
      value: true
    },
    {
      key: 'pwa_enabled',
      display_name: 'PWA功能',
      description: '啟用漸進式網頁應用功能',
      type: 'boolean',
      value: true
    }
  ],
  'delivery_areas': [
    {
      key: 'delivery_enabled_areas',
      display_name: '開放配送區域',
      description: '選擇開放配送的縣市和區域設定',
      type: 'json',
      value: []
    },
    {
      key: 'delivery_coverage_info',
      display_name: '配送覆蓋說明',
      description: '配送區域的詳細說明文字',
      type: 'textarea',
      value: '目前開放台北市、新北市、桃園市部分區域配送服務'
    }
  ],
  'website_content': [
    {
      key: 'banner_image_url',
      display_name: '🖼️ 頂部橫幅圖片',
      description: '前台頁面頂部的橫幅背景圖片網址。建議尺寸：1200x400px',
      type: 'url',
      value: defaultBasicSettings.banner_image_url || 'https://lh3.googleusercontent.com/aida-public/AB6AXuAYdTdlixB_n8Zy86hYdXUVXOGl7hsTam3iliOOdgIsoqecsdP7UhM1ozScaYbdZb9f9nSJFTvYzh4wNmW1xO8dtv4cdTg4i5oEzI9zkTMP3d3nK5iH9hWtQpYYAoE2s8EVZloq9FpYJWxupyb4uKlJXHejcUAqs0fzI80q8JTx6wcfpGidZdAmOO94v437EZt4YwQg3J6XKaBaxM2PDov2Tm1ABBVZxWOITZWvk4jeniENA2cbJLThbeBLAcN0qSgyK8aMh7i-P1qV'
    },
    {
      key: 'announcement_content',
      display_name: '📢 重要公告內容',
      description: '前台頁面重要公告區塊的內容。支援HTML格式，可包含多項公告內容',
      type: 'textarea',
      rows: 8,
      value: defaultBasicSettings.announcement_content || `<p><span class="font-semibold">服務範圍：</span>大台北地區（詳細請見店家資訊）。</p>
<p><span class="font-semibold">外送門檻：</span>消費滿 $200 免運費。</p>
<p><span class="font-semibold">付款方式：</span>線上刷卡、貨到付款。</p>
<p><span class="font-semibold">配送時間：</span>週一至週五 9:00 - 18:00。</p>`
    },
    {
      key: 'store_name',
      display_name: '🏪 商店名稱',
      description: '顯示在前台頁面的商店名稱',
      type: 'text',
      value: defaultBasicSettings.store_name || '誠憶鮮蔬'
    },
    {
      key: 'store_tagline', 
      display_name: '✨ 商店標語',
      description: '商店的品牌標語或簡介',
      type: 'text',
      value: defaultBasicSettings.store_tagline || '新鮮蔬果，品質保證'
    }
  ]
};

// 獲取基本設定
app.get('/api/admin/basic-settings', ensureAdmin, async (req, res) => {
  try {
    let settings = { ...defaultBasicSettings };
    
    // 嘗試從資料庫載入設定
    if (!demoMode && basicSettingsService) {
      try {
        const dbSettings = await basicSettingsService.getAllSettings();
        settings = BasicSettingsService.mergeWithDefaults(dbSettings, defaultBasicSettings);
        console.log('✅ 後台載入資料庫設定成功');
      } catch (error) {
        console.error('⚠️ 後台載入資料庫設定失敗，使用預設值:', error.message);
        // 繼續使用預設值
      }
    }
    
    // 更新分類中的值
    const categories = JSON.parse(JSON.stringify(basicSettingsCategories));
    Object.keys(categories).forEach(categoryKey => {
      categories[categoryKey].forEach(setting => {
        setting.value = settings[setting.key] || setting.value;
      });
    });

    res.json({
      success: true,
      settings,
      categories,
      mode: demoMode ? '示範模式' : '線上模式',
      source: (!demoMode && basicSettingsService) ? '資料庫' : '預設值'
    });

  } catch (error) {
    console.error('獲取基本設定失敗:', error);
    res.status(500).json({
      success: false,
      message: '獲取設定失敗'
    });
  }
});

// 更新基本設定
app.post('/api/admin/basic-settings/update', ensureAdmin, async (req, res) => {
  try {
    const { settings } = req.body;

    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({
        success: false,
        message: '設定格式錯誤'
      });
    }

    if (demoMode) {
      // 示範模式：僅模擬儲存
      console.log('📝 示範模式：設定已更新（模擬）', Object.keys(settings));
      return res.json({
        success: true,
        message: '設定已儲存（示範模式）'
      });
    }

    // 生產模式：實際儲存到資料庫
    if (basicSettingsService) {
      try {
        const updateResult = await basicSettingsService.updateMultipleSettings(settings);
        console.log(`📝 設定更新完成: 成功 ${updateResult.success}, 失敗 ${updateResult.failed}`);
        
        if (updateResult.failed > 0) {
          console.error('部分設定更新失敗:', updateResult.errors);
          return res.json({
            success: true,
            message: `設定部分儲存成功 (${updateResult.success}/${updateResult.success + updateResult.failed})`,
            warnings: updateResult.errors
          });
        }

        return res.json({
          success: true,
          message: `設定儲存成功 (${updateResult.success} 項)`
        });
      } catch (error) {
        console.error('資料庫設定更新失敗:', error);
        return res.status(500).json({
          success: false,
          message: '資料庫儲存失敗: ' + error.message
        });
      }
    } else {
      console.log('⚠️ 基本設定服務未初始化，設定變更未儲存');
      return res.status(503).json({
        success: false,
        message: '設定服務未可用'
      });
    }

  } catch (error) {
    console.error('更新基本設定失敗:', error);
    res.status(500).json({
      success: false,
      message: '設定儲存失敗'
    });
  }
});

// 重設基本設定
app.post('/api/admin/basic-settings/reset', ensureAdmin, async (req, res) => {
  try {
    const { keys } = req.body;

    if (demoMode) {
      // 示範模式：僅模擬重設
      console.log('🔄 示範模式：設定已重設為預設值（模擬）');
      return res.json({
        success: true,
        message: '設定已重設為預設值（示範模式）'
      });
    }

    // 生產模式：重設資料庫中的設定
    // 這裡可以實作資料庫重設邏輯
    console.log('🔄 設定已重設為預設值');

    res.json({
      success: true,
      message: '設定已重設為預設值'
    });

  } catch (error) {
    console.error('重設基本設定失敗:', error);
    res.status(500).json({
      success: false,
      message: '重設設定失敗'
    });
  }
});

// 配送管理主頁面
app.get('/admin/delivery', ensureAdmin, async (req, res, next) => {
  try {
    res.render('admin_delivery_management', {
      title: '配送管理中心',
      currentPage: 'delivery'
    });
  } catch (error) {
    console.error('載入配送管理頁面失敗:', error);
    next(error);
  }
});

// 配送區域管理路由
app.get('/admin/delivery-areas', ensureAdmin, (req, res) => {
  res.render('admin_delivery_areas');
});

// API: 獲取配送區域設定
app.get('/api/admin/delivery-areas', ensureAdmin, asyncWrapper(async (req, res) => {
  try {
    if (demoMode) {
      // 示範模式：回傳預設開放區域
      const demoAreas = [
        { city: '台北市', district: '中正區', enabled: true },
        { city: '台北市', district: '大安區', enabled: true },
        { city: '台北市', district: '信義區', enabled: true },
        { city: '新北市', district: '板橋區', enabled: true },
        { city: '新北市', district: '新店區', enabled: true }
      ];
      return res.json({ success: true, data: demoAreas });
    }

    const result = await pool.query('SELECT city, district, enabled FROM delivery_areas WHERE enabled = true ORDER BY city, district');
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('獲取配送區域失敗:', error);
    res.status(500).json({ success: false, message: '獲取配送區域失敗' });
  }
}));

// API: 更新配送區域設定
app.post('/api/admin/delivery-areas', ensureAdmin, asyncWrapper(async (req, res) => {
  const { areas } = req.body;
  
  if (!Array.isArray(areas)) {
    return res.status(400).json({ success: false, message: '區域資料格式錯誤' });
  }
  
  try {
    if (demoMode) {
      console.log('📝 示範模式：配送區域設定已更新（模擬）', areas.length, '個區域');
      return res.json({ 
        success: true, 
        message: `配送區域設定已儲存（示範模式）- ${areas.length} 個區域`,
        data: areas 
      });
    }

    // 開始資料庫事務
    await pool.query('BEGIN');
    
    // 清除現有設定
    await pool.query('DELETE FROM delivery_areas');
    
    // 插入新設定
    for (const area of areas) {
      await pool.query(
        'INSERT INTO delivery_areas (city, district, enabled) VALUES ($1, $2, $3)',
        [area.city, area.district, area.enabled]
      );
    }
    
    // 提交事務
    await pool.query('COMMIT');
    
    console.log('📝 配送區域設定已更新:', areas.length, '個區域');
    res.json({ 
      success: true, 
      message: `配送區域設定已儲存 - ${areas.length} 個區域`,
      data: areas 
    });
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('更新配送區域失敗:', error);
    res.status(500).json({ success: false, message: '儲存配送區域失敗' });
  }
}));

// API: 獲取前台可用的配送區域
app.get('/api/delivery-areas', asyncWrapper(async (req, res) => {
  try {
    if (demoMode) {
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

    const result = await pool.query('SELECT city, district FROM delivery_areas WHERE enabled = true ORDER BY city, district');
    
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
}));

// 基本設定頁面路由
app.get('/admin/basic-settings', ensureAdmin, (req, res) => {
  res.render('admin_basic_settings');
});

// 🤖 使用 Agent 系統的 API 端點
app.post('/api/orders-agent', orderLimiter, sanitizeInput, validateOrderData, asyncWrapper(async (req, res) => {
  const { name, phone, address, notes, invoice, items } = req.body;
  
  try {
    if (!agentSystem) {
      // 降級到原有邏輯
      return res.status(503).json({ 
        success: false, 
        message: 'Agent 系統未啟動，請稍後再試' 
      });
    }

    // 使用 OrderAgent 建立訂單
    const result = await agentSystem.executeTask('OrderAgent', 'create_order', {
      name, phone, address, notes, invoice, items
    });

    res.json({ 
      success: true, 
      ...result,
      message: '訂單已透過 Agent 系統建立'
    });
    
  } catch (error) {
    console.error('Agent 系統建立訂單錯誤:', error);
    res.status(500).json({ 
      success: false, 
      message: '建立訂單時發生錯誤：' + error.message 
    });
  }
}));

app.get('/api/inventory-agent/stock/:productId?', asyncWrapper(async (req, res) => {
  try {
    if (!agentSystem) {
      return res.status(503).json({ 
        success: false, 
        message: 'Agent 系統未啟動' 
      });
    }

    const { productId } = req.params;
    
    const result = await agentSystem.executeTask('InventoryAgent', 'check_stock', {
      productId: productId ? parseInt(productId) : undefined
    });

    res.json({ success: true, data: result });
    
  } catch (error) {
    console.error('Agent 庫存查詢錯誤:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
}));

app.get('/api/inventory-agent/low-stock', asyncWrapper(async (req, res) => {
  try {
    if (!agentSystem) {
      return res.status(503).json({ 
        success: false, 
        message: 'Agent 系統未啟動' 
      });
    }

    const result = await agentSystem.executeTask('InventoryAgent', 'get_low_stock_items', {});

    res.json({ success: true, data: result });
    
  } catch (error) {
    console.error('Agent 低庫存查詢錯誤:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
}));

app.post('/api/inventory-agent/restock', ensureAdmin, asyncWrapper(async (req, res) => {
  try {
    if (!agentSystem) {
      return res.status(503).json({ 
        success: false, 
        message: 'Agent 系統未啟動' 
      });
    }

    const { productId, quantity, unitCost, supplierName, reason } = req.body;
    
    const result = await agentSystem.executeTask('InventoryAgent', 'restock_item', {
      productId: parseInt(productId),
      quantity: parseInt(quantity),
      unitCost: parseFloat(unitCost),
      supplierName,
      reason
    });

    res.json({ success: true, data: result });
    
  } catch (error) {
    console.error('Agent 進貨錯誤:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
}));

// 🚀 API：部署資料庫更新（執行商品新增和選項建立）
app.post('/api/admin/deploy-updates', ensureAdmin, async (req, res) => {
  // 如果在示範模式，先嘗試重新連接資料庫
  if (demoMode) {
    console.log('🔄 示範模式檢測到，嘗試重新連接資料庫...');
    try {
      await createDatabasePool();
      if (demoMode) {
        return res.json({ 
          success: false, 
          message: '資料庫連線失敗，無法執行更新。請檢查網路連線和資料庫設定。',
          demo: true,
          suggestion: '請稍後再試，或聯繫管理員檢查 Supabase 資料庫狀態。'
        });
      }
    } catch (error) {
      return res.json({ 
        success: false, 
        message: '資料庫重新連線失敗: ' + error.message,
        demo: true 
      });
    }
  }

  try {
    console.log('🚀 開始執行資料庫部署更新...');
    
    // 建立商品選項相關資料表
    console.log('📋 建立商品選項相關資料表...');
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS product_option_groups (
        id SERIAL PRIMARY KEY,
        product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        is_required BOOLEAN DEFAULT true,
        selection_type VARCHAR(20) DEFAULT 'single',
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS product_options (
        id SERIAL PRIMARY KEY,
        group_id INTEGER NOT NULL REFERENCES product_option_groups(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        price_modifier NUMERIC(10,2) DEFAULT 0,
        is_default BOOLEAN DEFAULT false,
        sort_order INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS order_item_options (
        id SERIAL PRIMARY KEY,
        order_item_id INTEGER NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
        option_group_id INTEGER NOT NULL REFERENCES product_option_groups(id),
        option_id INTEGER NOT NULL REFERENCES product_options(id),
        option_name VARCHAR(100) NOT NULL,
        price_modifier NUMERIC(10,2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('✅ 商品選項資料表建立完成');

    // 檢查並新增商品
    console.log('🥬 檢查並新增商品...');
    
    const existingProducts = await pool.query(`
      SELECT name FROM products 
      WHERE name IN ('🥬 空心菜', '🥬 高麗菜', '🌽 水果玉米')
    `);
    
    const existingNames = existingProducts.rows.map(p => p.name);
    const results = { created: [], existing: [] };

    // 1. 新增空心菜
    if (!existingNames.includes('🥬 空心菜')) {
      const spinachResult = await pool.query(
        'INSERT INTO products (name, price, is_priced_item, unit_hint) VALUES ($1, $2, $3, $4) RETURNING id',
        ['🥬 空心菜', 50, false, '每把']
      );
      const spinachId = spinachResult.rows[0].id;
      
      await pool.query(
        'INSERT INTO inventory (product_id, current_stock, min_stock_alert, max_stock_capacity, unit_cost, supplier_name) VALUES ($1, $2, $3, $4, $5, $6)',
        [spinachId, 30, 5, 100, 35.0, '新鮮農場']
      );
      
      await pool.query(
        'INSERT INTO stock_movements (product_id, movement_type, quantity, unit_cost, reason, operator_name) VALUES ($1, $2, $3, $4, $5, $6)',
        [spinachId, 'in', 30, 35.0, '新商品初始庫存', '管理員']
      );
      
      results.created.push('🥬 空心菜');
      console.log('✅ 空心菜新增完成');
    } else {
      results.existing.push('🥬 空心菜');
    }

    // 2. 新增高麗菜  
    if (!existingNames.includes('🥬 高麗菜')) {
      const cabbageResult = await pool.query(
        'INSERT INTO products (name, price, is_priced_item, unit_hint) VALUES ($1, $2, $3, $4) RETURNING id',
        ['🥬 高麗菜', 45, true, '每斤']
      );
      const cabbageId = cabbageResult.rows[0].id;
      
      await pool.query(
        'INSERT INTO inventory (product_id, current_stock, min_stock_alert, max_stock_capacity, unit_cost, supplier_name) VALUES ($1, $2, $3, $4, $5, $6)',
        [cabbageId, 20, 3, 50, 31.5, '有機農場']
      );
      
      await pool.query(
        'INSERT INTO stock_movements (product_id, movement_type, quantity, unit_cost, reason, operator_name) VALUES ($1, $2, $3, $4, $5, $6)',
        [cabbageId, 'in', 20, 31.5, '新商品初始庫存', '管理員']
      );
      
      results.created.push('🥬 高麗菜');
      console.log('✅ 高麗菜新增完成');
    } else {
      results.existing.push('🥬 高麗菜');
    }

    // 3. 新增水果玉米
    let cornId;
    if (!existingNames.includes('🌽 水果玉米')) {
      const cornResult = await pool.query(
        'INSERT INTO products (name, price, is_priced_item, unit_hint) VALUES ($1, $2, $3, $4) RETURNING id',
        ['🌽 水果玉米', 80, false, '每條']
      );
      cornId = cornResult.rows[0].id;
      
      await pool.query(
        'INSERT INTO inventory (product_id, current_stock, min_stock_alert, max_stock_capacity, unit_cost, supplier_name) VALUES ($1, $2, $3, $4, $5, $6)',
        [cornId, 25, 5, 100, 56.0, '玉米專業農場']
      );
      
      await pool.query(
        'INSERT INTO stock_movements (product_id, movement_type, quantity, unit_cost, reason, operator_name) VALUES ($1, $2, $3, $4, $5, $6)',
        [cornId, 'in', 25, 56.0, '新商品初始庫存', '管理員']
      );
      
      results.created.push('🌽 水果玉米');
      console.log('✅ 水果玉米新增完成');
    } else {
      results.existing.push('🌽 水果玉米');
      const cornResult = await pool.query('SELECT id FROM products WHERE name = $1', ['🌽 水果玉米']);
      cornId = cornResult.rows[0].id;
    }

    // 為水果玉米建立選項
    console.log('🌽 為水果玉米建立選項...');
    
    let existingGroups = { rows: [] };
    try {
      existingGroups = await pool.query(
        'SELECT id, name FROM product_option_groups WHERE product_id = $1',
        [cornId]
      );
    } catch (error) {
      console.log('⚠️ product_option_groups 表不存在，跳過玉米選項查詢');
      existingGroups = { rows: [] };
    }

    if (existingGroups.rows.length === 0) {
      // 建立撥皮選項群組
      const peelGroupResult = await pool.query(`
        INSERT INTO product_option_groups (product_id, name, description, is_required, selection_type, sort_order)
        VALUES ($1, $2, $3, $4, $5, $6) RETURNING id
      `, [cornId, '撥皮服務', '是否需要代為撥玉米皮', true, 'single', 1]);
      
      const peelGroupId = peelGroupResult.rows[0].id;

      // 建立撥皮選項
      await pool.query(`
        INSERT INTO product_options (group_id, name, description, price_modifier, is_default, sort_order)
        VALUES 
        ($1, '要撥皮', '代為撥除玉米外皮', 5, false, 1),
        ($1, '不撥皮', '保持原狀不處理', 0, true, 2)
      `, [peelGroupId]);

      // 建立切片選項群組
      const sliceGroupResult = await pool.query(`
        INSERT INTO product_option_groups (product_id, name, description, is_required, selection_type, sort_order)
        VALUES ($1, $2, $3, $4, $5, $6) RETURNING id
      `, [cornId, '切片服務', '是否需要切成片狀', true, 'single', 2]);
      
      const sliceGroupId = sliceGroupResult.rows[0].id;

      // 建立切片選項
      await pool.query(`
        INSERT INTO product_options (group_id, name, description, price_modifier, is_default, sort_order)
        VALUES 
        ($1, '要切片', '切成適合食用的片狀', 3, false, 1),
        ($1, '不切片', '保持整條狀態', 0, true, 2)
      `, [sliceGroupId]);

      console.log('✅ 水果玉米選項已建立');
    } else {
      console.log('⏭️ 水果玉米選項已存在，跳過');
    }

    // 驗證結果
    let finalResult = { rows: [] };
    try {
      finalResult = await pool.query(`
        SELECT 
          p.id,
          p.name,
          p.price,
          p.is_priced_item,
          p.unit_hint,
          i.current_stock,
          i.supplier_name,
          COUNT(pog.id) as option_groups_count
        FROM products p
        LEFT JOIN inventory i ON p.id = i.product_id
        LEFT JOIN product_option_groups pog ON p.id = pog.product_id
        WHERE p.name IN ('🥬 空心菜', '🥬 高麗菜', '🌽 水果玉米')
        GROUP BY p.id, p.name, p.price, p.is_priced_item, p.unit_hint, i.current_stock, i.supplier_name
        ORDER BY p.id DESC
      `);
    } catch (error) {
      console.log('⚠️ product_option_groups 表不存在，使用簡化查詢');
      finalResult = await pool.query(`
        SELECT 
          p.id,
          p.name,
          p.price,
          p.is_priced_item,
          p.unit_hint,
          i.current_stock,
          i.supplier_name,
          0 as option_groups_count
        FROM products p
        LEFT JOIN inventory i ON p.id = i.product_id
        WHERE p.name IN ('🥬 空心菜', '🥬 高麗菜', '🌽 水果玉米')
        ORDER BY p.id DESC
      `);
    }

    console.log('🎉 部署完成！');
    
    res.json({
      success: true,
      message: '部署更新完成',
      results: {
        created: results.created,
        existing: results.existing,
        products: finalResult.rows
      }
    });

  } catch (error) {
    console.error('❌ 部署失敗:', error);
    res.status(500).json({
      success: false,
      message: '部署失敗: ' + error.message
    });
  }
});

// 🔧 API：手動重新連接資料庫
app.post('/api/admin/reconnect-database', ensureAdmin, async (req, res) => {

// 註冊即時通知API路由
if (sseNotificationService && orderNotificationService && driverLocationService) {
  // app.use('/api/notifications', initializeRealtimeRoutes(
  //   sseNotificationService,
  //   orderNotificationService,
  //   driverLocationService
  // ));
  // console.log('🔗 即時通知API路由已註冊');
}

// 訂單追蹤頁面路由
app.get('/order-tracking/:id', async (req, res, next) => {
  try {
    const orderId = parseInt(req.params.id);
    
    if (isNaN(orderId)) {
      return res.status(400).render('error', { 
        message: '無效的訂單ID' 
      });
    }
    
    // 獲取訂單詳情
    const orderResult = await pool.query(`
      SELECT o.*, d.name as driver_name, d.phone as driver_phone,
             d.current_lat as driver_lat, d.current_lng as driver_lng
      FROM orders o
      LEFT JOIN drivers d ON o.driver_id = d.id
      WHERE o.id = $1
    `, [orderId]);
    
    if (orderResult.rows.length === 0) {
      return res.status(404).render('error', { 
        message: '找不到指定的訂單' 
      });
    }
    
    const order = orderResult.rows[0];
    
    // 獲取訂單狀態歷史
    let statusHistory = [];
    if (orderNotificationService) {
      try {
        statusHistory = await orderNotificationService.getOrderStatusHistory(orderId);
      } catch (error) {
        console.error('獲取訂單狀態歷史失敗:', error);
      }
    }
    
    res.render('order_tracking', {
      order,
      statusHistory,
      title: `訂單追蹤 #${orderId}`
    });
    
  } catch (error) {
    console.error('訂單追蹤頁面錯誤:', error);
    next(error);
  }
});

// 📱 即時訂單追蹤頁面
app.get('/track-order/:id', async (req, res, next) => {
  try {
    const orderId = parseInt(req.params.id);
    const { phone } = req.query;
    
    let order = null;
    
    if (demoMode) {
      order = {
        id: orderId,
        contact_name: '測試客戶',
        contact_phone: phone || '0912345678',
        address: '新北市三峽區大學路1號',
        total: 350,
        status: 'delivering',
        created_at: new Date(),
        lat: 24.9347,
        lng: 121.3681
      };
    } else if (pool) {
      const result = await pool.query(`
        SELECT o.*, c.name as customer_name, c.phone as customer_phone
        FROM orders o 
        LEFT JOIN customers c ON o.customer_id = c.id 
        WHERE o.id = $1 AND ($2 IS NULL OR o.contact_phone = $2)
      `, [orderId, phone]);
      
      if (result.rows.length === 0) {
        return res.status(404).render('error', { 
          message: '訂單不存在或無權限查看',
          title: '訂單追蹤'
        });
      }
      
      order = result.rows[0];
    }
    
    if (!order) {
      return res.status(404).render('error', { 
        message: '訂單不存在',
        title: '訂單追蹤'
      });
    }
    
    res.render('order_tracking_realtime', {
      title: `訂單 #${orderId} 即時追蹤`,
      order: order
    });
  } catch (error) {
    console.error('❌ 即時訂單追蹤頁面錯誤:', error);
    next(error);
  }
});

// 獲取訂單狀態API (供前端使用)
app.get('/api/orders/:id/status', async (req, res) => {
  try {
    const orderId = parseInt(req.params.id);
    
    const result = await pool.query(`
      SELECT o.*, d.name as driver_name, d.phone as driver_phone,
             d.current_lat as driver_lat, d.current_lng as driver_lng
      FROM orders o
      LEFT JOIN drivers d ON o.driver_id = d.id
      WHERE o.id = $1
    `, [orderId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: '訂單不存在' });
    }
    
    const order = result.rows[0];
    
    res.json({
      id: order.id,
      status: order.status,
      estimated_delivery_time: order.estimated_delivery_time,
      driver: order.driver_name ? {
        id: order.driver_id,
        name: order.driver_name,
        phone: order.driver_phone,
        location: order.driver_lat && order.driver_lng ? {
          lat: parseFloat(order.driver_lat),
          lng: parseFloat(order.driver_lng)
        } : null
      } : null
    });
    
  } catch (error) {
    console.error('獲取訂單狀態失敗:', error);
    res.status(500).json({ error: '服務器錯誤' });
  }
});

// 通過手機號碼查詢訂單API (供前台訂單查詢彈窗使用)
app.get('/api/orders/search/:phone', async (req, res) => {
  try {
    const phone = req.params.phone;
    
    // 驗證手機號碼格式
    const phoneRegex = /^09\d{8}$/;
    if (!phoneRegex.test(phone)) {
      return res.status(400).json({ 
        success: false, 
        message: '請輸入正確的手機號碼格式 (09XXXXXXXX)' 
      });
    }
    
    if (demoMode) {
      // 示範模式：返回模擬訂單資料
      const mockOrders = [
        {
          id: 1001,
          contact_name: '示範客戶',
          contact_phone: phone,
          address: '台北市大安區示範路123號',
          status: 'delivering',
          total_amount: 350,
          created_at: new Date(Date.now() - 3600000).toISOString(), // 1小時前
          notes: '請小心包裝'
        },
        {
          id: 1002,
          contact_name: '示範客戶',
          contact_phone: phone,
          address: '台北市大安區示範路123號',
          status: 'delivered',
          total_amount: 280,
          created_at: new Date(Date.now() - 86400000).toISOString(), // 1天前
          notes: ''
        }
      ];
      
      console.log(`📝 示範模式：返回手機號碼 ${phone} 的模擬訂單`);
      return res.json({
        success: true,
        orders: mockOrders,
        total: mockOrders.length
      });
    }
    
    // 生產模式：查詢真實資料
    const result = await pool.query(`
      SELECT 
        id, contact_name, contact_phone, address, 
        status, total_amount, created_at, notes,
        subtotal, delivery_fee, payment_method
      FROM orders 
      WHERE contact_phone = $1 
      ORDER BY created_at DESC 
      LIMIT 10
    `, [phone]);
    
    res.json({
      success: true,
      orders: result.rows,
      total: result.rows.length
    });
    
  } catch (error) {
    console.error('查詢訂單失敗:', error);
    res.status(500).json({ 
      success: false, 
      message: '查詢訂單時發生錯誤，請稍後再試' 
    });
  }
});

// 獲取特定訂單詳情API (供前台訂單查詢彈窗使用)
app.get('/api/orders/:id/details/:phone', async (req, res) => {
  try {
    const orderId = parseInt(req.params.id);
    const phone = req.params.phone;
    
    if (isNaN(orderId)) {
      return res.status(400).json({ 
        success: false, 
        message: '無效的訂單ID' 
      });
    }
    
    // 驗證手機號碼格式
    const phoneRegex = /^09\d{8}$/;
    if (!phoneRegex.test(phone)) {
      return res.status(400).json({ 
        success: false, 
        message: '請輸入正確的手機號碼格式' 
      });
    }
    
    if (demoMode) {
      // 示範模式：返回模擬訂單詳情
      const mockOrder = {
        id: orderId,
        contact_name: '示範客戶',
        contact_phone: phone,
        address: '台北市大安區示範路123號',
        status: 'delivering',
        total_amount: 350,
        subtotal: 320,
        delivery_fee: 30,
        payment_method: 'cash',
        created_at: new Date(Date.now() - 3600000).toISOString(),
        updated_at: new Date(Date.now() - 1800000).toISOString(),
        notes: '請小心包裝',
        items: [
          {
            id: 1,
            product_id: 101,
            product_name: '有機高麗菜',
            quantity: 2,
            unit_price: 60,
            total_price: 120
          },
          {
            id: 2,
            product_id: 102,
            product_name: '新鮮紅蘿蔔',
            quantity: 1,
            unit_price: 40,
            total_price: 40
          },
          {
            id: 3,
            product_id: 103,
            product_name: '青江菜',
            quantity: 3,
            unit_price: 25,
            total_price: 75
          }
        ]
      };
      
      console.log(`📝 示範模式：返回訂單 ${orderId} 的詳細資料`);
      return res.json({
        success: true,
        order: mockOrder
      });
    }
    
    // 生產模式：查詢真實資料（需要驗證手機號碼權限）
    const orderResult = await pool.query(`
      SELECT 
        o.*, 
        d.name as driver_name, 
        d.phone as driver_phone
      FROM orders o
      LEFT JOIN drivers d ON o.driver_id = d.id
      WHERE o.id = $1 AND o.contact_phone = $2
    `, [orderId, phone]);
    
    if (orderResult.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: '訂單不存在或無權限查看' 
      });
    }
    
    const order = orderResult.rows[0];
    
    // 查詢訂單項目
    const itemsResult = await pool.query(`
      SELECT 
        oi.id,
        oi.product_id,
        oi.quantity,
        oi.unit_price,
        oi.total_price,
        COALESCE(p.name, oi.product_name) as product_name
      FROM order_items oi
      LEFT JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = $1
      ORDER BY oi.id
    `, [orderId]);
    
    res.json({
      success: true,
      order: {
        ...order,
        items: itemsResult.rows,
        driver: order.driver_name ? {
          name: order.driver_name,
          phone: order.driver_phone
        } : null
      }
    });
    
  } catch (error) {
    console.error('獲取訂單詳情失敗:', error);
    res.status(500).json({ 
      success: false, 
      message: '獲取訂單詳情時發生錯誤，請稍後再試' 
    });
  }
});

  try {
    console.log('🔄 管理員請求重新連接資料庫...');
    
    // 關閉現有連線
    if (pool && typeof pool.end === 'function') {
      await pool.end();
    }
    
    // 重新建立連線
    await createDatabasePool();
    
    if (demoMode) {
      res.json({
        success: false,
        message: '資料庫連線失敗，仍在示範模式',
        demoMode: true
      });
    } else {
      // 測試連線
      const testResult = await pool.query('SELECT NOW() as current_time, version() as db_version');
      res.json({
        success: true,
        message: '資料庫重新連線成功',
        demoMode: false,
        connectionTime: testResult.rows[0].current_time,
        databaseVersion: testResult.rows[0].db_version.substring(0, 50) + '...'
      });
    }
    
  } catch (error) {
    console.error('❌ 重新連線失敗:', error);
    res.status(500).json({
      success: false,
      message: '重新連線失敗: ' + error.message,
      demoMode: demoMode
    });
  }
});

// LINE API 路由（必須在 404 處理器之前）
// LINE 環境變數診斷端點
app.get('/api/line/debug', (req, res) => {
  res.status(200).json({
    timestamp: new Date().toISOString(),
    environment: {
      NODE_ENV: process.env.NODE_ENV,
      VERCEL: process.env.VERCEL,
      LINE_CHANNEL_ID: process.env.LINE_CHANNEL_ID ? 'SET (' + process.env.LINE_CHANNEL_ID + ')' : 'MISSING',
      LINE_CHANNEL_SECRET: process.env.LINE_CHANNEL_SECRET ? 'SET (length: ' + process.env.LINE_CHANNEL_SECRET.length + ')' : 'MISSING',
      LINE_CHANNEL_ACCESS_TOKEN: process.env.LINE_CHANNEL_ACCESS_TOKEN ? 'SET (length: ' + process.env.LINE_CHANNEL_ACCESS_TOKEN.length + ')' : 'MISSING',
      LINE_LIFF_ID: process.env.LINE_LIFF_ID ? 'SET (' + process.env.LINE_LIFF_ID + ')' : 'MISSING'
    },
    lineBotService: lineBotService ? {
      initialized: true,
      demoMode: lineBotService.demoMode,
      hasClient: !!lineBotService.client
    } : 'NOT_INITIALIZED',
    liffDebug: {
      liffId: process.env.LINE_LIFF_ID || 'NOT_SET',
      liffIdLength: process.env.LINE_LIFF_ID ? process.env.LINE_LIFF_ID.length : 0,
      allEnvVars: Object.keys(process.env).filter(key => key.includes('LINE')).reduce((obj, key) => {
        obj[key] = process.env[key] ? 'SET (' + process.env[key].length + ' chars)' : 'NOT_SET';
        return obj;
      }, {})
    }
  });
});

// LINE Webhook 接收器 - 超級簡化版本
app.post('/api/line/webhook', (req, res) => {
  console.log('🚨 LINE Webhook 進入處理器');
  console.log('🚨 請求方法:', req.method);
  console.log('🚨 請求路徑:', req.path);
  console.log('🚨 請求 URL:', req.url);
  console.log('🚨 請求 IP:', req.ip);
  console.log('🚨 User-Agent:', req.get('user-agent'));
  console.log('🚨 Content-Type:', req.get('content-type'));
  console.log('🚨 X-Line-Signature:', req.get('x-line-signature'));
  
  try {
    console.log('🚨 準備返回 200 響應');
    
    // 設定響應標頭
    res.set({
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache'
    });
    
    console.log('🚨 響應標頭已設定');
    
    const response = {
      status: 'SUCCESS',
      code: 200,
      message: 'LINE Webhook received and processed',
      timestamp: new Date().toISOString(),
      server: 'Vercel',
      path: req.path,
      method: req.method
    };
    
    console.log('🚨 準備發送響應:', JSON.stringify(response));
    
    res.status(200).json(response);
    
    console.log('🚨 響應已發送 - 狀態碼 200');
    
  } catch (error) {
    console.error('🚨 Webhook 處理錯誤:', error);
    console.error('🚨 錯誤堆疊:', error.stack);
    
    res.status(200).json({
      status: 'ERROR_BUT_OK',
      code: 200,
      message: 'Error occurred but returning 200',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// 健康檢查端點 (必須在 404 處理器之前)
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'vegdelivery-system'
  });
});

// API錯誤處理 (先處理API錯誤)
app.use('/api/*', apiErrorHandler);

// 頁面錯誤處理
app.use(pageErrorHandler);

// 404處理 (移動到最後，在所有路由之後)

// 優雅關閉處理
const gracefulShutdown = async (signal) => {
  console.log(`\n📴 收到 ${signal} 信號，正在優雅關閉...`);
  
  try {
    // 關閉 WebSocket 管理器（已簡化）
    // if (webSocketManager) {
    //   console.log('🔌 正在關閉 WebSocket 服務...');
    //   webSocketManager.close();
    // }
    
    // 關閉 Agent 系統
    if (agentSystem) {
      console.log('🤖 正在關閉 Agent 系統...');
      await agentSystem.shutdown();
    }
    
    // 關閉資料庫連線
    if (pool && typeof pool.end === 'function') {
      console.log('🔌 正在關閉資料庫連線...');
      await pool.end();
    }
    
    console.log('✅ 系統已優雅關閉');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ 關閉過程中發生錯誤:', error);
    process.exit(1);
  }
};

// =====================================
// 測試數據API路由
// =====================================

// 測試數據控制面板
app.get('/test-dashboard', (req, res) => {
  res.render('test_data_dashboard');
});

// 前端載入測試頁面
app.get('/test-frontend-loading', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'test_frontend_loading.html'));
});

// 獲取測試數據統計
app.get('/api/test/stats', async (req, res) => {
  try {
    // 總訂單數
    const totalOrdersResult = await pool.query('SELECT COUNT(*) as count FROM orders');
    const totalOrders = parseInt(totalOrdersResult.rows[0].count);
    
    // 今日新增訂單
    const todayOrdersResult = await pool.query(`
      SELECT COUNT(*) as count FROM orders 
      WHERE DATE(created_at) = CURRENT_DATE
    `);
    const todayOrders = parseInt(todayOrdersResult.rows[0].count);
    
    // 平均訂單金額
    const avgOrderResult = await pool.query(`
      SELECT AVG(total_amount) as avg FROM orders 
      WHERE total_amount > 0
    `);
    const avgOrderValue = Math.round(parseFloat(avgOrderResult.rows[0].avg) || 0);
    
    // 不重複客戶數
    const customersResult = await pool.query(`
      SELECT COUNT(DISTINCT contact_phone) as count FROM orders
    `);
    const totalCustomers = parseInt(customersResult.rows[0].count);
    
    // 已完成訂單
    const completedResult = await pool.query(`
      SELECT COUNT(*) as count FROM orders 
      WHERE status IN ('completed', 'delivered')
    `);
    const completedOrders = parseInt(completedResult.rows[0].count);
    
    // 進行中訂單
    const activeResult = await pool.query(`
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
});

// 獲取最新訂單列表
app.get('/api/test/recent-orders', async (req, res) => {
  try {
    const result = await pool.query(`
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
});

// 建立更多測試訂單
app.post('/api/test/create-orders', async (req, res) => {
  try {
    const { count = 5 } = req.body;
    const { createTestOrders } = require('../create_test_orders.js');
    
    const client = await pool.connect();
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
});

// =====================================
// LINE Bot 整合路由
// =====================================

// 初始化LINE Bot服務
try {
  lineBotService = new LineBotService();
  console.log('🤖 LINE Bot服務已初始化');
} catch (error) {
  console.error('❌ LINE Bot服務初始化失敗:', error);
}

// 初始化LINE用戶服務
try {
  lineUserService = new LineUserService(pool);
  console.log('👤 LINE用戶服務已初始化');
} catch (error) {
  console.error('❌ LINE用戶服務初始化失敗:', error);
}

const OrderNotificationHook = require('./services/OrderNotificationHook');
const orderNotificationHook = new OrderNotificationHook(lineBotService, pool);

// LIFF 入口頁面
app.get('/liff-entry', (req, res) => {
  // 緊急修復：恢復原本的LIFF ID（完整版本）
  const liffId = process.env.LINE_LIFF_ID || '2008130399-z1QXZgma';
  console.log('🔍 LIFF 入口頁面請求:', {
    timestamp: new Date().toISOString(),
    liffId: liffId || 'NOT_SET',
    liffIdLength: liffId ? liffId.length : 0,
    hasLiffId: !!liffId,
    envLiffId: process.env.LINE_LIFF_ID || 'MISSING',
    fallbackUsed: !process.env.LINE_LIFF_ID,
    allLineEnv: Object.keys(process.env).filter(key => key.includes('LINE'))
  });
  
  // 🔧 關鍵修復：移除 X-Frame-Options 以允許 LIFF 在 iframe 中載入
  res.removeHeader('X-Frame-Options');
  res.setHeader('X-Frame-Options', 'ALLOWALL');
  
  res.render('liff_entry', { liffId });
});

// LIFF 診斷頁面
app.get('/liff-debug', (req, res) => {
  const debugInfo = {
    timestamp: new Date().toISOString(),
    liffId: '2008130399-z1QXZgma',
    channelId: process.env.LINE_CHANNEL_ID || '2007891772',
    deploymentUrl: 'https://chengyivegetable-production-7b4a.up.railway.app',
    possibleCallbackUrls: [
      'https://chengyivegetable-production-7b4a.up.railway.app/liff-entry',
      'https://chengyivegetable-production-7b4a.up.railway.app/liff',
      'https://chengyivegetable-production-7b4a.up.railway.app/line-entry'
    ],
    requiredSettings: {
      type: 'full',
      scope: 'profile',
      botLinkFeature: 'aggressive'
    }
  };
  
  res.json(debugInfo);
});

// LIFF 替代路由（以防LINE Console設定問題）
app.get('/liff', (req, res) => {
  res.redirect('/liff-entry');
});

app.get('/line-entry', (req, res) => {
  res.redirect('/liff-entry');
});

// LINE Bot 測試頁面
app.get('/line-bot-test', (req, res) => {
  res.render('line_bot_test');
});

// 一次性數據庫遷移端點 (僅管理員)
app.post('/admin/execute-line-users-migration', ensureAdmin, async (req, res) => {
  try {
    console.log('🚀 開始執行 LINE Users 數據庫遷移...');
    
    // 讀取 SQL 文件
    const fs = require('fs');
    const path = require('path');
    const sqlPath = path.join(__dirname, '..', 'create_line_users_table.sql');
    
    if (!fs.existsSync(sqlPath)) {
      return res.json({
        success: false,
        message: `SQL 文件不存在: ${sqlPath}`
      });
    }
    
    const sqlScript = fs.readFileSync(sqlPath, 'utf8');
    
    // 執行 SQL
    await pool.query(sqlScript);
    
    // 檢查結果
    const checkResult = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'line_users'
      )
    `);
    
    const tableExists = checkResult.rows[0].exists;
    
    if (tableExists) {
      // 檢查表結構
      const columnInfo = await pool.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_name = 'line_users' 
        ORDER BY ordinal_position
      `);
      
      res.json({
        success: true,
        message: 'line_users 表創建成功!',
        table_exists: true,
        columns: columnInfo.rows
      });
    } else {
      res.json({
        success: false,
        message: '表格創建失敗，line_users 表不存在'
      });
    }
    
  } catch (error) {
    console.error('❌ 數據庫遷移失敗:', error);
    res.json({
      success: false,
      message: '數據庫遷移失敗: ' + error.message,
      error: error.code
    });
  }
});

// LINE 用戶綁定 API
app.post('/api/line/bind-user', async (req, res) => {
  try {
    const { lineUserId, displayName, pictureUrl } = req.body;
    
    if (!lineUserId) {
      return res.status(400).json({
        success: false,
        message: 'LINE 用戶ID不能為空'
      });
    }
    
    // 檢查是否為示範模式
    if (lineBotService.demoMode) {
      console.log('📱 [示範模式] 用戶綁定請求:', {
        lineUserId,
        displayName,
        pictureUrl
      });
      
      return res.json({
        success: true,
        demo: true,
        message: '示範模式：用戶綁定模擬成功'
      });
    }
    
    // 將用戶資訊儲存到資料庫 - 使用安全的先查詢再插入方式
    const existingUser = await pool.query(`
      SELECT id FROM users WHERE line_user_id = $1
    `, [lineUserId]);
    
    if (existingUser.rows.length > 0) {
      // 更新現有用戶
      await pool.query(`
        UPDATE users 
        SET line_display_name = $1, name = $2
        WHERE line_user_id = $3
      `, [displayName, displayName, lineUserId]);
    } else {
      // 插入新用戶（使用臨時電話號碼，稍後可以更新）
      const tempPhone = `LINE_${lineUserId.slice(-8)}`; // 使用 LINE ID 後8位作為臨時電話
      await pool.query(`
        INSERT INTO users (phone, name, line_user_id, line_display_name, created_at)
        VALUES ($1, $2, $3, $4, NOW())
      `, [tempPhone, displayName, lineUserId, displayName]);
    }
    
    console.log(`📱 LINE用戶綁定成功: ${displayName} (${lineUserId})`);
    
    res.json({
      success: true,
      message: '用戶綁定成功',
      user: {
        lineUserId,
        displayName
      }
    });
    
  } catch (error) {
    console.error('❌ LINE用戶綁定失敗:', error);
    res.status(500).json({
      success: false,
      message: '綁定失敗：' + error.message
    });
  }
});

// 手動發送訂單通知 (用於測試)
app.post('/api/line/send-order-notification/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    
    // 查詢訂單資訊
    const orderResult = await pool.query(`
      SELECT o.*, u.line_user_id 
      FROM orders o
      LEFT JOIN users u ON o.contact_phone = u.phone
      WHERE o.id = $1
    `, [orderId]);
    
    if (orderResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: '找不到指定的訂單'
      });
    }
    
    const order = orderResult.rows[0];
    
    // 查詢訂單項目
    const itemsResult = await pool.query(`
      SELECT * FROM order_items WHERE order_id = $1
    `, [orderId]);
    
    const orderItems = itemsResult.rows;
    
    // 發送通知
    const result = await lineBotService.sendOrderCompletedNotification(order, orderItems);
    
    res.json({
      success: result.success,
      message: result.success ? '通知發送成功' : '通知發送失敗',
      demo: result.demo,
      reason: result.reason,
      error: result.error
    });
    
  } catch (error) {
    console.error('❌ 發送訂單通知失敗:', error);
    res.status(500).json({
      success: false,
      message: '發送失敗：' + error.message
    });
  }
});

// 訂單狀態更新 API (包含自動LINE通知)
app.put('/api/orders/:orderId/status', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status, notes } = req.body;
    
    if (!status) {
      return res.status(400).json({
        success: false,
        message: '狀態不能為空'
      });
    }
    
    // 示範模式處理
    if (demoMode) {
      console.log(`📋 [示範模式] 模擬訂單 #${orderId} 狀態更新: pending → ${status}`);
      
      const oldStatus = 'pending'; // 示範模式預設原狀態
      
      // 觸發通知Hook (這是重點測試項目)
      await orderNotificationHook.handleOrderStatusChange(orderId, oldStatus, status, {
        id: orderId,
        contact_name: '示範客戶',
        contact_phone: '0912345678',
        total_amount: 350,
        payment_method: 'cash',
        line_user_id: null // 觸發模擬通知
      });
      
      return res.json({
        success: true,
        message: '示範模式：訂單狀態更新成功，已觸發通知測試',
        orderId: parseInt(orderId),
        oldStatus,
        newStatus: status,
        demoMode: true
      });
    }
    
    // 查詢當前訂單狀態
    const currentOrderResult = await pool.query(
      'SELECT status FROM orders WHERE id = $1',
      [orderId]
    );
    
    if (currentOrderResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: '找不到指定的訂單'
      });
    }
    
    const oldStatus = currentOrderResult.rows[0].status;
    
    // 更新訂單狀態
    const updateQuery = notes ? 
      'UPDATE orders SET status = $1, delivery_notes = $2, updated_at = NOW() WHERE id = $3' :
      'UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2';
    
    const updateParams = notes ? [status, notes, orderId] : [status, orderId];
    
    await pool.query(updateQuery, updateParams);
    
    console.log(`📋 訂單 #${orderId} 狀態更新: ${oldStatus} → ${status}`);
    
    // 觸發通知Hook
    await orderNotificationHook.handleOrderStatusChange(orderId, oldStatus, status);
    
    res.json({
      success: true,
      message: '訂單狀態更新成功',
      orderId: parseInt(orderId),
      oldStatus,
      newStatus: status
    });
    
  } catch (error) {
    console.error('❌ 更新訂單狀態失敗:', error);
    res.status(500).json({
      success: false,
      message: '更新失敗：' + error.message
    });
  }
});

// 批量更新訂單狀態 (支援多筆訂單同時更新)
app.put('/api/orders/batch-status', async (req, res) => {
  try {
    const { orderIds, status, notes } = req.body;
    
    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: '訂單ID列表不能為空'
      });
    }
    
    if (!status) {
      return res.status(400).json({
        success: false,
        message: '狀態不能為空'
      });
    }
    
    const results = [];
    
    // 逐筆處理以觸發通知
    for (const orderId of orderIds) {
      try {
        // 查詢當前狀態
        const currentResult = await pool.query(
          'SELECT status FROM orders WHERE id = $1',
          [orderId]
        );
        
        if (currentResult.rows.length === 0) {
          results.push({ orderId, success: false, message: '訂單不存在' });
          continue;
        }
        
        const oldStatus = currentResult.rows[0].status;
        
        // 更新狀態
        const updateQuery = notes ? 
          'UPDATE orders SET status = $1, delivery_notes = $2, updated_at = NOW() WHERE id = $3' :
          'UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2';
        
        const updateParams = notes ? [status, notes, orderId] : [status, orderId];
        
        await pool.query(updateQuery, updateParams);
        
        // 觸發通知
        await orderNotificationHook.handleOrderStatusChange(orderId, oldStatus, status);
        
        results.push({ 
          orderId, 
          success: true, 
          oldStatus, 
          newStatus: status 
        });
        
      } catch (error) {
        console.error(`❌ 處理訂單 #${orderId} 失敗:`, error);
        results.push({ 
          orderId, 
          success: false, 
          message: error.message 
        });
      }
    }
    
    const successCount = results.filter(r => r.success).length;
    
    res.json({
      success: true,
      message: `成功更新 ${successCount}/${orderIds.length} 筆訂單`,
      results
    });
    
  } catch (error) {
    console.error('❌ 批量更新訂單狀態失敗:', error);
    res.status(500).json({
      success: false,
      message: '批量更新失敗：' + error.message
    });
  }
});

// =====================================
// LINE 用戶管理 API (新版)
// =====================================

// 註冊/更新 LINE 用戶
app.post('/api/line/register-user', async (req, res) => {
  try {
    const { userId, displayName, pictureUrl, statusMessage } = req.body;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'LINE User ID 不能為空'
      });
    }

    if (!lineUserService) {
      return res.status(503).json({
        success: false,
        message: 'LINE 用戶服務未初始化'
      });
    }

    // 處理用戶註冊/更新
    const user = await lineUserService.processLineUser({
      userId,
      displayName,
      pictureUrl,
      statusMessage
    });

    res.json({
      success: true,
      message: '用戶註冊/更新成功',
      user,
      isNewUser: !user.id || user.id > Date.now() - 60000 // 簡單判斷是否為新用戶
    });

  } catch (error) {
    console.error('❌ LINE 用戶註冊失敗:', error);
    res.status(500).json({
      success: false,
      message: '註冊失敗：' + error.message
    });
  }
});

// 綁定電話號碼
app.post('/api/line/bind-phone', async (req, res) => {
  try {
    const { userId, phone } = req.body;
    
    if (!userId || !phone) {
      return res.status(400).json({
        success: false,
        message: '用戶 ID 和電話號碼不能為空'
      });
    }

    if (!lineUserService) {
      return res.status(503).json({
        success: false,
        message: 'LINE 用戶服務未初始化'
      });
    }

    // 綁定電話號碼
    await lineUserService.bindUserPhone(userId, phone);

    res.json({
      success: true,
      message: '電話號碼綁定成功'
    });

  } catch (error) {
    console.error('❌ 電話號碼綁定失敗:', error);
    res.status(500).json({
      success: false,
      message: '綁定失敗：' + error.message
    });
  }
});

// 查詢用戶訂單記錄
app.get('/api/line/order-history/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: '用戶 ID 不能為空'
      });
    }

    if (!lineUserService) {
      return res.status(503).json({
        success: false,
        message: 'LINE 用戶服務未初始化'
      });
    }

    // 查詢訂單記錄
    const orders = await lineUserService.getUserOrderHistory(userId);

    res.json({
      success: true,
      orders
    });

  } catch (error) {
    console.error('❌ 查詢訂單記錄失敗:', error);
    res.status(500).json({
      success: false,
      message: '查詢失敗：' + error.message
    });
  }
});

// API：獲取當前用戶的訂單 (基於session)
app.get('/api/user/orders', async (req, res) => {
  try {
    // 從session獲取LINE用戶ID
    const lineUserId = req.session?.line?.userId || req.session?.lineUserId;
    
    if (!lineUserId) {
      return res.status(401).json({
        success: false,
        message: '用戶未綁定LINE或session已過期'
      });
    }

    if (demoMode) {
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
    if (!lineUserService) {
      return res.status(503).json({
        success: false,
        message: 'LINE 用戶服務未初始化'
      });
    }

    const orders = await lineUserService.getUserOrderHistory(lineUserId);

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
      error: demoMode ? error.message : undefined
    });
  }
});

// 透過電話號碼查詢 LINE User ID
app.get('/api/line/user-id/:phone', async (req, res) => {
  try {
    const { phone } = req.params;
    
    if (!phone) {
      return res.status(400).json({
        success: false,
        message: '電話號碼不能為空'
      });
    }

    if (!lineUserService) {
      return res.status(503).json({
        success: false,
        message: 'LINE 用戶服務未初始化'
      });
    }

    // 查詢 LINE User ID
    const userId = await lineUserService.getLineUserIdByPhone(phone);

    res.json({
      success: true,
      userId,
      hasLineUser: !!userId
    });

  } catch (error) {
    console.error('❌ 查詢 LINE User ID 失敗:', error);
    res.status(500).json({
      success: false,
      message: '查詢失敗：' + error.message
    });
  }
});

// 為訂單關聯 LINE 用戶
app.post('/api/line/link-order', async (req, res) => {
  try {
    const { orderId, userId } = req.body;
    
    if (!orderId || !userId) {
      return res.status(400).json({
        success: false,
        message: '訂單 ID 和用戶 ID 不能為空'
      });
    }

    if (!lineUserService) {
      return res.status(503).json({
        success: false,
        message: 'LINE 用戶服務未初始化'
      });
    }

    // 關聯訂單與用戶
    await lineUserService.linkOrderToLineUser(orderId, userId);

    res.json({
      success: true,
      message: '訂單關聯成功'
    });

  } catch (error) {
    console.error('❌ 訂單關聯失敗:', error);
    res.status(500).json({
      success: false,
      message: '關聯失敗：' + error.message
    });
  }
});

// LINE 用戶訂單記錄頁面
app.get('/line/order-history', (req, res) => {
  const { userId } = req.query;
  res.render('line_order_history', { userId });
});

// =====================================
// 後台訂單管理 API
// =====================================

// 後台訂單管理頁面
app.get('/admin/order-management', ensureAdmin, (req, res) => {
  res.render('admin_order_management');
});

// 獲取訂單列表 (支援搜尋和篩選)
app.get('/api/admin/orders-list', ensureAdmin, async (req, res) => {
  try {
    const { 
      customerName, 
      status, 
      dateFrom, 
      dateTo, 
      limit = 100, 
      offset = 0 
    } = req.query;
    
    let whereConditions = ['1=1'];
    let queryParams = [];
    let paramIndex = 1;
    
    // 顧客姓名搜尋
    if (customerName) {
      whereConditions.push(`LOWER(contact_name) LIKE LOWER($${paramIndex})`);
      queryParams.push(`%${customerName}%`);
      paramIndex++;
    }
    
    // 狀態篩選
    if (status) {
      whereConditions.push(`status = $${paramIndex}`);
      queryParams.push(status);
      paramIndex++;
    }
    
    // 日期範圍篩選
    if (dateFrom) {
      whereConditions.push(`DATE(created_at) >= $${paramIndex}`);
      queryParams.push(dateFrom);
      paramIndex++;
    }
    
    if (dateTo) {
      whereConditions.push(`DATE(created_at) <= $${paramIndex}`);
      queryParams.push(dateTo);
      paramIndex++;
    }
    
    const query = `
      SELECT 
        id, contact_name, contact_phone, address, 
        total_amount, status, created_at, notes
      FROM orders 
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY created_at DESC 
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    
    queryParams.push(limit, offset);
    
    const result = await pool.query(query, queryParams);
    
    res.json({
      success: true,
      orders: result.rows,
      total: result.rows.length
    });
    
  } catch (error) {
    console.error('獲取訂單列表錯誤:', error);
    res.status(500).json({
      success: false,
      message: '獲取訂單列表失敗: ' + error.message
    });
  }
});

// 獲取訂單詳細資料 (包含商品明細)
app.get('/api/admin/orders/:orderId/details', ensureAdmin, async (req, res) => {
  try {
    const { orderId } = req.params;
    
    // 查詢訂單基本資料
    const orderResult = await pool.query(`
      SELECT o.*, u.line_user_id 
      FROM orders o
      LEFT JOIN users u ON o.contact_phone = u.phone
      WHERE o.id = $1
    `, [orderId]);
    
    if (orderResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: '找不到指定的訂單'
      });
    }
    
    // 查詢訂單商品明細
    const itemsResult = await pool.query(`
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
    console.error('獲取訂單詳情錯誤:', error);
    res.status(500).json({
      success: false,
      message: '獲取訂單詳情失敗: ' + error.message
    });
  }
});

// 更新訂單資料
app.put('/api/admin/orders/:orderId', ensureAdmin, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { 
      contact_name, 
      contact_phone, 
      address, 
      status, 
      notes, 
      total_amount,
      items 
    } = req.body;
    
    // 開始事務
    const client = await pool.connect();
    await client.query('BEGIN');
    
    try {
      // 記錄舊狀態（用於觸發通知）
      const oldOrderResult = await client.query('SELECT status FROM orders WHERE id = $1', [orderId]);
      const oldStatus = oldOrderResult.rows[0]?.status;
      
      // 更新訂單基本資料
      await client.query(`
        UPDATE orders SET 
          contact_name = $1,
          contact_phone = $2,
          address = $3,
          status = $4,
          notes = $5,
          total_amount = $6,
          updated_at = NOW()
        WHERE id = $7
      `, [contact_name, contact_phone, address, status, notes, total_amount, orderId]);
      
      // 更新商品價格（如有變更）
      if (items && Array.isArray(items)) {
        for (const item of items) {
          if (item.index !== undefined && item.new_price !== undefined) {
            // 獲取該索引的商品
            const itemResult = await client.query(`
              SELECT id, quantity FROM order_items 
              WHERE order_id = $1 
              ORDER BY id 
              LIMIT 1 OFFSET $2
            `, [orderId, item.index]);
            
            if (itemResult.rows.length > 0) {
              const itemId = itemResult.rows[0].id;
              const quantity = itemResult.rows[0].quantity;
              const newLineTotal = item.new_price * quantity;
              
              await client.query(`
                UPDATE order_items SET 
                  unit_price = $1,
                  line_total = $2
                WHERE id = $3
              `, [item.new_price, newLineTotal, itemId]);
            }
          }
        }
        
        // 重新計算訂單總額
        const totalResult = await client.query(`
          SELECT COALESCE(SUM(line_total), 0) + 50 as new_total 
          FROM order_items WHERE order_id = $1
        `, [orderId]);
        
        const newTotal = totalResult.rows[0].new_total;
        
        await client.query(`
          UPDATE orders SET total_amount = $1 WHERE id = $2
        `, [newTotal, orderId]);
      }
      
      await client.query('COMMIT');
      
      // 如果狀態有變更，觸發通知Hook
      if (oldStatus && oldStatus !== status) {
        await orderNotificationHook.handleOrderStatusChange(orderId, oldStatus, status);
      }
      
      res.json({
        success: true,
        message: '訂單更新成功',
        orderId: parseInt(orderId)
      });
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('更新訂單錯誤:', error);
    res.status(500).json({
      success: false,
      message: '更新訂單失敗: ' + error.message
    });
  }
});

// =====================================
// 🛍️ 後台商品管理 API
// =====================================

// 後台商品管理 - 獲取商品列表
app.get('/api/admin/products', ensureAdmin, asyncWrapper(async (req, res) => {
  try {
    const { search, category, limit = 50, offset = 0 } = req.query;
    
    if (demoMode) {
      console.log('📦 後台API：使用示範產品資料');
      let products = [...demoProducts];
      
      // 搜尋篩選
      if (search) {
        const searchTerm = search.toLowerCase();
        products = products.filter(p => 
          p.name.toLowerCase().includes(searchTerm)
        );
      }
      
      return res.json({
        success: true,
        products,
        total: products.length,
        count: products.length,
        mode: 'demo',
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          total: products.length
        }
      });
    }
    
    // 構建查詢條件
    let whereConditions = ['1=1'];
    let queryParams = [];
    let paramIndex = 1;
    
    // 商品名稱搜尋
    if (search) {
      whereConditions.push(`LOWER(name) LIKE LOWER($${paramIndex})`);
      queryParams.push(`%${search}%`);
      paramIndex++;
    }
    
    const whereClause = whereConditions.join(' AND ');
    
    // 查詢商品總數
    const countQuery = `SELECT COUNT(*) FROM products WHERE ${whereClause}`;
    const { rows: countResult } = await pool.query(countQuery, queryParams);
    const total = parseInt(countResult[0].count);
    
    // 查詢商品列表
    const productsQuery = `
      SELECT 
        p.*,
        i.current_stock,
        i.min_stock_alert,
        i.unit_cost,
        i.supplier_name,
        i.last_updated as stock_updated
      FROM products p 
      LEFT JOIN inventory i ON p.id = i.product_id
      WHERE ${whereClause}
      ORDER BY p.id 
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    
    queryParams.push(parseInt(limit), parseInt(offset));
    const { rows: products } = await pool.query(productsQuery, queryParams);
    
    res.json({
      success: true,
      products,
      total,
      count: products.length,
      mode: 'database',
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total
      }
    });
    
  } catch (error) {
    console.error('獲取後台商品列表失敗:', error);
    res.status(500).json({
      success: false,
      message: '獲取商品列表失敗: ' + error.message,
      products: [],
      total: 0,
      count: 0
    });
  }
}));

// 後台商品管理 - 新增商品
app.post('/api/admin/products', ensureAdmin, sanitizeInput, asyncWrapper(async (req, res) => {
  try {
    const { 
      name, 
      price, 
      is_priced_item = false, 
      unit_hint,
      initial_stock = 0,
      min_stock_alert = 10,
      unit_cost,
      supplier_name 
    } = req.body;
    
    // 輸入驗證
    if (!name || name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: '商品名稱必填'
      });
    }
    
    if (demoMode) {
      console.log('📝 示範模式：模擬新增商品', { name, price });
      
      // 生成模擬ID
      const mockId = Math.max(...demoProducts.map(p => p.id)) + 1;
      const newProduct = {
        id: mockId,
        name: name.trim(),
        price: price ? parseFloat(price) : null,
        is_priced_item: is_priced_item === true || is_priced_item === 'true',
        unit_hint: unit_hint || null,
        current_stock: parseInt(initial_stock) || 0,
        min_stock_alert: parseInt(min_stock_alert) || 10,
        unit_cost: unit_cost ? parseFloat(unit_cost) : null,
        supplier_name: supplier_name || null
      };
      
      return res.status(201).json({
        success: true,
        message: '商品新增成功（示範模式）',
        product: newProduct,
        mode: 'demo'
      });
    }
    
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // 插入商品
      const productQuery = `
        INSERT INTO products (name, price, is_priced_item, unit_hint) 
        VALUES ($1, $2, $3, $4) 
        RETURNING *
      `;
      
      const priceValue = price && price !== '' ? parseFloat(price) : null;
      const isPricedItem = is_priced_item === true || is_priced_item === 'true';
      
      const { rows: productRows } = await client.query(productQuery, [
        name.trim(),
        priceValue,
        isPricedItem,
        unit_hint || null
      ]);
      
      const newProduct = productRows[0];
      
      // 如果提供了庫存資訊，插入庫存記錄
      if (initial_stock || min_stock_alert || unit_cost || supplier_name) {
        const inventoryQuery = `
          INSERT INTO inventory 
          (product_id, current_stock, min_stock_alert, unit_cost, supplier_name) 
          VALUES ($1, $2, $3, $4, $5)
          RETURNING *
        `;
        
        const stockValue = parseInt(initial_stock) || 0;
        const minAlert = parseInt(min_stock_alert) || 10;
        const costValue = unit_cost && unit_cost !== '' ? parseFloat(unit_cost) : null;
        
        const { rows: inventoryRows } = await client.query(inventoryQuery, [
          newProduct.id,
          stockValue,
          minAlert,
          costValue,
          supplier_name || null
        ]);
        
        // 合併庫存資訊到商品資料
        newProduct.current_stock = inventoryRows[0].current_stock;
        newProduct.min_stock_alert = inventoryRows[0].min_stock_alert;
        newProduct.unit_cost = inventoryRows[0].unit_cost;
        newProduct.supplier_name = inventoryRows[0].supplier_name;
        
        // 記錄庫存異動（如果有初始庫存）
        if (stockValue > 0) {
          await client.query(`
            INSERT INTO stock_movements 
            (product_id, movement_type, quantity, unit_cost, reason, operator_name) 
            VALUES ($1, 'in', $2, $3, $4, $5)
          `, [
            newProduct.id, 
            stockValue, 
            costValue,
            '初始庫存', 
            '系統管理員'
          ]);
        }
      }
      
      await client.query('COMMIT');
      
      console.log('✅ 成功新增商品:', newProduct.name, '(ID:', newProduct.id, ')');
      
      res.status(201).json({
        success: true,
        message: '商品新增成功',
        product: newProduct,
        mode: 'database'
      });
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('新增商品失敗:', error);
    
    // 檢查是否為重複名稱錯誤
    if (error.message && error.message.includes('duplicate key')) {
      return res.status(409).json({
        success: false,
        message: '商品名稱已存在，請使用其他名稱'
      });
    }
    
    res.status(500).json({
      success: false,
      message: '新增商品失敗: ' + error.message
    });
  }
}));

// 後台商品管理 - 更新商品
app.put('/api/admin/products/:id', ensureAdmin, sanitizeInput, asyncWrapper(async (req, res) => {
  try {
    const productId = parseInt(req.params.id);
    const { 
      name, 
      price, 
      is_priced_item, 
      unit_hint,
      current_stock,
      min_stock_alert,
      unit_cost,
      supplier_name 
    } = req.body;
    
    if (!productId || isNaN(productId)) {
      return res.status(400).json({
        success: false,
        message: '無效的商品ID'
      });
    }
    
    // 基本驗證
    if (name !== undefined && (!name || name.trim().length === 0)) {
      return res.status(400).json({
        success: false,
        message: '商品名稱不可為空'
      });
    }
    
    if (demoMode) {
      console.log('📝 示範模式：模擬更新商品', { id: productId, name });
      
      const existingProduct = demoProducts.find(p => p.id === productId);
      if (!existingProduct) {
        return res.status(404).json({
          success: false,
          message: '找不到指定商品'
        });
      }
      
      const updatedProduct = {
        ...existingProduct,
        ...(name !== undefined && { name: name.trim() }),
        ...(price !== undefined && { price: price ? parseFloat(price) : null }),
        ...(is_priced_item !== undefined && { is_priced_item: is_priced_item === true || is_priced_item === 'true' }),
        ...(unit_hint !== undefined && { unit_hint }),
        ...(current_stock !== undefined && { current_stock: parseInt(current_stock) || 0 }),
        ...(min_stock_alert !== undefined && { min_stock_alert: parseInt(min_stock_alert) || 10 }),
        ...(unit_cost !== undefined && { unit_cost: unit_cost ? parseFloat(unit_cost) : null }),
        ...(supplier_name !== undefined && { supplier_name })
      };
      
      return res.json({
        success: true,
        message: '商品更新成功（示範模式）',
        product: updatedProduct,
        mode: 'demo'
      });
    }
    
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // 檢查商品是否存在
      const { rows: existingProducts } = await client.query(
        'SELECT * FROM products WHERE id = $1', 
        [productId]
      );
      
      if (existingProducts.length === 0) {
        return res.status(404).json({
          success: false,
          message: '找不到指定商品'
        });
      }
      
      const existingProduct = existingProducts[0];
      
      // 構建更新語句
      let updateFields = [];
      let updateValues = [];
      let paramIndex = 1;
      
      if (name !== undefined) {
        updateFields.push(`name = $${paramIndex}`);
        updateValues.push(name.trim());
        paramIndex++;
      }
      
      if (price !== undefined) {
        updateFields.push(`price = $${paramIndex}`);
        updateValues.push(price && price !== '' ? parseFloat(price) : null);
        paramIndex++;
      }
      
      if (is_priced_item !== undefined) {
        updateFields.push(`is_priced_item = $${paramIndex}`);
        updateValues.push(is_priced_item === true || is_priced_item === 'true');
        paramIndex++;
      }
      
      if (unit_hint !== undefined) {
        updateFields.push(`unit_hint = $${paramIndex}`);
        updateValues.push(unit_hint || null);
        paramIndex++;
      }
      
      let updatedProduct = existingProduct;
      
      // 如果有商品基本資訊要更新
      if (updateFields.length > 0) {
        const productUpdateQuery = `
          UPDATE products 
          SET ${updateFields.join(', ')}
          WHERE id = $${paramIndex}
          RETURNING *
        `;
        
        updateValues.push(productId);
        const { rows: productRows } = await client.query(productUpdateQuery, updateValues);
        updatedProduct = productRows[0];
      }
      
      // 處理庫存資訊更新
      if (current_stock !== undefined || min_stock_alert !== undefined || 
          unit_cost !== undefined || supplier_name !== undefined) {
        
        // 檢查是否已有庫存記錄
        const { rows: inventoryRows } = await client.query(
          'SELECT * FROM inventory WHERE product_id = $1', 
          [productId]
        );
        
        if (inventoryRows.length > 0) {
          // 更新現有庫存記錄
          let inventoryUpdateFields = [];
          let inventoryUpdateValues = [];
          let inventoryParamIndex = 1;
          
          if (current_stock !== undefined) {
            inventoryUpdateFields.push(`current_stock = $${inventoryParamIndex}`);
            inventoryUpdateValues.push(parseInt(current_stock) || 0);
            inventoryParamIndex++;
          }
          
          if (min_stock_alert !== undefined) {
            inventoryUpdateFields.push(`min_stock_alert = $${inventoryParamIndex}`);
            inventoryUpdateValues.push(parseInt(min_stock_alert) || 10);
            inventoryParamIndex++;
          }
          
          if (unit_cost !== undefined) {
            inventoryUpdateFields.push(`unit_cost = $${inventoryParamIndex}`);
            inventoryUpdateValues.push(unit_cost && unit_cost !== '' ? parseFloat(unit_cost) : null);
            inventoryParamIndex++;
          }
          
          if (supplier_name !== undefined) {
            inventoryUpdateFields.push(`supplier_name = $${inventoryParamIndex}`);
            inventoryUpdateValues.push(supplier_name || null);
            inventoryParamIndex++;
          }
          
          inventoryUpdateFields.push(`last_updated = CURRENT_TIMESTAMP`);
          
          const inventoryUpdateQuery = `
            UPDATE inventory 
            SET ${inventoryUpdateFields.join(', ')}
            WHERE product_id = $${inventoryParamIndex}
            RETURNING *
          `;
          
          inventoryUpdateValues.push(productId);
          const { rows: updatedInventoryRows } = await client.query(inventoryUpdateQuery, inventoryUpdateValues);
          
          // 合併庫存資訊
          const inventoryInfo = updatedInventoryRows[0];
          updatedProduct.current_stock = inventoryInfo.current_stock;
          updatedProduct.min_stock_alert = inventoryInfo.min_stock_alert;
          updatedProduct.unit_cost = inventoryInfo.unit_cost;
          updatedProduct.supplier_name = inventoryInfo.supplier_name;
          updatedProduct.stock_updated = inventoryInfo.last_updated;
          
        } else {
          // 新建庫存記錄
          const inventoryInsertQuery = `
            INSERT INTO inventory 
            (product_id, current_stock, min_stock_alert, unit_cost, supplier_name) 
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
          `;
          
          const { rows: newInventoryRows } = await client.query(inventoryInsertQuery, [
            productId,
            parseInt(current_stock) || 0,
            parseInt(min_stock_alert) || 10,
            unit_cost && unit_cost !== '' ? parseFloat(unit_cost) : null,
            supplier_name || null
          ]);
          
          // 合併庫存資訊
          const inventoryInfo = newInventoryRows[0];
          updatedProduct.current_stock = inventoryInfo.current_stock;
          updatedProduct.min_stock_alert = inventoryInfo.min_stock_alert;
          updatedProduct.unit_cost = inventoryInfo.unit_cost;
          updatedProduct.supplier_name = inventoryInfo.supplier_name;
          updatedProduct.stock_updated = inventoryInfo.last_updated;
        }
      }
      
      await client.query('COMMIT');
      
      console.log('✅ 成功更新商品:', updatedProduct.name, '(ID:', updatedProduct.id, ')');
      
      res.json({
        success: true,
        message: '商品更新成功',
        product: updatedProduct,
        mode: 'database'
      });
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('更新商品失敗:', error);
    
    // 檢查是否為重複名稱錯誤
    if (error.message && error.message.includes('duplicate key')) {
      return res.status(409).json({
        success: false,
        message: '商品名稱已存在，請使用其他名稱'
      });
    }
    
    res.status(500).json({
      success: false,
      message: '更新商品失敗: ' + error.message
    });
  }
}));

// 後台商品管理 - 刪除商品
app.delete('/api/admin/products/:id', ensureAdmin, asyncWrapper(async (req, res) => {
  try {
    const productId = parseInt(req.params.id);
    
    if (!productId || isNaN(productId)) {
      return res.status(400).json({
        success: false,
        message: '無效的商品ID'
      });
    }
    
    if (demoMode) {
      console.log('🗑️ 示範模式：模擬刪除商品', { id: productId });
      
      const existingProduct = demoProducts.find(p => p.id === productId);
      if (!existingProduct) {
        return res.status(404).json({
          success: false,
          message: '找不到指定商品'
        });
      }
      
      return res.json({
        success: true,
        message: '商品刪除成功（示範模式）',
        product: existingProduct,
        mode: 'demo'
      });
    }
    
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // 檢查商品是否存在
      const { rows: existingProducts } = await client.query(
        'SELECT * FROM products WHERE id = $1', 
        [productId]
      );
      
      if (existingProducts.length === 0) {
        return res.status(404).json({
          success: false,
          message: '找不到指定商品'
        });
      }
      
      const productToDelete = existingProducts[0];
      
      // 檢查是否有相關的訂單項目
      const { rows: relatedOrderItems } = await client.query(
        'SELECT COUNT(*) as count FROM order_items WHERE product_id = $1', 
        [productId]
      );
      
      const orderItemCount = parseInt(relatedOrderItems[0].count);
      
      if (orderItemCount > 0) {
        // 如果有相關訂單，不直接刪除，而是標記為已停用
        // 由於目前schema沒有status欄位，我們在這裡給出警告
        await client.query('ROLLBACK');
        return res.status(409).json({
          success: false,
          message: `該商品已被 ${orderItemCount} 個訂單使用，無法直接刪除。建議將商品設為停售狀態或聯絡系統管理員處理。`,
          relatedOrdersCount: orderItemCount
        });
      }
      
      // 先刪除庫存記錄
      await client.query('DELETE FROM inventory WHERE product_id = $1', [productId]);
      
      // 刪除庫存異動記錄
      await client.query('DELETE FROM stock_movements WHERE product_id = $1', [productId]);
      
      // 最後刪除商品
      const { rows: deletedProducts } = await client.query(
        'DELETE FROM products WHERE id = $1 RETURNING *', 
        [productId]
      );
      
      const deletedProduct = deletedProducts[0];
      
      await client.query('COMMIT');
      
      console.log('✅ 成功刪除商品:', deletedProduct.name, '(ID:', deletedProduct.id, ')');
      
      res.json({
        success: true,
        message: '商品刪除成功',
        product: deletedProduct,
        mode: 'database'
      });
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('刪除商品失敗:', error);
    
    // 檢查是否為外鍵約束錯誤
    if (error.message && (error.message.includes('foreign key') || error.message.includes('violates'))) {
      return res.status(409).json({
        success: false,
        message: '該商品仍有相關資料，無法刪除。請先處理相關訂單或庫存記錄。'
      });
    }
    
    res.status(500).json({
      success: false,
      message: '刪除商品失敗: ' + error.message
    });
  }
}));

// API: 切換商品上下架狀態
app.patch('/api/admin/products/:id/toggle-availability', ensureAdmin, asyncWrapper(async (req, res) => {
  try {
    const productId = parseInt(req.params.id);
    
    if (demoMode) {
      // 示範模式：直接在記憶體中切換狀態
      const existingProduct = demoProducts.find(p => p.id === productId);
      if (!existingProduct) {
        return res.status(404).json({
          success: false,
          message: '找不到指定商品'
        });
      }
      
      // 切換狀態
      existingProduct.is_available = !existingProduct.is_available;
      
      return res.json({
        success: true,
        message: `商品已${existingProduct.is_available ? '上架' : '下架'}`,
        product: existingProduct,
        mode: 'demo'
      });
    }
    
    // 真實資料庫模式
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // 檢查商品是否存在並獲取當前狀態
      const { rows: products } = await client.query(
        'SELECT id, name, is_available FROM products WHERE id = $1', 
        [productId]
      );
      
      if (products.length === 0) {
        return res.status(404).json({
          success: false,
          message: '找不到指定商品'
        });
      }
      
      const currentProduct = products[0];
      const newAvailability = !currentProduct.is_available;
      
      // 更新商品狀態
      const { rows: updatedProducts } = await client.query(
        'UPDATE products SET is_available = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
        [newAvailability, productId]
      );
      
      await client.query('COMMIT');
      
      res.json({
        success: true,
        message: `商品「${currentProduct.name}」已${newAvailability ? '上架' : '下架'}`,
        product: updatedProducts[0],
        mode: 'database'
      });
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('切換商品狀態失敗:', error);
    res.status(500).json({
      success: false,
      message: '切換商品狀態失敗: ' + error.message
    });
  }
}));

// =====================================
// 📦 後台訂單管理 API  
// =====================================

// 後台訂單管理 - 獲取訂單列表
app.get('/api/admin/orders', ensureAdmin, asyncWrapper(async (req, res) => {
  try {
    const { 
      search, 
      status, 
      dateFrom, 
      dateTo,
      limit = 50, 
      offset = 0 
    } = req.query;
    
    if (demoMode) {
      console.log('📋 後台API：使用示範訂單資料');
      
      let mockOrders = [
        {
          id: 1001,
          contact_name: '張三',
          contact_phone: '0912345678',
          address: '台北市大安區信義路四段123號',
          status: 'placed',
          total: 350,
          subtotal: 320,
          delivery_fee: 30,
          payment_method: 'cash',
          created_at: new Date(Date.now() - 3600000).toISOString(),
          notes: '請送到一樓管理室'
        },
        {
          id: 1002,
          contact_name: '李小美',
          contact_phone: '0923456789',
          address: '新北市板橋區文化路二段456號',
          status: 'confirmed',
          total: 480,
          subtotal: 450,
          delivery_fee: 30,
          payment_method: 'card',
          created_at: new Date(Date.now() - 7200000).toISOString(),
          notes: '二樓左邊第一間'
        },
        {
          id: 1003,
          contact_name: '王大明',
          contact_phone: '0934567890',
          address: '桃園市中壢區中正路三段789號',
          status: 'delivered',
          total: 220,
          subtotal: 200,
          delivery_fee: 20,
          payment_method: 'cash',
          created_at: new Date(Date.now() - 86400000).toISOString(),
          notes: ''
        }
      ];
      
      // 搜尋篩選
      if (search) {
        const searchTerm = search.toLowerCase();
        mockOrders = mockOrders.filter(order => 
          order.contact_name.toLowerCase().includes(searchTerm) ||
          order.contact_phone.includes(searchTerm) ||
          order.address.toLowerCase().includes(searchTerm)
        );
      }
      
      // 狀態篩選
      if (status) {
        mockOrders = mockOrders.filter(order => order.status === status);
      }
      
      // 日期篩選（簡化版）
      if (dateFrom || dateTo) {
        const fromDate = dateFrom ? new Date(dateFrom) : new Date('2020-01-01');
        const toDate = dateTo ? new Date(dateTo + ' 23:59:59') : new Date();
        
        mockOrders = mockOrders.filter(order => {
          const orderDate = new Date(order.created_at);
          return orderDate >= fromDate && orderDate <= toDate;
        });
      }
      
      return res.json({
        success: true,
        orders: mockOrders,
        total: mockOrders.length,
        count: mockOrders.length,
        mode: 'demo',
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          total: mockOrders.length
        }
      });
    }
    
    // 構建查詢條件
    let whereConditions = ['1=1'];
    let queryParams = [];
    let paramIndex = 1;
    
    // 搜尋條件（聯合搜尋客戶姓名、電話、地址）
    if (search) {
      whereConditions.push(`(
        LOWER(contact_name) LIKE LOWER($${paramIndex}) OR 
        contact_phone LIKE $${paramIndex} OR 
        LOWER(address) LIKE LOWER($${paramIndex})
      )`);
      queryParams.push(`%${search}%`);
      paramIndex++;
    }
    
    // 狀態篩選
    if (status) {
      whereConditions.push(`status = $${paramIndex}`);
      queryParams.push(status);
      paramIndex++;
    }
    
    // 日期範圍篩選
    if (dateFrom) {
      whereConditions.push(`DATE(created_at) >= $${paramIndex}`);
      queryParams.push(dateFrom);
      paramIndex++;
    }
    
    if (dateTo) {
      whereConditions.push(`DATE(created_at) <= $${paramIndex}`);
      queryParams.push(dateTo);
      paramIndex++;
    }
    
    const whereClause = whereConditions.join(' AND ');
    
    // 查詢訂單總數
    const countQuery = `SELECT COUNT(*) FROM orders WHERE ${whereClause}`;
    const { rows: countResult } = await pool.query(countQuery, queryParams);
    const total = parseInt(countResult[0].count);
    
    // 查詢訂單列表
    const ordersQuery = `
      SELECT 
        o.*,
        COUNT(oi.id) as item_count
      FROM orders o 
      LEFT JOIN order_items oi ON o.id = oi.order_id
      WHERE ${whereClause}
      GROUP BY o.id
      ORDER BY o.created_at DESC 
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    
    queryParams.push(parseInt(limit), parseInt(offset));
    const { rows: orders } = await pool.query(ordersQuery, queryParams);
    
    res.json({
      success: true,
      orders,
      total,
      count: orders.length,
      mode: 'database',
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total
      }
    });
    
  } catch (error) {
    console.error('獲取後台訂單列表失敗:', error);
    res.status(500).json({
      success: false,
      message: '獲取訂單列表失敗: ' + error.message,
      orders: [],
      total: 0,
      count: 0
    });
  }
}));

// 後台訂單管理 - 更新訂單狀態（簡化版）
app.put('/api/admin/orders/:id', ensureAdmin, sanitizeInput, asyncWrapper(async (req, res) => {
  try {
    const orderId = parseInt(req.params.id);
    const { status, notes } = req.body;
    
    if (!orderId || isNaN(orderId)) {
      return res.status(400).json({
        success: false,
        message: '無效的訂單ID'
      });
    }
    
    if (!status) {
      return res.status(400).json({
        success: false,
        message: '訂單狀態必填'
      });
    }
    
    // 驗證狀態值
    const validStatuses = ['pending', 'preparing', 'packed', 'delivering', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: '無效的訂單狀態',
        validStatuses
      });
    }
    
    if (demoMode) {
      console.log('📝 示範模式：模擬更新訂單狀態', { id: orderId, status });
      
      const mockOrder = {
        id: orderId,
        contact_name: '示範客戶',
        contact_phone: '0912345678',
        address: '台北市大安區示範路123號',
        status,
        total: 350,
        notes: notes || '狀態已更新',
        updated_at: new Date().toISOString()
      };
      
      return res.json({
        success: true,
        message: '訂單狀態更新成功（示範模式）',
        order: mockOrder,
        mode: 'demo'
      });
    }
    
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // 檢查訂單是否存在並獲取當前狀態
      const { rows: existingOrders } = await client.query(
        'SELECT * FROM orders WHERE id = $1', 
        [orderId]
      );
      
      if (existingOrders.length === 0) {
        return res.status(404).json({
          success: false,
          message: '找不到指定訂單'
        });
      }
      
      const existingOrder = existingOrders[0];
      const oldStatus = existingOrder.status;
      
      // 更新訂單狀態和備註
      const updateQuery = `
        UPDATE orders 
        SET status = $1, notes = COALESCE($2, notes)
        WHERE id = $3 
        RETURNING *
      `;
      
      const { rows: updatedOrders } = await client.query(updateQuery, [
        status,
        notes,
        orderId
      ]);
      
      const updatedOrder = updatedOrders[0];
      
      await client.query('COMMIT');
      
      console.log(`✅ 成功更新訂單狀態: ${orderId} (${oldStatus} -> ${status})`);
      
      // 獲取訂單項目詳情（可選）
      const { rows: orderItems } = await pool.query(
        'SELECT * FROM order_items WHERE order_id = $1 ORDER BY id',
        [orderId]
      );
      
      updatedOrder.items = orderItems;
      updatedOrder.item_count = orderItems.length;
      
      res.json({
        success: true,
        message: '訂單狀態更新成功',
        order: updatedOrder,
        statusChange: {
          from: oldStatus,
          to: status
        },
        mode: 'database'
      });
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('更新訂單狀態失敗:', error);
    res.status(500).json({
      success: false,
      message: '更新訂單狀態失敗: ' + error.message
    });
  }
}));

// =================================================
// 📋 客戶訂單管理API
// =================================================

// 獲取單一訂單詳情 (客戶專用)
app.get('/api/user/orders/:orderId/details', async (req, res) => {
  try {
    const { orderId } = req.params;
    const lineUserId = req.session?.line?.userId || req.session?.lineUserId;
    
    if (!lineUserId) {
      return res.status(401).json({
        success: false,
        message: '用戶未綁定LINE或session已過期'
      });
    }

    if (demoMode) {
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
    const orderResult = await pool.query(`
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
    
    const itemsResult = await pool.query(`
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
      error: demoMode ? error.message : undefined
    });
  }
});

// 取消訂單中的單一商品 (客戶專用)
app.delete('/api/orders/:orderId/items/:itemId/cancel', async (req, res) => {
  try {
    const { orderId, itemId } = req.params;
    const lineUserId = req.session?.line?.userId || req.session?.lineUserId;
    
    if (!lineUserId) {
      return res.status(401).json({
        success: false,
        message: '用戶未綁定LINE或session已過期'
      });
    }

    if (demoMode) {
      console.log(`📝 示範模式：模擬取消訂單 #${orderId} 中的商品 #${itemId}`);
      return res.json({
        success: true,
        message: '商品已成功取消',
        demo: true
      });
    }

    // 檢查訂單權限和狀態
    const orderResult = await pool.query(`
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
    const client = await pool.connect();
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
});

// =================================================
// 💰 價格變動通知系統API
// =================================================

// 手動觸發價格變動檢測 (管理員專用)
app.post('/api/admin/price-check/manual', ensureAdmin, async (req, res) => {
  try {
    if (!priceChangeNotificationService) {
      return res.status(503).json({
        success: false,
        message: '價格變動通知服務未初始化'
      });
    }

    const result = await priceChangeNotificationService.triggerManualPriceCheck();
    
    res.json({
      success: true,
      message: '價格變動檢測完成',
      ...result
    });

  } catch (error) {
    console.error('❌ 手動價格檢測失敗:', error);
    res.status(500).json({
      success: false,
      message: '價格變動檢測失敗: ' + error.message
    });
  }
});

// 獲取價格變動通知統計 (管理員專用)
app.get('/api/admin/price-notifications/stats', ensureAdmin, async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    
    if (!priceChangeNotificationService) {
      return res.status(503).json({
        success: false,
        message: '價格變動通知服務未初始化'
      });
    }

    const stats = await priceChangeNotificationService.getNotificationStats(days);
    
    res.json({
      success: true,
      stats: {
        ...stats,
        period: `過去${days}天`
      }
    });

  } catch (error) {
    console.error('❌ 獲取通知統計失敗:', error);
    res.status(500).json({
      success: false,
      message: '獲取統計資料失敗: ' + error.message
    });
  }
});

// 測試價格變動通知 (管理員專用，示範模式)
app.post('/api/admin/price-notifications/test', ensureAdmin, async (req, res) => {
  try {
    if (!demoMode) {
      return res.status(400).json({
        success: false,
        message: '此功能僅在示範模式下可用'
      });
    }

    const { productName = '測試商品', oldPrice = 25, newPrice = 35 } = req.body;
    const changePercent = Math.round(((newPrice - oldPrice) / oldPrice) * 100);

    console.log(`📝 示範模式：測試價格變動通知 ${productName} ${oldPrice} → ${newPrice} (${changePercent}%)`);

    res.json({
      success: true,
      message: '測試通知已模擬發送',
      testData: {
        productName,
        oldPrice,
        newPrice,
        changePercent: `${changePercent}%`,
        affectedOrders: 2,
        notificationsSent: 2
      }
    });

  } catch (error) {
    console.error('❌ 測試通知失敗:', error);
    res.status(500).json({
      success: false,
      message: '測試通知失敗: ' + error.message
    });
  }
});

// 404處理 (必須放在所有路由的最後)
app.use(notFoundHandler);

// 監聽關閉信號
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('uncaughtException', (error) => {
  console.error('❌ 未捕獲的例外:', error);
  gracefulShutdown('uncaughtException');
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ 未處理的 Promise 拒絕:', reason);
  gracefulShutdown('unhandledRejection');
});

// 初始化服務（適用於 Vercel serverless 環境）
if (process.env.VERCEL) {
  // Vercel serverless 環境：立即初始化服務
  console.log('🔧 Vercel serverless 環境初始化');
  
  // 初始化基本設定服務
  try {
    basicSettingsService = new BasicSettingsService(pool);
    setDbSetupBasicSettingsService(basicSettingsService);
    console.log('⚙️  基本設定服務已初始化');
  } catch (error) {
    console.error('❌ 基本設定服務初始化失敗:', error);
  }

  // 初始化LINE通知服務
  try {
    lineNotificationService = new LineNotificationService();
    console.log('🔔 LINE通知服務已初始化');
  } catch (error) {
    console.error('❌ LINE通知服務初始化失敗:', error);
  }
  
  // 初始化價格變動通知服務
  try {
    priceChangeNotificationService = new PriceChangeNotificationService(
      demoMode ? null : pool, 
      lineNotificationService,
      // 這裡會在基本設定載入後更新
      {}
    );
    console.log('💰 價格變動通知服務已初始化');
  } catch (error) {
    console.error('❌ 價格變動通知服務初始化失敗:', error);
  }
} else {
  // 本地開發環境：啟動伺服器
  const server = app.listen(port, () => {
    console.log(`🚀 chengyivegetable 系統正在監聽埠號 ${port}`);
    console.log(`📱 前台網址: http://localhost:${port}`);
    console.log(`⚙️  管理後台: http://localhost:${port}/admin`);
    console.log(`🤖 Agent 管理: http://localhost:${port}/api/admin/agents/status`);
    console.log(`🌍 環境: ${process.env.NODE_ENV || 'development'}`);
    
    // 初始化WebSocket服務（已簡化）
    if (!demoMode) {
      try {
        // webSocketManager = new WebSocketManager(server); // 已移除
        // setWebSocketManager(webSocketManager);
        console.log(`📡 WebSocket 功能已簡化`);
      } catch (error) {
        console.error('❌ WebSocket 初始化失敗:', error);
      }
    }
    
    // 初始化基本設定服務
    try {
      basicSettingsService = new BasicSettingsService(pool);
      setDbSetupBasicSettingsService(basicSettingsService);
      console.log('⚙️  基本設定服務已初始化');
    } catch (error) {
      console.error('❌ 基本設定服務初始化失敗:', error);
    }

    // 初始化LINE通知服務
    try {
      lineNotificationService = new LineNotificationService();
      console.log('🔔 LINE通知服務已初始化');
    } catch (error) {
      console.error('❌ LINE通知服務初始化失敗:', error);
    }
    
    // 初始化價格變動通知服務
    try {
      priceChangeNotificationService = new PriceChangeNotificationService(
        demoMode ? null : pool, 
        lineNotificationService,
        // 這裡會在基本設定載入後更新
        {}
      );
      console.log('💰 價格變動通知服務已初始化');
    } catch (error) {
      console.error('❌ 價格變動通知服務初始化失敗:', error);
    }
    
    // LINE Bot服務已在上方初始化
  });
}

// =====================================
// 🗑️ 管理員專用：資料庫重置端點
// =====================================

// 測試端點 - 確認API可用
app.get('/api/admin/reset-test', ensureAdmin, (req, res) => {
  res.json({
    success: true,
    message: '資料庫重置API已就緒',
    timestamp: new Date().toISOString()
  });
});

// 管理員專用：完全重置資料庫（危險操作！）
app.post('/api/admin/reset-database', ensureAdmin, asyncWrapper(async (req, res) => {
  try {
    const { confirmPassword, resetType } = req.body;
    
    // 二次確認密碼
    if (confirmPassword !== 'CONFIRM_RESET_DATABASE') {
      return res.status(400).json({
        success: false,
        message: '確認密碼錯誤。請輸入: CONFIRM_RESET_DATABASE'
      });
    }
    
    console.log('🗑️ 開始資料庫重置操作...');
    console.log('⚠️ 重置類型:', resetType);
    
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      if (resetType === 'complete') {
        // 完全重置：清除所有數據
        console.log('🧹 執行完全重置...');
        
        await client.query('DELETE FROM order_items');
        await client.query('DELETE FROM orders');
        await client.query('DELETE FROM products');
        await client.query('DELETE FROM categories');
        await client.query('DELETE FROM users');
        
        // 嘗試清理庫存表（如果存在）
        try {
          await client.query('DELETE FROM inventory');
          console.log('✅ 清理庫存表');
        } catch (err) {
          console.log('ℹ️ 庫存表不存在或已清空');
        }
        
        // 嘗試清理通知表（如果存在）
        try {
          await client.query("DELETE FROM notifications WHERE message LIKE '%測試%' OR message LIKE '%demo%'");
          console.log('✅ 清理測試通知');
        } catch (err) {
          console.log('ℹ️ 通知表不存在');
        }
        
        // 重置序列
        await client.query('ALTER SEQUENCE orders_id_seq RESTART WITH 1');
        await client.query('ALTER SEQUENCE order_items_id_seq RESTART WITH 1');
        await client.query('ALTER SEQUENCE products_id_seq RESTART WITH 1');
        await client.query('ALTER SEQUENCE users_id_seq RESTART WITH 1');
        
        try {
          await client.query('ALTER SEQUENCE categories_id_seq RESTART WITH 1');
        } catch (err) {
          console.log('ℹ️ categories序列不存在');
        }
        
      } else if (resetType === 'orders_only') {
        // 只清理訂單：保留商品數據
        console.log('📦 只清理訂單數據...');
        
        await client.query('DELETE FROM order_items');
        await client.query('DELETE FROM orders');
        await client.query('DELETE FROM users');
        
        await client.query('ALTER SEQUENCE orders_id_seq RESTART WITH 1');
        await client.query('ALTER SEQUENCE order_items_id_seq RESTART WITH 1');
        await client.query('ALTER SEQUENCE users_id_seq RESTART WITH 1');
      }
      
      await client.query('COMMIT');
      
      // 驗證清理結果
      const { rows: orderCount } = await client.query('SELECT COUNT(*) as count FROM orders');
      const { rows: productCount } = await client.query('SELECT COUNT(*) as count FROM products');
      const { rows: userCount } = await client.query('SELECT COUNT(*) as count FROM users');
      
      console.log('✅ 資料庫重置完成');
      console.log(`📊 剩餘數據 - 訂單: ${orderCount[0].count}, 商品: ${productCount[0].count}, 用戶: ${userCount[0].count}`);
      
      res.json({
        success: true,
        message: '資料庫重置成功',
        resetType: resetType,
        remainingData: {
          orders: parseInt(orderCount[0].count),
          products: parseInt(productCount[0].count),
          users: parseInt(userCount[0].count)
        }
      });
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('❌ 資料庫重置失敗:', error);
    res.status(500).json({
      success: false,
      message: '資料庫重置失敗: ' + error.message
    });
  }
}));

// 導出 app 供 Vercel serverless 使用
module.exports = app;