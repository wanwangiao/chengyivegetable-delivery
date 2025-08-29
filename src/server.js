const express = require('express'),
      session = require('express-session'),
      bodyParser = require('body-parser'),
      { Pool } = require('pg'),
      path = require('path'),
      helmet = require('helmet'),
      compression = require('compression'),
      cors = require('cors'),
      dns = require('dns');

require('dotenv').config();

dns.setDefaultResultOrder('ipv4first');
process.env.FORCE_IPV4 = '1';

const SUPABASE_IPv4_MAP = {
  'db.cywcuzgbuqmxjxwyrrsp.supabase.co': '18.206.107.106'
};

process.env.NODE_OPTIONS = '--dns-result-order=ipv4first';

const { apiLimiter, orderLimiter, loginLimiter } = require('./middleware/rateLimiter'),
      { validateOrderData, validateAdminPassword, sanitizeInput } = require('./middleware/validation'),
      { apiErrorHandler, pageErrorHandler, notFoundHandler, asyncWrapper } = require('./middleware/errorHandler'),
      { createAgentSystem } = require('./agents'),
      driverApiRoutes = require('./routes/driver_api'),
      customerApiRoutes = require('./routes/customer_api'),
      adminReportsApiRoutes = require('./routes/admin_reports_api'),
      { router: googleMapsApiRoutes, setDatabasePool: setGoogleMapsDatabasePool } = require('./routes/google_maps_api'),
      { router: websocketApiRoutes, setWebSocketManager } = require('./routes/websocket_api'),
      WebSocketManager = require('./services/WebSocketManager'),
      SmartRouteService = require('./services/SmartRouteService'),
      RouteOptimizationService = require('./services/RouteOptimizationService'),
      LineNotificationService = require('./services/LineNotificationService'),
      LineBotService = require('./services/LineBotService');

let agentSystem = null;
let smartRouteService = null;
let routeOptimizationService = null;
let webSocketManager = null;
let lineNotificationService = null;
let lineBotService = null;

const app = express(),
      port = process.env.PORT || 3000;

// 信任代理設定（Vercel 需要）
app.set('trust proxy', true);

let pool,
    demoMode = false;

async function createDatabasePool() {
  // 設置 Node.js 環境使用 UTF-8 編碼
  process.env.LC_ALL = 'zh_TW.UTF-8';
  process.env.LANG = 'zh_TW.UTF-8';
  
  console.log('🔧 開始嘗試資料庫連線...');
  console.log('🔍 環境變數檢查:');
  console.log('  DATABASE_URL:', process.env.DATABASE_URL ? '已設定' : '未設定');
  console.log('  NODE_ENV:', process.env.NODE_ENV);
  
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
        // 確保資料庫連線使用 UTF-8 編碼
        options: '--client_encoding=UTF8'
      });
      
      const testResult = await pool.query('SELECT NOW() as current_time');
      console.log('✅ 資料庫連線成功 (環境變數)', testResult.rows[0]);
      demoMode = false;
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
    const directIP = SUPABASE_IPv4_MAPPING['db.cywcuzgbuqmxjxwyrrsp.supabase.co'];
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
      max: 5
    });
    
    const testResult = await pool.query('SELECT NOW() as current_time');
    console.log('✅ 資料庫連線成功 (直接IP)', testResult.rows[0]);
    demoMode = false;
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
      max: 5
    });
    
    const testResult = await pool.query('SELECT NOW() as current_time');
    console.log('✅ 資料庫連線成功 (Supabase連線池)', testResult.rows[0]);
    demoMode = false;
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
    demoMode = false;
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
  
  // 最後選擇 - 啟用示範模式
  console.log('🔄 啟用示範模式 - 使用本機示範資料');
  demoMode = true;
  
  // 創建一個模擬的 pool 避免崩潰
  pool = {
    query: async (sql, params) => {
      console.log('📝 模擬SQL查詢:', sql.substring(0, 50));
      throw new Error('資料庫連線失敗，正在使用示範資料');
    },
    end: () => console.log('📴 模擬資料庫連線結束')
  };
  
  return pool;
}

// 初始化資料庫連線
createDatabasePool().then(async () => {
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
    console.log('🗺️ Google Maps API 服務已初始化');

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
  
  // 初始化智能路線服務
  try {
    smartRouteService = new SmartRouteService(pool);
    console.log('🧠 SmartRouteService 已初始化');
  } catch (error) {
    console.error('❌ SmartRouteService 初始化失敗:', error);
  }
  
  // 初始化路線優化服務
  try {
    routeOptimizationService = new RouteOptimizationService(pool);
    console.log('🚀 RouteOptimizationService 已初始化');
  } catch (error) {
    console.error('❌ RouteOptimizationService 初始化失敗:', error);
  }
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
    secure: process.env.NODE_ENV === 'production' && process.env.VERCEL_URL, // 生產環境使用secure
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7天有效期
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax' // 增強安全性
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
  req.app.locals.demoMode = demoMode;
  next();
});

// 外送員API路由
app.use('/api/driver', driverApiRoutes);

// 客戶端API路由
app.use('/api/customer', customerApiRoutes);

// 後台報表API路由
app.use('/api/admin/reports', adminReportsApiRoutes);

// Google Maps API路由
app.use('/api/maps', googleMapsApiRoutes);

// WebSocket API路由
app.use('/api/websocket', websocketApiRoutes);

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

// 示範產品資料
const demoProducts = [
  { id: 1, name: '🥬 有機高麗菜', price: 80, is_priced_item: false, unit_hint: '每顆' },
  { id: 2, name: '🍅 新鮮番茄', price: null, is_priced_item: true, unit_hint: '每公斤' },
  { id: 3, name: '🥬 青江菜', price: 40, is_priced_item: false, unit_hint: '每把' },
  { id: 4, name: '🥕 胡蘿蔔', price: null, is_priced_item: true, unit_hint: '每公斤' },
  { id: 5, name: '🥒 小黃瓜', price: 60, is_priced_item: false, unit_hint: '每包' },
  { id: 6, name: '🧅 洋蔥', price: null, is_priced_item: true, unit_hint: '每公斤' }
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
      const optionGroupsResult = await pool.query(`
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
    console.log('❌ 資料庫查詢失敗，切換到示範模式:', error.message);
    demoMode = true;
    return demoProducts;
  }
}

// 前台：首頁，列出商品
app.get('/', async (req, res, next) => {
  try {
    const products = await fetchProducts();
    res.render('index', { 
      products: products,
      sessionLine: req.session.line || null
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
  const { phone, password } = req.body;
  
  try {
    // 這裡可以從資料庫驗證外送員
    // 暫時使用預設帳號：手機 0912345678，密碼 driver123
    if (phone === '0912345678' && password === 'driver123') {
      req.session.driverId = 1;
      req.session.driverName = '李大明';
      return res.redirect('/driver/dashboard');
    }
    
    res.render('driver_login', { error: '手機號碼或密碼錯誤' });
  } catch (error) {
    console.error('外送員登入錯誤:', error);
    res.render('driver_login', { error: '登入失敗，請重試' });
  }
});

// 🚛 外送員工作台
app.get('/driver/dashboard', ensureDriverPage, (req, res) => {
  
  res.render('driver_dashboard', {
    driver: {
      id: req.session.driverId,
      name: req.session.driverName || '外送員'
    }
  });
});

// 🚀 外送員PWA工作台
app.get('/driver', ensureDriverPage, (req, res) => {
  
  res.render('driver_pwa', {
    driver: {
      id: req.session.driverId,
      name: req.session.driverName || '外送員'
    }
  });
});

// 🚛 外送員通訊中心
app.get('/driver/chat', ensureDriverPage, (req, res) => {
  
  res.render('driver_chat', {
    driver: {
      id: req.session.driverId,
      name: req.session.driverName || '外送員',
      phone: req.session.driverPhone || ''
    }
  });
});

// 🚛 外送員登出
app.get('/driver/logout', (req, res) => {
  console.log(`🚛 外送員登出: ${req.session.driverName || 'Unknown'}`);
  cleanupSession(req);
  res.redirect('/driver/login');
});

// 🛰️ 外送員GPS追蹤工作台
app.get('/driver/dashboard-gps', ensureDriverPage, (req, res) => {
  
  res.render('driver_dashboard_gps', {
    driver: {
      id: req.session.driverId,
      name: req.session.driverName || '外送員'
    }
  });
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
          AND status = 'completed' 
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
        SET status = 'completed', 
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

// 前台：結帳頁
app.get('/checkout', (req, res) => {
  res.render('checkout');
});

// API：提交訂單
app.post('/api/orders', orderLimiter, sanitizeInput, validateOrderData, asyncWrapper(async (req, res) => {
  const { name, phone, address, notes, paymentMethod, items } = req.body;
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
    console.log('Creating order with data:', { name, phone, address, notes, paymentMethod, subtotal, deliveryFee, total });
    // 簡化插入，只使用存在的欄位
    const insertOrder = await pool.query(
      'INSERT INTO orders (contact_name, contact_phone, address, notes, subtotal, delivery_fee, total_amount, status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id',
      [name, phone, address, notes || '', subtotal, deliveryFee, total, 'placed']
    );
    const orderId = insertOrder.rows[0].id;
    
    // 🔄 自動扣庫存 - 調用InventoryAgent預留庫存
    try {
      if (agentSystem) {
        const inventoryItems = orderItems
          .filter(item => !item.is_priced_item) // 只有固定價格商品需要扣庫存
          .map(item => ({
            productId: item.product_id,
            name: item.name,
            quantity: item.quantity,
            unit: item.selectedUnit // 傳遞客戶選擇的單位
          }));
        
        if (inventoryItems.length > 0) {
          await agentSystem.executeTask('InventoryAgent', 'reserve_stock', {
            orderId: orderId,
            items: inventoryItems
          });
          console.log(`✅ 訂單 #${orderId} 庫存預留完成: ${inventoryItems.length} 項商品`);
        }
      }
    } catch (inventoryError) {
      console.error(`❌ 庫存預留失敗 (訂單 #${orderId}):`, inventoryError.message);
      // 庫存預留失敗不影響訂單建立，但要記錄錯誤
      // 管理員可以在後台手動處理庫存
    }
    
    // 插入品項
    for (const item of orderItems) {
      await pool.query(
        'INSERT INTO order_items (order_id, product_id, name, is_priced_item, quantity, unit_price, line_total, actual_weight) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
        [orderId, item.product_id, item.name, item.is_priced_item, item.quantity, item.unit_price, item.line_total, item.actual_weight]
      );
    }
    // 若已綁定 LINE，將用戶資料寫入 users 表
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
      error: err.message, // 暫時在生產環境也顯示錯誤信息
      errorCode: err.code,
      debug: err.stack
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
// 前台：訂單成功頁（供外部連結使用）
app.get('/order-success', async (req, res) => {
  const id = parseInt(req.query.id, 10);
  if (!id) return res.status(400).send('訂單不存在');
  
  if (demoMode) {
    // 示範模式：顯示模擬訂單成功頁
    const mockOrder = {
      id: id,
      contact_name: '示範用戶',
      total: 200,
      status: 'placed',
      created_at: new Date()
    };
    return res.render('order_success', { order: mockOrder });
  }
  
  try {
    const { rows: orders } = await pool.query('SELECT * FROM orders WHERE id=$1', [id]);
    if (orders.length === 0) return res.status(404).send('訂單不存在');
    const order = orders[0];
    res.render('order_success', { order });
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
  const { password } = req.body;
  const adminPassword = process.env.ADMIN_PASSWORD || 'shnf830629';
  
  console.log('登入嘗試 - 輸入密碼:', password);
  console.log('期望密碼:', adminPassword);
  
  if (password === adminPassword) {
    req.session.isAdmin = true;
    req.session.loginTime = new Date();
    console.log('登入成功，重導向到 dashboard');
    return res.redirect('/admin/dashboard');
  }
  
  console.log('密碼錯誤');
  res.render('admin_login', { error: '密碼錯誤' });
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

// 外送員驗證中介 - 統一Session檢查
function ensureDriver(req, res, next) {
  // Session健康檢查
  if (!req.session) {
    console.warn('⚠️ ensureDriver: Session不存在');
    return res.status(401).json({ success: false, message: '請先登入' });
  }
  
  // 檢查外送員權限
  if (req.session.driverId) {
    // 更新最後活動時間
    req.session.lastActivity = new Date();
    
    // 檢查Session是否過期（額外安全檢查）
    if (req.session.lastActivity && 
        (new Date() - new Date(req.session.lastActivity)) > 7 * 24 * 60 * 60 * 1000) {
      console.warn('⚠️ ensureDriver: Session已過期，清理並返回錯誤');
      cleanupSession(req);
      return res.status(401).json({ success: false, message: 'Session已過期，請重新登入' });
    }
    
    return next();
  }
  
  return res.status(401).json({ success: false, message: '請先登入' });
}

// 外送員頁面驗證中介（用於頁面路由）
function ensureDriverPage(req, res, next) {
  // Session健康檢查
  if (!req.session || !req.session.driverId) {
    console.warn('⚠️ ensureDriverPage: Session不存在或未登入，重定向到登入');
    return res.redirect('/driver/login');
  }
  
  // 更新最後活動時間
  req.session.lastActivity = new Date();
  return next();
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

// 🚀 後台：路線優化管理頁面
app.get('/admin/route-optimization', ensureAdmin, async (req, res, next) => {
  try {
    res.render('admin_route_optimization');
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
  const { price, isPricedItem, unitHint } = req.body;
  try {
    const priceVal = price === '' || price === null ? null : parseFloat(price);
    const priced = isPricedItem === 'on' || isPricedItem === 'true';
    await pool.query(
      'UPDATE products SET price=$1, is_priced_item=$2, unit_hint=$3 WHERE id=$4',
      [priceVal, priced, unitHint || null, id]
    );
    res.redirect('/admin/products');
  } catch (err) {
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

// 🚀 API: 路線優化服務
app.post('/api/admin/route-optimization/generate', ensureAdmin, async (req, res) => {
  try {
    if (!routeOptimizationService) {
      return res.status(503).json({ 
        success: false, 
        message: '路線優化服務未初始化' 
      });
    }

    const options = req.body || {};
    const result = await routeOptimizationService.generateOptimizedRoutes(options);
    
    res.json(result);
  } catch (error) {
    console.error('路線優化失敗:', error);
    res.status(500).json({ 
      success: false, 
      message: '路線優化失敗', 
      error: error.message 
    });
  }
});

// 🚀 API: 路線優化服務狀態
app.get('/api/admin/route-optimization/status', ensureAdmin, async (req, res) => {
  try {
    if (!routeOptimizationService) {
      return res.json({ 
        initialized: false, 
        message: '路線優化服務未初始化' 
      });
    }

    const status = routeOptimizationService.getServiceStatus();
    res.json(status);
  } catch (error) {
    console.error('獲取路線優化狀態失敗:', error);
    res.status(500).json({ 
      success: false, 
      message: '獲取服務狀態失敗' 
    });
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
    
    const existingGroups = await pool.query(
      'SELECT id, name FROM product_option_groups WHERE product_id = $1',
      [cornId]
    );

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
    const finalResult = await pool.query(`
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
      LINE_CHANNEL_ACCESS_TOKEN: process.env.LINE_CHANNEL_ACCESS_TOKEN ? 'SET (length: ' + process.env.LINE_CHANNEL_ACCESS_TOKEN.length + ')' : 'MISSING'
    },
    lineBotService: lineBotService ? {
      initialized: true,
      demoMode: lineBotService.demoMode,
      hasClient: !!lineBotService.client
    } : 'NOT_INITIALIZED'
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
    // 關閉 WebSocket 管理器
    if (webSocketManager) {
      console.log('🔌 正在關閉 WebSocket 服務...');
      webSocketManager.close();
    }
    
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
      WHERE status IN ('confirmed', 'preparing', 'ready', 'delivering')
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

const OrderNotificationHook = require('./services/OrderNotificationHook');
const orderNotificationHook = new OrderNotificationHook(lineBotService, pool);

// LIFF 入口頁面
app.get('/liff-entry', (req, res) => {
  const liffId = process.env.LINE_LIFF_ID || '';
  res.render('liff_entry', { liffId });
});

// LINE Bot 測試頁面
app.get('/line-bot-test', (req, res) => {
  res.render('line_bot_test');
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
    
    // 將用戶資訊儲存到資料庫
    // 注意：這裡我們先儲存到 users 表，之後訂單建立時會關聯
    await pool.query(`
      INSERT INTO users (line_user_id, line_display_name, created_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (line_user_id) DO UPDATE SET
        line_display_name = EXCLUDED.line_display_name,
        updated_at = NOW()
    `, [lineUserId, displayName]);
    
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

// 啟動伺服器
const server = app.listen(port, () => {
  console.log(`🚀 chengyivegetable 系統正在監聽埠號 ${port}`);
  console.log(`📱 前台網址: http://localhost:${port}`);
  console.log(`⚙️  管理後台: http://localhost:${port}/admin`);
  console.log(`🤖 Agent 管理: http://localhost:${port}/api/admin/agents/status`);
  console.log(`🌍 環境: ${process.env.NODE_ENV || 'development'}`);
  
  // 初始化WebSocket服務
  if (!demoMode) {
    try {
      webSocketManager = new WebSocketManager(server);
      setWebSocketManager(webSocketManager);
      console.log(`🔌 WebSocket 服務已啟動: ws://localhost:${port}`);
    } catch (error) {
      console.error('❌ WebSocket 初始化失敗:', error);
    }
  }
  
  // 初始化LINE通知服務
  try {
    lineNotificationService = new LineNotificationService();
    console.log('🔔 LINE通知服務已初始化');
  } catch (error) {
    console.error('❌ LINE通知服務初始化失敗:', error);
  }
  
  // LINE Bot服務已在上方初始化
});