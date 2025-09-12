-- Railway 缺少表结构迁移 SQL
-- 添加订单锁定相关字段

-- 1. 为 orders 表添加锁定字段
ALTER TABLE orders ADD COLUMN IF NOT EXISTS locked_by TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS locked_at TIMESTAMP;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS lock_expires_at TIMESTAMP;

-- 2. 创建离线队列表
CREATE TABLE IF NOT EXISTS offline_queue (
    id SERIAL PRIMARY KEY,
    action_type VARCHAR(50) NOT NULL,
    data JSONB NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    processed BOOLEAN NOT NULL DEFAULT FALSE,
    processed_at TIMESTAMP,
    error_message TEXT
);

-- 3. 创建配送照片表
CREATE TABLE IF NOT EXISTS delivery_photos (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    driver_id TEXT,
    photo_type VARCHAR(50) NOT NULL, -- 'pickup', 'delivery', 'problem'
    file_path TEXT NOT NULL,
    uploaded_at TIMESTAMP NOT NULL DEFAULT NOW(),
    notes TEXT
);

-- 4. 创建配送问题表
CREATE TABLE IF NOT EXISTS delivery_problems (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    driver_id TEXT,
    problem_type VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'open',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMP,
    resolution_notes TEXT
);

-- 5. 创建外送员表（如果不存在）
CREATE TABLE IF NOT EXISTS drivers (
    id SERIAL PRIMARY KEY,
    phone VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 6. 添加基础索引以提升性能
CREATE INDEX IF NOT EXISTS idx_orders_locked_by ON orders(locked_by);
CREATE INDEX IF NOT EXISTS idx_orders_locked_at ON orders(locked_at);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_offline_queue_processed ON offline_queue(processed);
CREATE INDEX IF NOT EXISTS idx_delivery_photos_order_id ON delivery_photos(order_id);
CREATE INDEX IF NOT EXISTS idx_delivery_problems_order_id ON delivery_problems(order_id);

-- 7. 插入测试外送员账号（如果不存在）
INSERT INTO drivers (phone, name, password_hash) 
VALUES ('0912345678', '测试外送员', '$2b$10$8N2pKl5jK8mXKlY7rWJzKOYZE4jQyVBZc7qC9mWKnDxH3nY5yZdBa') 
ON CONFLICT (phone) DO NOTHING;

COMMENT ON TABLE offline_queue IS '离线操作队列表';
COMMENT ON TABLE delivery_photos IS '配送照片记录表';
COMMENT ON TABLE delivery_problems IS '配送问题记录表';
COMMENT ON COLUMN orders.locked_by IS '订单锁定的外送员ID';
COMMENT ON COLUMN orders.locked_at IS '订单锁定时间';
COMMENT ON COLUMN orders.lock_expires_at IS '订单锁定过期时间';