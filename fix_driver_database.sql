-- 外送員系統資料庫修復腳本
-- 執行時間：2025年09月12日

-- 1. 檢查並修復 orders 表的鎖定欄位
DO $$
BEGIN
    -- 新增鎖定相關欄位到 orders 表
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'orders' AND column_name = 'locked_by'
    ) THEN
        ALTER TABLE orders 
        ADD COLUMN locked_by INTEGER,
        ADD COLUMN locked_at TIMESTAMP,
        ADD COLUMN lock_expires_at TIMESTAMP;
        
        -- 新增索引提升查詢效能
        CREATE INDEX idx_orders_locked_by ON orders(locked_by);
        CREATE INDEX idx_orders_lock_expires ON orders(lock_expires_at);
        
        RAISE NOTICE '✅ orders 表鎖定欄位新增完成';
    ELSE
        RAISE NOTICE '⚠️ orders 表鎖定欄位已存在';
    END IF;
END $$;

-- 2. 建立 offline_queue 表（離線操作佇列）
CREATE TABLE IF NOT EXISTS offline_queue (
    id SERIAL PRIMARY KEY,
    driver_id INTEGER NOT NULL,
    action_type VARCHAR(50) NOT NULL,
    order_id INTEGER,
    data_payload TEXT,
    file_paths TEXT[],
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT NOW(),
    processed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_offline_queue_driver ON offline_queue(driver_id);
CREATE INDEX IF NOT EXISTS idx_offline_queue_status ON offline_queue(status);

-- 3. 建立 delivery_photos 表（配送照片）
CREATE TABLE IF NOT EXISTS delivery_photos (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL,
    driver_id INTEGER NOT NULL,
    photo_type VARCHAR(50) NOT NULL,
    original_filename VARCHAR(255),
    stored_filename VARCHAR(255),
    file_path TEXT NOT NULL,
    file_size INTEGER,
    upload_timestamp TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_delivery_photos_order ON delivery_photos(order_id);
CREATE INDEX IF NOT EXISTS idx_delivery_photos_driver ON delivery_photos(driver_id);

-- 4. 建立 delivery_problems 表（配送問題記錄）
CREATE TABLE IF NOT EXISTS delivery_problems (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL,
    driver_id INTEGER NOT NULL,
    problem_type VARCHAR(50) NOT NULL,
    problem_description TEXT,
    priority VARCHAR(20) DEFAULT 'normal',
    status VARCHAR(20) DEFAULT 'reported',
    reported_at TIMESTAMP DEFAULT NOW(),
    resolved_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_delivery_problems_order ON delivery_problems(order_id);
CREATE INDEX IF NOT EXISTS idx_delivery_problems_driver ON delivery_problems(driver_id);
CREATE INDEX IF NOT EXISTS idx_delivery_problems_status ON delivery_problems(status);

-- 5. 確保 drivers 表存在並包含測試帳號
CREATE TABLE IF NOT EXISTS drivers (
    id SERIAL PRIMARY KEY,
    driver_code VARCHAR(50) UNIQUE,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    status VARCHAR(20) DEFAULT 'available',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 插入測試外送員（如果不存在）
INSERT INTO drivers (driver_code, name, phone, password_hash, status) 
VALUES ('driver_001', '測試外送員', '0912345678', '$2b$10$rQZ1QZ1QZ1QZ1QZ1QZ1QZO', 'available')
ON CONFLICT (phone) DO NOTHING;

-- 6. 建立一些測試訂單數據供外送員測試
INSERT INTO orders (
    order_number, 
    customer_name, 
    customer_phone, 
    address, 
    status, 
    subtotal, 
    delivery_fee, 
    total, 
    created_at
) VALUES 
(
    'TEST001', 
    '測試客戶A', 
    '0987654321', 
    '新北市三峽區中華路100號', 
    'packed', 
    200, 
    50, 
    250, 
    NOW()
),
(
    'TEST002', 
    '測試客戶B', 
    '0987654322', 
    '新北市樹林區中正路200號', 
    'packed', 
    300, 
    50, 
    350, 
    NOW()
),
(
    'TEST003', 
    '測試客戶C', 
    '0987654323', 
    '桃園市桃園區民生路300號', 
    'packed', 
    150, 
    50, 
    200, 
    NOW()
)
ON CONFLICT DO NOTHING;

-- 輸出完成訊息
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🎉 外送員系統資料庫修復完成！';
    RAISE NOTICE '📋 已建立表格：orders(新增欄位), offline_queue, delivery_photos, delivery_problems, drivers';
    RAISE NOTICE '🚚 已插入測試外送員：0912345678';
    RAISE NOTICE '📦 已插入3筆測試訂單供外送員測試使用';
    RAISE NOTICE '';
END $$;