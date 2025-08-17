const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const { Pool } = require('pg');
const path = require('path');
const helmet = require('helmet');
const compression = require('compression');
const cors = require('cors');
const dns = require('dns');
require('dotenv').config();

// 強制使用 IPv4 DNS 解析
dns.setDefaultResultOrder('ipv4first');

// 嘗試設置 Node.js 使用 IPv4
process.env.FORCE_IPV4 = '1';

// 導入中間件
const { apiLimiter, orderLimiter, loginLimiter } = require('./middleware/rateLimiter');
const { validateOrderData, validateAdminPassword, sanitizeInput } = require('./middleware/validation');
const { apiErrorHandler, pageErrorHandler, notFoundHandler, asyncWrapper } = require('./middleware/errorHandler');

const app = express();
const port = process.env.PORT || 3000;

// PostgreSQL 連線配置 - 嘗試多種連線方法
let pool;
let demoMode = false;

async function createDatabasePool() {
  console.log('🔧 開始嘗試資料庫連線...');
  
  // 方法1: 嘗試使用 IPv4 強制解析
  console.log('方法1: 嘗試強制 IPv4 連線...');
  try {
    // 設置更多的 IPv4 強制選項
    const connectionConfig = {
      host: 'db.siwnqjavjljhicekloss.supabase.co',
      port: 5432,
      database: 'postgres',
      user: 'postgres', 
      password: '@Chengyivegetable',
      ssl: { 
        rejectUnauthorized: false,
        sslmode: 'require'
      },
      connectionTimeoutMillis: 15000,
      idleTimeoutMillis: 5000,
      max: 3,
      // 強制 IPv4
      family: 4,
      // 額外的網路設定
      keepAlive: true,
      keepAliveInitialDelayMillis: 0
    };
    
    pool = new Pool(connectionConfig);
    
    // 測試連線
    const testResult = await pool.query('SELECT 1 as test');
    console.log('✅ 資料庫連線成功 (IPv4強制連線)', testResult.rows[0]);
    demoMode = false;
    return pool;
    
  } catch (error1) {
    console.log('❌ IPv4強制連線失敗:', error1.code, error1.message);
    
    // 方法2: 嘗試連線字串方式
    console.log('方法2: 嘗試連線字串...');
    try {
      const connectionString = 'postgresql://postgres:%40Chengyivegetable@db.siwnqjavjljhicekloss.supabase.co:5432/postgres?sslmode=require';
      
      pool = new Pool({
        connectionString,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 15000,
        family: 4
      });
      
      await pool.query('SELECT 1');
      console.log('✅ 資料庫連線成功 (連線字串)');
      demoMode = false;
      return pool;
      
    } catch (error2) {
      console.log('❌ 連線字串也失敗:', error2.code, error2.message);
      
      // 方法3: 啟用示範模式
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
  }
}

// 初始化資料庫連線
createDatabasePool().catch(console.error);

// 設定 view engine 與靜態檔案
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));
app.use(express.static(path.join(__dirname, '../public')));

// 處理 favicon.ico 請求
app.get('/favicon.ico', (req, res) => {
  res.status(204).send(); // 返回 204 No Content
});

// 安全性中間件 - 暫時禁用 CSP 來修復 502 錯誤
app.use(helmet({
  contentSecurityPolicy: false // 暫時禁用 CSP
}));

// 壓縮回應
app.use(compression());

// CORS設定
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? [process.env.FRONTEND_URL] 
    : ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true
}));

// 一般API限制
app.use('/api/', apiLimiter);

// 解析請求體
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: false, limit: '10mb' }));

// Session配置
app.use(session({
  secret: process.env.SESSION_SECRET || 'chengyi-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // 暫時關閉 secure 要求，以便排查問題
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24小時
  }
}));

// 將 LINE 綁定狀態傳遞至所有模板
app.use((req, res, next) => {
  res.locals.sessionLine = req.session ? req.session.line : null;
  next();
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
    
    const { rows } = await pool.query('SELECT * FROM products ORDER BY id');
    console.log('✅ 成功從資料庫獲取', rows.length, '個產品');
    return rows;
    
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
app.get('/driver/dashboard', (req, res) => {
  if (!req.session.driverId) {
    return res.redirect('/driver/login');
  }
  
  res.render('driver_dashboard', {
    driver: {
      id: req.session.driverId,
      name: req.session.driverName || '外送員'
    }
  });
});

// 🚛 外送員登出
app.get('/driver/logout', (req, res) => {
  req.session.driverId = null;
  req.session.driverName = null;
  res.redirect('/driver/login');
});

// 🚛 外送員API - 可接訂單
app.get('/api/driver/available-orders', async (req, res) => {
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

// 🚛 外送員API - 統計數據
app.get('/api/driver/stats', async (req, res) => {
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
    
    res.json({ success: true, message: '配送完成' });
  } catch (error) {
    console.error('完成配送失敗:', error);
    res.status(500).json({ success: false, message: '完成配送失敗，請重試' });
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
  const { name, phone, address, notes, invoice, items } = req.body;
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
      const { productId, quantity } = it;
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
        actual_weight: null
      });
    }
    const deliveryFee = subtotal >= 200 ? 0 : 50;
    const total = subtotal + deliveryFee;
    // 進行地理編碼
    const geo = await geocodeAddress(address);
    // 建立訂單，儲存座標與地理狀態
    const insertOrder = await pool.query(
      'INSERT INTO orders (contact_name, contact_phone, address, notes, invoice, subtotal, delivery_fee, total, status, lat, lng, geocoded_at, geocode_status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW(),$12) RETURNING id',
      [name, phone, address, notes || '', invoice || '', subtotal, deliveryFee, total, 'placed', geo.lat, geo.lng, geo.status]
    );
    const orderId = insertOrder.rows[0].id;
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
      message: '建立訂單時發生錯誤，請稍後再試' 
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

// 登出
app.get('/admin/logout', (req, res) => {
  req.session.isAdmin = false;
  req.session.destroy(() => {
    res.redirect('/admin/login');
  });
});

// 管理員驗證中介
function ensureAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) {
    return next();
  }
  return res.redirect('/admin/login');
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
// 管理員地圖頁
app.get('/admin/map', ensureAdmin, (req, res) => {
  // 讓前端取得 API 金鑰
  res.render('admin_map', {
    googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY
  });
});

// 返回含座標的訂單清單
app.get('/api/admin/orders-geo', ensureAdmin, async (req, res) => {
  if (demoMode) {
    res.json({ orders: [] });
    return;
  }
  
  try {
    const { rows: orders } = await pool.query('SELECT id, contact_name, contact_phone, address, status, total, lat, lng FROM orders WHERE lat IS NOT NULL AND lng IS NOT NULL');
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
  const { name, price, isPricedItem, unitHint, initialStock, minStockAlert, supplierName } = req.body;
  
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
      // 新增商品
      const productResult = await pool.query(
        'INSERT INTO products (name, price, is_priced_item, unit_hint) VALUES ($1,$2,$3,$4) RETURNING id',
        [name, priceVal, priced, unitHint || null]
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
    const { productId, quantity, unitCost, supplierName, reason } = req.body;
    
    if (!demoMode && pool) {
      // 更新庫存數量
      await pool.query(`
        UPDATE inventory 
        SET current_stock = current_stock + $1, unit_cost = $2, supplier_name = $3, last_updated = CURRENT_TIMESTAMP
        WHERE product_id = $4
      `, [quantity, unitCost, supplierName, productId]);
      
      // 記錄進貨
      await pool.query(`
        INSERT INTO stock_movements (product_id, movement_type, quantity, unit_cost, reason, operator_name)
        VALUES ($1, 'in', $2, $3, $4, '管理員')
      `, [productId, quantity, unitCost, reason || '進貨補充']);
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

// 🚀 API：部署資料庫更新（執行商品新增和選項建立）
app.post('/api/admin/deploy-updates', ensureAdmin, async (req, res) => {
  if (demoMode) {
    return res.json({ 
      success: false, 
      message: '示範模式下無法執行資料庫更新',
      demo: true 
    });
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

// 404處理
app.use(notFoundHandler);

// API錯誤處理
app.use('/api/*', apiErrorHandler);

// 頁面錯誤處理
app.use(pageErrorHandler);

// 啟動伺服器
app.listen(port, () => {
  console.log(`🚀 chengyivegetable 系統正在監聽埠號 ${port}`);
  console.log(`📱 前台網址: http://localhost:${port}`);
  console.log(`⚙️  管理後台: http://localhost:${port}/admin`);
  console.log(`🌍 環境: ${process.env.NODE_ENV || 'development'}`);
});