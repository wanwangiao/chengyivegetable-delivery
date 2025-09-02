-- 外送員系統擴展 - 資料庫表結構
-- 創建日期: 2025-09-02
-- 說明: 支援照片上傳、問題回報、離線暫存功能

-- 配送照片表
CREATE TABLE IF NOT EXISTS delivery_photos (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    driver_id INTEGER,
    photo_type VARCHAR(50) NOT NULL DEFAULT 'delivery', -- 'delivery', 'before_delivery', 'packaging'
    original_filename VARCHAR(255),
    stored_filename VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER,
    compressed_file_path TEXT,
    compressed_size INTEGER,
    upload_timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
    line_sent_at TIMESTAMP,
    line_message_id TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'uploaded', -- 'uploaded', 'line_sent', 'failed'
    metadata JSONB, -- 儲存EXIF資料、GPS座標等
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 問題回報表
CREATE TABLE IF NOT EXISTS delivery_problems (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    driver_id INTEGER,
    problem_type VARCHAR(100) NOT NULL, -- 'customer_not_home', 'address_not_found', 'payment_issue', 'damaged_goods', 'other'
    problem_description TEXT,
    reported_at TIMESTAMP NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMP,
    resolution_note TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'reported', -- 'reported', 'investigating', 'resolved', 'escalated'
    priority VARCHAR(20) NOT NULL DEFAULT 'medium', -- 'low', 'medium', 'high', 'urgent'
    attached_photos TEXT[], -- 關聯照片ID陣列
    location_lat NUMERIC(10, 8),
    location_lng NUMERIC(11, 8),
    metadata JSONB, -- 額外資料如環境條件等
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 離線暫存表 (支援網路不穩定時的資料暫存)
CREATE TABLE IF NOT EXISTS offline_queue (
    id SERIAL PRIMARY KEY,
    driver_id INTEGER NOT NULL,
    action_type VARCHAR(100) NOT NULL, -- 'upload_photo', 'report_problem', 'complete_order'
    order_id INTEGER,
    data_payload JSONB NOT NULL, -- 儲存要執行的動作資料
    file_paths TEXT[], -- 相關檔案路徑陣列
    retry_count INTEGER NOT NULL DEFAULT 0,
    max_retries INTEGER NOT NULL DEFAULT 3,
    status VARCHAR(50) NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
    error_message TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    last_attempt_at TIMESTAMP,
    scheduled_retry_at TIMESTAMP,
    completed_at TIMESTAMP
);

-- 外送員會話表 (追蹤外送員登入狀態和裝置資訊)
CREATE TABLE IF NOT EXISTS driver_sessions (
    id SERIAL PRIMARY KEY,
    driver_id INTEGER NOT NULL,
    session_token VARCHAR(255) UNIQUE,
    device_info JSONB, -- 裝置資訊
    location_lat NUMERIC(10, 8),
    location_lng NUMERIC(11, 8),
    last_active_at TIMESTAMP NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 建立索引以優化查詢效能
CREATE INDEX IF NOT EXISTS idx_delivery_photos_order_id ON delivery_photos(order_id);
CREATE INDEX IF NOT EXISTS idx_delivery_photos_driver_id ON delivery_photos(driver_id);
CREATE INDEX IF NOT EXISTS idx_delivery_photos_status ON delivery_photos(status);
CREATE INDEX IF NOT EXISTS idx_delivery_photos_upload_timestamp ON delivery_photos(upload_timestamp);

CREATE INDEX IF NOT EXISTS idx_delivery_problems_order_id ON delivery_problems(order_id);
CREATE INDEX IF NOT EXISTS idx_delivery_problems_driver_id ON delivery_problems(driver_id);
CREATE INDEX IF NOT EXISTS idx_delivery_problems_status ON delivery_problems(status);
CREATE INDEX IF NOT EXISTS idx_delivery_problems_reported_at ON delivery_problems(reported_at);

CREATE INDEX IF NOT EXISTS idx_offline_queue_driver_id ON offline_queue(driver_id);
CREATE INDEX IF NOT EXISTS idx_offline_queue_status ON offline_queue(status);
CREATE INDEX IF NOT EXISTS idx_offline_queue_scheduled_retry ON offline_queue(scheduled_retry_at);

CREATE INDEX IF NOT EXISTS idx_driver_sessions_driver_id ON driver_sessions(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_sessions_token ON driver_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_driver_sessions_expires ON driver_sessions(expires_at);

-- 更新 orders 表，加入問題回報相關欄位
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS problem_reported_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS problem_resolved_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS delivery_photo_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_photo_uploaded_at TIMESTAMP;

-- 建立觸發器自動更新時間戳
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER delivery_photos_update_timestamp
    BEFORE UPDATE ON delivery_photos
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER delivery_problems_update_timestamp  
    BEFORE UPDATE ON delivery_problems
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- 建立函式來清理過期的離線佇列資料
CREATE OR REPLACE FUNCTION cleanup_offline_queue()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM offline_queue 
    WHERE status = 'completed' 
    AND completed_at < NOW() - INTERVAL '7 days';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- 建立函式來清理過期的會話資料
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM driver_sessions 
    WHERE expires_at < NOW();
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;