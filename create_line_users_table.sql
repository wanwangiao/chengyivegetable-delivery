-- 創建 LINE 用戶表
CREATE TABLE IF NOT EXISTS line_users (
  id SERIAL PRIMARY KEY,
  line_user_id TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  picture_url TEXT,
  status_message TEXT,
  is_verified BOOLEAN DEFAULT FALSE,
  verified_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_visit TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 創建索引以提高查詢性能
CREATE INDEX IF NOT EXISTS idx_line_users_line_user_id ON line_users(line_user_id);
CREATE INDEX IF NOT EXISTS idx_line_users_phone ON line_users(phone);
CREATE INDEX IF NOT EXISTS idx_line_users_is_verified ON line_users(is_verified);

-- 為現有 orders 表添加 line_user_id 關聯（如果不存在）
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'line_user_id'
  ) THEN
    ALTER TABLE orders ADD COLUMN line_user_id TEXT;
    CREATE INDEX IF NOT EXISTS idx_orders_line_user_id ON orders(line_user_id);
  END IF;
END $$;

-- 添加外鍵約束（可選，如果需要嚴格的關聯性）
-- ALTER TABLE orders ADD CONSTRAINT fk_orders_line_user_id 
-- FOREIGN KEY (line_user_id) REFERENCES line_users(line_user_id);

COMMENT ON TABLE line_users IS 'LINE 用戶資料表';
COMMENT ON COLUMN line_users.line_user_id IS 'LINE 平台用戶唯一識別碼';
COMMENT ON COLUMN line_users.display_name IS 'LINE 顯示名稱';
COMMENT ON COLUMN line_users.phone IS '綁定的電話號碼';
COMMENT ON COLUMN line_users.is_verified IS '是否已驗證電話號碼';