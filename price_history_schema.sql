-- 價格歷史表結構定義
-- 用於追蹤商品價格變動和支援價格變動通知系統

-- 商品價格歷史表
CREATE TABLE IF NOT EXISTS product_price_history (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  price NUMERIC(10,2) NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_by VARCHAR(100) DEFAULT 'system',
  notes TEXT,
  UNIQUE(product_id, date)
);

-- 創建索引以提升查詢效能
CREATE INDEX IF NOT EXISTS idx_price_history_product_date ON product_price_history(product_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_price_history_date ON product_price_history(date DESC);

-- 價格變動通知記錄表
CREATE TABLE IF NOT EXISTS price_change_notifications (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  old_price NUMERIC(10,2) NOT NULL,
  new_price NUMERIC(10,2) NOT NULL,
  change_percent NUMERIC(5,2) NOT NULL,
  notification_sent_at TIMESTAMP DEFAULT NOW(),
  customer_response VARCHAR(20), -- 'accepted', 'cancelled', 'timeout'
  customer_response_at TIMESTAMP,
  line_user_id TEXT,
  status VARCHAR(20) DEFAULT 'sent' -- 'sent', 'responded', 'timeout'
);

-- 創建索引
CREATE INDEX IF NOT EXISTS idx_price_notifications_order ON price_change_notifications(order_id);
CREATE INDEX IF NOT EXISTS idx_price_notifications_status ON price_change_notifications(status, notification_sent_at);
CREATE INDEX IF NOT EXISTS idx_price_notifications_line_user ON price_change_notifications(line_user_id);

-- 插入示範價格歷史資料 (供測試使用)
INSERT INTO product_price_history (product_id, price, date, notes) 
SELECT 
  p.id,
  p.price * (0.85 + (RANDOM() * 0.3)), -- 昨日價格為目前價格的±15%變動
  CURRENT_DATE - INTERVAL '1 day',
  '系統初始化模擬昨日價格'
FROM products p
WHERE p.price IS NOT NULL AND p.price > 0
ON CONFLICT (product_id, date) DO NOTHING;

-- 創建自動記錄價格變動的觸發器函數
CREATE OR REPLACE FUNCTION record_price_change()
RETURNS TRIGGER AS $$
BEGIN
  -- 當商品價格更新時，自動記錄到價格歷史表
  IF NEW.price IS DISTINCT FROM OLD.price AND NEW.price IS NOT NULL THEN
    INSERT INTO product_price_history (product_id, price, date, created_by, notes)
    VALUES (
      NEW.id, 
      NEW.price, 
      CURRENT_DATE, 
      'price_update_trigger',
      '商品管理頁面價格更新'
    )
    ON CONFLICT (product_id, date) 
    DO UPDATE SET 
      price = EXCLUDED.price,
      created_at = NOW(),
      created_by = EXCLUDED.created_by,
      notes = EXCLUDED.notes;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 創建觸發器
DROP TRIGGER IF EXISTS product_price_change_trigger ON products;
CREATE TRIGGER product_price_change_trigger
  AFTER UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION record_price_change();

-- 註解說明
COMMENT ON TABLE product_price_history IS '商品價格歷史記錄表，用於追蹤每日價格變動';
COMMENT ON TABLE price_change_notifications IS '價格變動通知記錄表，追蹤發送給客戶的通知及回應';
COMMENT ON COLUMN product_price_history.date IS '價格生效日期（每個商品每天只有一個價格記錄）';
COMMENT ON COLUMN price_change_notifications.change_percent IS '價格變動百分比（正數為上漲，負數為下跌）';
COMMENT ON COLUMN price_change_notifications.status IS '通知狀態：sent(已發送), responded(客戶已回應), timeout(逾時)';