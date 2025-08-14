-- 資料表結構定義

-- 商品表
CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  price NUMERIC,
  is_priced_item BOOLEAN NOT NULL DEFAULT FALSE,
  unit_hint TEXT
);

-- 使用者表，用於綁定 LINE 帳號
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  phone TEXT NOT NULL UNIQUE,
  name TEXT,
  line_user_id TEXT,
  line_display_name TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 訂單表
CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  contact_name TEXT NOT NULL,
  contact_phone TEXT NOT NULL,
  address TEXT NOT NULL,
  notes TEXT,
  invoice TEXT,
  subtotal NUMERIC NOT NULL DEFAULT 0,
  delivery_fee NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'placed',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  -- 新增座標欄位與地理資料狀態
  lat NUMERIC,
  lng NUMERIC,
  geocoded_at TIMESTAMP,
  geocode_status TEXT
);

-- 訂單品項表
CREATE TABLE IF NOT EXISTS order_items (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id),
  name TEXT NOT NULL,
  is_priced_item BOOLEAN NOT NULL DEFAULT FALSE,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC,
  line_total NUMERIC NOT NULL DEFAULT 0,
  actual_weight NUMERIC
);