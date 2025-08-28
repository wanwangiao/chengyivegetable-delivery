-- ========================================
-- 公共池配送系統資料庫架構設計
-- ========================================

-- 擴展現有 orders 表，增加公共池相關欄位
ALTER TABLE orders ADD COLUMN IF NOT EXISTS pool_district VARCHAR(20);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS pool_entered_at TIMESTAMP;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS pool_status VARCHAR(20) DEFAULT 'available';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS selected_by_driver INTEGER;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS selected_at TIMESTAMP;

-- 建立區域配送池表
CREATE TABLE IF NOT EXISTS delivery_pools (
    id SERIAL PRIMARY KEY,
    district VARCHAR(20) NOT NULL,
    display_name VARCHAR(50) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 插入預設配送區域
INSERT INTO delivery_pools (district, display_name) VALUES 
('三峽區', '三峽區'),
('樹林區', '樹林區'),
('土城區', '土城區'),
('鶯歌區', '鶯歌區')
ON CONFLICT DO NOTHING;

-- 建立外送員訂單選擇表
CREATE TABLE IF NOT EXISTS driver_order_selections (
    id SERIAL PRIMARY KEY,
    driver_id INTEGER NOT NULL REFERENCES drivers(id),
    order_id INTEGER NOT NULL REFERENCES orders(id),
    district VARCHAR(20) NOT NULL,
    selected_at TIMESTAMP DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true,
    route_position INTEGER, -- 在優化路線中的位置
    estimated_delivery_time TIMESTAMP,
    
    UNIQUE(driver_id, order_id),
    INDEX idx_driver_selections (driver_id, is_active),
    INDEX idx_district_selections (district, is_active),
    INDEX idx_order_selections (order_id, is_active)
);

-- 建立路線優化批次表
CREATE TABLE IF NOT EXISTS route_optimization_batches (
    id SERIAL PRIMARY KEY,
    driver_id INTEGER NOT NULL REFERENCES drivers(id),
    batch_name VARCHAR(100),
    start_location_lat DECIMAL(10, 8) DEFAULT 24.934154, -- 三峽區民生街186號
    start_location_lng DECIMAL(11, 8) DEFAULT 121.368540,
    start_address VARCHAR(200) DEFAULT '新北市三峽區民生街186號',
    total_orders INTEGER DEFAULT 0,
    total_distance DECIMAL(8, 2), -- 總距離(公里)
    estimated_total_time INTEGER, -- 預估總時間(分鐘)
    optimization_method VARCHAR(50) DEFAULT 'tsp', -- TSP算法
    status VARCHAR(20) DEFAULT 'planned', -- planned, executing, completed
    created_at TIMESTAMP DEFAULT NOW(),
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    
    INDEX idx_driver_batches (driver_id, status),
    INDEX idx_batch_status (status, created_at)
);

-- 建立路線優化詳細路線表
CREATE TABLE IF NOT EXISTS route_optimization_routes (
    id SERIAL PRIMARY KEY,
    batch_id INTEGER NOT NULL REFERENCES route_optimization_batches(id) ON DELETE CASCADE,
    order_id INTEGER NOT NULL REFERENCES orders(id),
    route_sequence INTEGER NOT NULL, -- 配送順序
    estimated_travel_time INTEGER, -- 到該點預估時間(分鐘)
    estimated_arrival_time TIMESTAMP,
    distance_from_previous DECIMAL(6, 2), -- 從前一點的距離(公里)
    actual_arrival_time TIMESTAMP,
    delivery_status VARCHAR(20) DEFAULT 'planned', -- planned, traveling, arrived, delivered
    notes TEXT,
    
    INDEX idx_batch_routes (batch_id, route_sequence),
    INDEX idx_order_routes (order_id)
);

-- 建立地址區域識別配置表
CREATE TABLE IF NOT EXISTS address_district_mapping (
    id SERIAL PRIMARY KEY,
    district VARCHAR(20) NOT NULL,
    keywords TEXT[] NOT NULL, -- 用於識別地址關鍵字
    priority INTEGER DEFAULT 1, -- 匹配優先級
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 插入地址識別關鍵字
INSERT INTO address_district_mapping (district, keywords, priority) VALUES 
('三峽區', ARRAY['三峽區', '三峽', '北大', '北大特區', '台北大學'], 1),
('樹林區', ARRAY['樹林區', '樹林'], 2),
('土城區', ARRAY['土城區', '土城'], 3),
('鶯歌區', ARRAY['鶯歌區', '鶯歌'], 4)
ON CONFLICT DO NOTHING;

-- 建立外送員公共池儀表板設定表
CREATE TABLE IF NOT EXISTS driver_pool_preferences (
    id SERIAL PRIMARY KEY,
    driver_id INTEGER NOT NULL REFERENCES drivers(id),
    preferred_districts TEXT[] DEFAULT ARRAY['三峽區', '樹林區', '土城區', '鶯歌區'],
    max_orders_per_batch INTEGER DEFAULT 15,
    auto_refresh_interval INTEGER DEFAULT 30, -- 秒
    show_distance_estimates BOOLEAN DEFAULT true,
    show_earnings_estimates BOOLEAN DEFAULT true,
    notification_enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(driver_id)
);

-- 建立訂單入池觸發器函數
CREATE OR REPLACE FUNCTION trigger_order_enter_pool()
RETURNS TRIGGER AS $$
BEGIN
    -- 當訂單狀態變為 'packed' 或 'ready' 時，自動進入公共池
    IF NEW.status IN ('packed', 'ready') AND (OLD.status IS NULL OR OLD.status NOT IN ('packed', 'ready')) THEN
        -- 自動識別區域
        NEW.pool_district := get_district_from_address(NEW.address);
        NEW.pool_entered_at := NOW();
        NEW.pool_status := 'available';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 建立地址區域識別函數
CREATE OR REPLACE FUNCTION get_district_from_address(address TEXT)
RETURNS VARCHAR(20) AS $$
DECLARE
    mapping RECORD;
    keyword TEXT;
BEGIN
    -- 按優先級順序檢查關鍵字匹配
    FOR mapping IN 
        SELECT district, keywords 
        FROM address_district_mapping 
        WHERE is_active = true 
        ORDER BY priority ASC
    LOOP
        FOREACH keyword IN ARRAY mapping.keywords
        LOOP
            IF address ILIKE '%' || keyword || '%' THEN
                RETURN mapping.district;
            END IF;
        END LOOP;
    END LOOP;
    
    -- 如果沒有匹配，返回其他區域
    RETURN '其他區域';
END;
$$ LANGUAGE plpgsql;

-- 建立觸發器
DROP TRIGGER IF EXISTS tr_order_enter_pool ON orders;
CREATE TRIGGER tr_order_enter_pool
    BEFORE UPDATE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION trigger_order_enter_pool();

-- 建立公共池統計視圖
CREATE OR REPLACE VIEW public_pool_stats AS
SELECT 
    pool_district as district,
    COUNT(*) as total_orders,
    COUNT(*) FILTER (WHERE pool_status = 'available') as available_orders,
    COUNT(*) FILTER (WHERE pool_status = 'selected') as selected_orders,
    SUM(total_amount) as total_value,
    AVG(total_amount) as avg_order_value,
    MIN(pool_entered_at) as oldest_order,
    MAX(pool_entered_at) as newest_order
FROM orders 
WHERE pool_entered_at IS NOT NULL 
  AND status IN ('packed', 'ready')
GROUP BY pool_district;

-- 建立外送員當前選擇統計視圖
CREATE OR REPLACE VIEW driver_current_selections AS
SELECT 
    d.id as driver_id,
    d.name as driver_name,
    COUNT(dos.id) as selected_count,
    ARRAY_AGG(DISTINCT dos.district) as selected_districts,
    SUM(o.total_amount) as total_value,
    MIN(dos.selected_at) as first_selection,
    MAX(dos.selected_at) as last_selection
FROM drivers d
LEFT JOIN driver_order_selections dos ON d.id = dos.driver_id AND dos.is_active = true
LEFT JOIN orders o ON dos.order_id = o.id
GROUP BY d.id, d.name;

-- 建立索引以提升性能
CREATE INDEX IF NOT EXISTS idx_orders_pool_district ON orders(pool_district, pool_status);
CREATE INDEX IF NOT EXISTS idx_orders_pool_entered ON orders(pool_entered_at);
CREATE INDEX IF NOT EXISTS idx_orders_pool_status ON orders(pool_status, pool_entered_at);
CREATE INDEX IF NOT EXISTS idx_orders_address_search ON orders USING gin(to_tsvector('simple', address));

-- 建立公共池訂單獲取函數
CREATE OR REPLACE FUNCTION get_pool_orders_by_district(target_district VARCHAR(20))
RETURNS TABLE(
    id INTEGER,
    contact_name VARCHAR(100),
    contact_phone VARCHAR(20),
    address TEXT,
    total_amount DECIMAL(10,2),
    payment_method VARCHAR(50),
    notes TEXT,
    pool_entered_at TIMESTAMP,
    waiting_minutes INTEGER,
    is_selected BOOLEAN,
    selected_by_driver INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        o.id,
        o.contact_name,
        o.contact_phone,
        o.address,
        o.total_amount,
        o.payment_method,
        o.notes,
        o.pool_entered_at,
        EXTRACT(EPOCH FROM (NOW() - o.pool_entered_at))/60 AS waiting_minutes,
        CASE WHEN o.pool_status = 'selected' THEN true ELSE false END AS is_selected,
        o.selected_by_driver
    FROM orders o
    WHERE o.pool_district = target_district
      AND o.status IN ('packed', 'ready')
      AND o.pool_entered_at IS NOT NULL
    ORDER BY o.pool_entered_at ASC;
END;
$$ LANGUAGE plpgsql;

-- 建立路線優化準備函數
CREATE OR REPLACE FUNCTION prepare_route_optimization(p_driver_id INTEGER)
RETURNS TABLE(
    order_id INTEGER,
    address TEXT,
    lat DECIMAL(10,8),
    lng DECIMAL(11,8),
    district VARCHAR(20),
    customer_name VARCHAR(100),
    phone VARCHAR(20),
    payment_method VARCHAR(50),
    notes TEXT,
    total_amount DECIMAL(10,2)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        o.id,
        o.address,
        o.lat,
        o.lng,
        o.pool_district,
        o.contact_name,
        o.contact_phone,
        o.payment_method,
        o.notes,
        o.total_amount
    FROM orders o
    INNER JOIN driver_order_selections dos ON o.id = dos.order_id
    WHERE dos.driver_id = p_driver_id 
      AND dos.is_active = true
      AND o.pool_status = 'selected'
    ORDER BY dos.selected_at ASC;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- 示例資料插入（測試用）
-- ========================================

-- 建立測試外送員
INSERT INTO drivers (name, phone, password_hash, status) VALUES
('王小明', '0912345001', 'driver123', 'online'),
('李小華', '0912345002', 'driver123', 'online')
ON CONFLICT (phone) DO NOTHING;

-- 建立測試訂單並自動進入公共池
INSERT INTO orders (contact_name, contact_phone, address, total_amount, payment_method, notes, status, created_at, lat, lng) VALUES
('張先生', '0912345678', '新北市三峽區大學路1號', 350.00, '現金', '請按電鈴', 'packed', NOW() - INTERVAL '30 minutes', 24.9347, 121.5681),
('林小姐', '0987654321', '新北市樹林區中山路100號', 280.00, 'LINE Pay', '放門口即可', 'packed', NOW() - INTERVAL '45 minutes', 24.9939, 121.4236),
('陳太太', '0955123456', '新北市土城區中央路88號', 420.00, '現金', '2樓', 'packed', NOW() - INTERVAL '20 minutes', 24.9733, 121.4429),
('黃先生', '0933987654', '新北市鶯歌區文化路55號', 195.00, '信用卡', '請勿按電鈴', 'packed', NOW() - INTERVAL '60 minutes', 24.9542, 121.3546)
ON CONFLICT DO NOTHING;

-- 提交所有更改
COMMIT;

-- ========================================
-- 使用說明與重要注意事項
-- ========================================

/*
重要功能說明：

1. 訂單自動入池：
   - 當訂單狀態變為 'packed' 或 'ready' 時自動觸發
   - 根據地址自動識別所屬區域
   - 設定入池時間和狀態

2. 外送員選擇機制：
   - driver_order_selections 表記錄選擇歷史
   - 支援多區域跨選
   - 支援即時狀態更新

3. 路線優化準備：
   - route_optimization_batches 記錄批次優化
   - route_optimization_routes 記錄詳細路線
   - 固定起始點：三峽區民生街186號

4. 區域識別：
   - 使用關鍵字匹配識別地址所屬區域
   - 支援優先級設定
   - 可動態新增區域和關鍵字

5. 統計與監控：
   - public_pool_stats 視圖提供即時統計
   - driver_current_selections 視圖顯示選擇狀況
   - 支援各種查詢需求

使用範例：
- 查看三峽區公共池：SELECT * FROM get_pool_orders_by_district('三峽區');
- 查看公共池統計：SELECT * FROM public_pool_stats;
- 準備路線優化：SELECT * FROM prepare_route_optimization(1);
*/