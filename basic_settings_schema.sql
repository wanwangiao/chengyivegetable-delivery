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

-- 基本設定管理表
-- 用於存儲系統的各種設定參數，支援分類管理

CREATE TABLE IF NOT EXISTS basic_settings (
  id SERIAL PRIMARY KEY,
  category VARCHAR(50) NOT NULL,
  key VARCHAR(100) NOT NULL,
  value TEXT,
  display_name VARCHAR(200),
  description TEXT,
  data_type VARCHAR(20) DEFAULT 'text',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(category, key)
);

-- 建立索引優化查詢效能
CREATE INDEX IF NOT EXISTS idx_basic_settings_category ON basic_settings(category);
CREATE INDEX IF NOT EXISTS idx_basic_settings_key ON basic_settings(category, key);

-- 建立更新時間自動觸發器
CREATE OR REPLACE FUNCTION update_basic_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER trigger_basic_settings_updated_at
  BEFORE UPDATE ON basic_settings
  FOR EACH ROW
  EXECUTE PROCEDURE update_basic_settings_updated_at();

-- 初始化預設設定值
INSERT INTO basic_settings (category, key, value, display_name, description, data_type) VALUES
-- 通知訊息設定
('notifications', 'packaging_complete', '🎉 您好！

📦 您的訂單已完成包裝，即將出貨！
🔢 訂單編號：#{orderId}
💰 訂單金額：${totalAmount}

⏰ 預計30分鐘內送達
📞 如有問題請來電：0912-345-678

🙏 謝謝您選擇誠憶鮮蔬！', '包裝完成通知', '訂單包裝完成時的通知訊息', 'textarea'),

('notifications', 'delivering', '🚚 您好！

🛵 您的訂單正在配送中！
🔢 訂單編號：#{orderId}
📍 預計很快送達您的地址

📞 如有問題請來電：0912-345-678

🙏 謝謝您選擇誠憶鮮蔬！', '配送中通知', '訂單配送中時的通知訊息', 'textarea'),

('notifications', 'delivered', '🎉 您好！

✅ 您的訂單已成功送達！
🔢 訂單編號：#{orderId}
💰 訂單金額：${totalAmount}

🌟 感謝您選擇誠憶鮮蔬！
❤️ 期待您的下次訂購

📞 如有任何問題請來電：0912-345-678', '送達完成通知', '訂單送達完成時的通知訊息', 'textarea'),

('notifications', 'price_increase', '⚠️ 價格異動通知

您的訂單 #{orderId} 中的【{productName}】價格有所調整：
💰 昨日參考價: ${oldPrice}
💰 今日實際價: ${newPrice}
📊 變動幅度: {changePercent}

如需調整訂單，請於30分鐘內至訂單管理頁面處理，逾時將視為接受此價格。

感謝您的理解 🙏', '價格上漲通知', '商品價格上漲時的通知模板', 'textarea'),

('notifications', 'price_decrease', '🎉 好消息！價格調降通知

您的訂單 #{orderId} 中的【{productName}】價格已調降：
💰 昨日參考價: ${oldPrice}
💰 今日實際價: ${newPrice}
📊 降幅: {changePercent}

系統已自動為您更新至最新優惠價格！

謝謝您的支持 ❤️', '價格下跌通知', '商品價格下跌時的通知模板', 'textarea'),

-- 主題色彩設定
('theme', 'primary_color', '#2d5a3d', '主要色彩', '網站主要品牌色彩', 'color'),
('theme', 'accent_color', '#7cb342', '強調色彩', '網站強調色彩', 'color'),
('theme', 'custom_css', '', '自訂CSS', '額外的自訂CSS樣式', 'textarea'),
('theme', 'font_family', '系統預設', '字體家族', '網站使用的字體', 'select'),

-- 商店基本資訊
('store', 'name', '誠憶鮮蔬', '商店名稱', '商店/品牌名稱', 'text'),
('store', 'slogan', '新鮮 × 健康 × 便利', '商店標語', '商店標語或slogan', 'text'),
('store', 'contact_phone', '0912-345-678', '聯絡電話', '商店聯絡電話', 'text'),
('store', 'contact_address', '台北市信義區信義路五段7號', '聯絡地址', '商店地址', 'text'),

-- 營業設定
('business', 'free_shipping_threshold', '300', '免運費門檻', '免運費的最低消費金額', 'number'),
('business', 'delivery_fee', '50', '配送費用', '基本配送費用', 'number'),
('business', 'minimum_order_amount', '100', '最低訂購金額', '最低訂購金額限制', 'number'),
('business', 'service_hours_start', '08:00', '營業開始時間', '每日營業開始時間', 'time'),
('business', 'service_hours_end', '20:00', '營業結束時間', '每日營業結束時間', 'time'),
('business', 'order_deadline_time', '11:00', '訂單截止時間', '當日訂單的截止時間', 'time'),
('business', 'next_day_open_time', '14:00', '隔日預訂開放時間', '隔日訂單開放預訂的時間', 'time'),

-- 營業日設定 (週一到週日)
('business_days', 'monday_enabled', 'true', '週一營業', '週一是否營業', 'boolean'),
('business_days', 'tuesday_enabled', 'true', '週二營業', '週二是否營業', 'boolean'),
('business_days', 'wednesday_enabled', 'true', '週三營業', '週三是否營業', 'boolean'),
('business_days', 'thursday_enabled', 'true', '週四營業', '週四是否營業', 'boolean'),
('business_days', 'friday_enabled', 'true', '週五營業', '週五是否營業', 'boolean'),
('business_days', 'saturday_enabled', 'true', '週六營業', '週六是否營業', 'boolean'),
('business_days', 'sunday_enabled', 'false', '週日營業', '週日是否營業', 'boolean'),

-- 功能開關設定
('features', 'line_notification_enabled', 'true', 'LINE 通知啟用', '是否啟用LINE通知功能', 'boolean'),
('features', 'sms_notification_enabled', 'false', 'SMS 通知啟用', '是否啟用簡訊通知功能', 'boolean'),
('features', 'auto_accept_orders', 'false', '自動接受訂單', '是否自動接受新訂單', 'boolean'),
('features', 'price_change_threshold', '15', '價格變動閾值(%)', '觸發價格異動通知的百分比閾值', 'number'),
('features', 'price_notification_timeout', '30', '價格通知回覆時限(分鐘)', '客戶回覆價格異動的時間限制', 'number'),

-- 進階主題設定
('theme_advanced', 'banner_enabled', 'true', '橫幅顯示啟用', '是否顯示頂部橫幅', 'boolean'),
('theme_advanced', 'announcement_enabled', 'true', '公告顯示啟用', '是否顯示重要公告', 'boolean'),
('theme_advanced', 'dark_mode_enabled', 'false', '暗黑模式啟用', '是否提供暗黑模式選項', 'boolean'),

-- 服務設定
('service', 'area', '台北市、新北市、桃園市', '服務區域', '目前提供服務的區域', 'text'),
('service', 'delivery_time_slots', '09:00-12:00
13:00-17:00
18:00-21:00', '配送時段', '可選擇的配送時段', 'textarea'),
('service', 'coverage_info', '目前開放台北市、新北市、桃園市部分區域配送服務', '配送範圍說明', '詳細的配送範圍說明', 'textarea'),

-- 頁面內容管理
('content', 'homepage_banner_text', '新鮮蔬果，送到您家', '首頁橫幅文字', '首頁主要橫幅文字', 'text'),
('content', 'about_us_content', '我們致力於提供最新鮮的蔬果給每一位客戶', '關於我們內容', '關於我們的介紹內容', 'textarea'),
('content', 'banner_image_url', 'https://lh3.googleusercontent.com/aida-public/AB6AXuAYdTdlixB_n8Zy86hYdXUVXOGl7hsTam3iliOOdgIsoqecsdP7UhM1ozScaYbdZb9f9nSJFTvYzh4wNmW1xO8dtv4cdTg4i5oEzI9zkTMP3d3nK5iH9hWtQpYYAoE2s8EVZloq9FpYJWxupyb4uKlJXHejcUAqs0fzI80q8JTx6wcfpGidZdAmOO94v437EZt4YwQg3J6XKaBaxM2PDov2Tm1ABBVZxWOITZWvk4jeniENA2cbJLThbeBLAcN0qSgyK8aMh7i-P1qV', '橫幅圖片網址', '頂部橫幅圖片的網址', 'url'),
('content', 'announcement_content', '<p><span class="font-semibold">服務範圍：</span>大台北地區（詳細請見店家資訊）。</p>
<p><span class="font-semibold">營業時間：</span>每日 08:00-20:00，週日公休。</p>
<p><span class="font-semibold">訂購說明：</span>當日11:00前訂購當天配送，14:00後開放隔日預訂。</p>', '重要公告內容', '網站重要公告HTML內容', 'html'),

-- 網站內容管理 (合併商店資訊和頁面內容)
('website_content', 'store_name', '誠憶鮮蔬', '商店名稱', '網站顯示的商店名稱', 'text'),
('website_content', 'store_tagline', '新鮮蔬果，品質保證', '商店副標題', '商店的副標題或描述', 'text'),
('website_content', 'banner_image_url', 'https://lh3.googleusercontent.com/aida-public/AB6AXuAYdTdlixB_n8Zy86hYdXUVXOGl7hsTam3iliOOdgIsoqecsdP7UhM1ozScaYbdZb9f9nSJFTvYzh4wNmW1xO8dtv4cdTg4i5oEzI9zkTMP3d3nK5iH9hWtQpYYAoE2s8EVZloq9FpYJWxupyb4uKlJXHejcUAqs0fzI80q8JTx6wcfpGidZdAmOO94v437EZt4YwQg3J6XKaBaxM2PDov2Tm1ABBVZxWOITZWvk4jeniENA2cbJLThbeBLAcN0qSgyK8aMh7i-P1qV', '頂部橫幅圖片網址', '網站頂部顯示的橫幅圖片', 'url'),
('website_content', 'announcement_content', '<p><span class="font-semibold">服務範圍：</span>大台北地區（詳細請見店家資訊）。</p>
<p><span class="font-semibold">營業時間：</span>每日 08:00-20:00，週日公休。</p>
<p><span class="font-semibold">訂購說明：</span>當日11:00前訂購當天配送，14:00後開放隔日預訂。</p>', '重要公告HTML內容', '顯示在網站上的重要公告內容', 'html'),

-- 移動端設定
('mobile', 'app_enabled', 'true', '移動應用啟用', '是否啟用移動端優化', 'boolean'),
('mobile', 'pwa_enabled', 'true', 'PWA 功能啟用', '是否啟用Progressive Web App功能', 'boolean'),
('mobile', 'touch_optimized', 'true', '觸控優化', '是否啟用觸控操作優化', 'boolean')

ON CONFLICT (category, key) DO UPDATE SET
  value = EXCLUDED.value,
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  data_type = EXCLUDED.data_type,
  updated_at = CURRENT_TIMESTAMP;

-- 建立查詢函數方便使用
CREATE OR REPLACE FUNCTION get_setting(p_category VARCHAR, p_key VARCHAR)
RETURNS TEXT AS $$
DECLARE
  result TEXT;
BEGIN
  SELECT value INTO result 
  FROM basic_settings 
  WHERE category = p_category AND key = p_key;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- 建立批量查詢函數
CREATE OR REPLACE FUNCTION get_settings_by_category(p_category VARCHAR)
RETURNS TABLE(key VARCHAR, value TEXT, display_name VARCHAR, data_type VARCHAR) AS $$
BEGIN
  RETURN QUERY
  SELECT s.key, s.value, s.display_name, s.data_type
  FROM basic_settings s
  WHERE s.category = p_category
  ORDER BY s.key;
END;
$$ LANGUAGE plpgsql;