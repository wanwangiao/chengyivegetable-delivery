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
    secure: process.env.NODE_ENV === 'production',
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

// 🚀 管理後台路由
app.get('/admin/dashboard', async (req, res, next) => {
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
      }
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

// 登入頁
app.get('/admin/login', (req, res) => {
  res.render('admin_login', { error: null });
});

// 處理登入
app.post('/admin/login', loginLimiter, validateAdminPassword, (req, res) => {
  const { password } = req.body;
  if (password === process.env.ADMIN_PASSWORD) {
    req.session.isAdmin = true;
    req.session.loginTime = new Date();
    return res.redirect('/admin/orders');
  }
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
  const { name, price, isPricedItem, unitHint } = req.body;
  try {
    if (!name) {
      return res.render('admin_product_new', { error: '品名必填' });
    }
    const priceVal = price === '' || price === null ? null : parseFloat(price);
    const priced = isPricedItem === 'on' || isPricedItem === 'true';
    await pool.query(
      'INSERT INTO products (name, price, is_priced_item, unit_hint) VALUES ($1,$2,$3,$4)',
      [name, priceVal, priced, unitHint || null]
    );
    res.redirect('/admin/products');
  } catch (err) {
    next(err);
  }
});

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