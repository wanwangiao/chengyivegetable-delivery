-- ========================================
-- 誠憶鮮蔬系統完整資料庫結構修復腳本
-- 解決 contact_name vs customer_name 欄位衝突問題
-- ========================================

-- 執行前注意事項：
-- 1. 此腳本是為了解決 "null value in column "contact_name" violates not-null constraint" 錯誤
-- 2. 統一使用 contact_name 和 contact_phone，移除 customer_name 和 customer_phone 的混用
-- 3. 建議在 Railway PostgreSQL 控制台中執行
-- 4. 執行前請先備份重要資料

BEGIN;

-- ========================================
-- 第一步：分析當前表結構
-- ========================================

-- 檢查 orders 表的現有結構
DO $$
DECLARE
    has_contact_name BOOLEAN := FALSE;
    has_customer_name BOOLEAN := FALSE;
    contact_name_nullable BOOLEAN := FALSE;
    customer_name_nullable BOOLEAN := FALSE;
BEGIN
    -- 檢查 contact_name 欄位
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'orders' AND column_name = 'contact_name'
    ) INTO has_contact_name;

    IF has_contact_name THEN
        SELECT (is_nullable = 'YES') INTO contact_name_nullable
        FROM information_schema.columns
        WHERE table_name = 'orders' AND column_name = 'contact_name';

        RAISE NOTICE '✅ contact_name 欄位存在，可為空: %', contact_name_nullable;
    ELSE
        RAISE NOTICE '❌ contact_name 欄位不存在';
    END IF;

    -- 檢查 customer_name 欄位
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'orders' AND column_name = 'customer_name'
    ) INTO has_customer_name;

    IF has_customer_name THEN
        SELECT (is_nullable = 'YES') INTO customer_name_nullable
        FROM information_schema.columns
        WHERE table_name = 'orders' AND column_name = 'customer_name';

        RAISE NOTICE '⚠️  customer_name 欄位存在，可為空: %', customer_name_nullable;
    ELSE
        RAISE NOTICE '✅ customer_name 欄位不存在 (符合標準結構)';
    END IF;
END $$;

-- ========================================
-- 第二步：確保標準結構存在
-- ========================================

-- 確保 orders 表有正確的結構
DO $$
BEGIN
    -- 如果 orders 表不存在，創建標準結構
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'orders'
    ) THEN
        RAISE NOTICE '創建 orders 表...';
        CREATE TABLE orders (
            id SERIAL PRIMARY KEY,
            contact_name TEXT NOT NULL,
            contact_phone TEXT NOT NULL,
            address TEXT NOT NULL,
            notes TEXT,
            invoice TEXT,
            subtotal NUMERIC NOT NULL DEFAULT 0,
            delivery_fee NUMERIC NOT NULL DEFAULT 0,
            total NUMERIC NOT NULL DEFAULT 0,
            payment_method TEXT DEFAULT 'cash',
            status TEXT NOT NULL DEFAULT 'placed',
            created_at TIMESTAMP NOT NULL DEFAULT NOW(),
            -- 外送員系統相關欄位
            driver_id INTEGER,
            taken_at TIMESTAMP,
            completed_at TIMESTAMP,
            -- 地理位置欄位
            lat NUMERIC,
            lng NUMERIC,
            geocoded_at TIMESTAMP,
            geocode_status TEXT,
            -- 鎖定機制欄位
            locked_by INTEGER,
            locked_at TIMESTAMP,
            lock_expires_at TIMESTAMP,
            -- 訂單編號
            order_number VARCHAR(50) UNIQUE
        );

        -- 創建索引
        CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
        CREATE INDEX IF NOT EXISTS idx_orders_driver_id ON orders(driver_id);
        CREATE INDEX IF NOT EXISTS idx_orders_locked_by ON orders(locked_by);
        CREATE INDEX IF NOT EXISTS idx_orders_lock_expires ON orders(lock_expires_at);
        CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);

        RAISE NOTICE '✅ orders 表已創建';
    END IF;

    -- 確保必要欄位存在
    -- contact_name 欄位
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'orders' AND column_name = 'contact_name'
    ) THEN
        ALTER TABLE orders ADD COLUMN contact_name TEXT NOT NULL DEFAULT '未知客戶';
        RAISE NOTICE '✅ 已新增 contact_name 欄位';
    END IF;

    -- contact_phone 欄位
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'orders' AND column_name = 'contact_phone'
    ) THEN
        ALTER TABLE orders ADD COLUMN contact_phone TEXT NOT NULL DEFAULT '0000000000';
        RAISE NOTICE '✅ 已新增 contact_phone 欄位';
    END IF;

    -- order_number 欄位
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'orders' AND column_name = 'order_number'
    ) THEN
        ALTER TABLE orders ADD COLUMN order_number VARCHAR(50) UNIQUE;
        RAISE NOTICE '✅ 已新增 order_number 欄位';
    END IF;

    -- 外送員系統欄位
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'orders' AND column_name = 'locked_by'
    ) THEN
        ALTER TABLE orders
        ADD COLUMN locked_by INTEGER,
        ADD COLUMN locked_at TIMESTAMP,
        ADD COLUMN lock_expires_at TIMESTAMP;

        CREATE INDEX IF NOT EXISTS idx_orders_locked_by ON orders(locked_by);
        CREATE INDEX IF NOT EXISTS idx_orders_lock_expires ON orders(lock_expires_at);

        RAISE NOTICE '✅ 已新增外送員鎖定欄位';
    END IF;
END $$;

-- ========================================
-- 第三步：資料遷移和清理
-- ========================================

-- 如果同時存在 customer_name 和 contact_name，進行資料遷移
DO $$
DECLARE
    has_both BOOLEAN := FALSE;
    migration_count INTEGER := 0;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'orders' AND column_name = 'customer_name'
    ) AND EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'orders' AND column_name = 'contact_name'
    ) INTO has_both;

    IF has_both THEN
        RAISE NOTICE '檢測到同時存在 customer_name 和 contact_name 欄位，開始資料遷移...';

        -- 將 customer_name 的資料複製到 contact_name (如果 contact_name 為空)
        UPDATE orders
        SET contact_name = customer_name
        WHERE (contact_name IS NULL OR contact_name = '')
          AND customer_name IS NOT NULL
          AND customer_name != '';

        GET DIAGNOSTICS migration_count = ROW_COUNT;
        RAISE NOTICE '✅ 已遷移 % 筆記錄的客戶姓名', migration_count;

        -- 將 customer_phone 的資料複製到 contact_phone (如果存在且 contact_phone 為空)
        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'orders' AND column_name = 'customer_phone'
        ) THEN
            UPDATE orders
            SET contact_phone = customer_phone
            WHERE (contact_phone IS NULL OR contact_phone = '')
              AND customer_phone IS NOT NULL
              AND customer_phone != '';

            GET DIAGNOSTICS migration_count = ROW_COUNT;
            RAISE NOTICE '✅ 已遷移 % 筆記錄的客戶電話', migration_count;
        END IF;

        RAISE NOTICE '⚠️  資料遷移完成，建議手動檢查資料正確性後再刪除舊欄位';
    END IF;
END $$;

-- ========================================
-- 第四步：修復 NULL 值問題
-- ========================================

-- 修復可能的 NULL 值問題
UPDATE orders
SET contact_name = '未知客戶'
WHERE contact_name IS NULL OR contact_name = '';

UPDATE orders
SET contact_phone = '0000000000'
WHERE contact_phone IS NULL OR contact_phone = '';

-- 為現有訂單生成訂單編號
UPDATE orders
SET order_number = 'ORD' || LPAD(id::text, 6, '0')
WHERE order_number IS NULL OR order_number = '';

-- ========================================
-- 第五步：創建或更新相關表
-- ========================================

-- 確保 drivers 表存在
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

-- 確保 order_items 表存在
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

-- 確保 products 表存在
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    price NUMERIC,
    is_priced_item BOOLEAN NOT NULL DEFAULT FALSE,
    unit_hint TEXT,
    is_available BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 確保 users 表存在
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    phone TEXT NOT NULL UNIQUE,
    name TEXT,
    line_user_id TEXT,
    line_display_name TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ========================================
-- 第六步：驗證修復結果
-- ========================================

-- 檢查修復結果
DO $$
DECLARE
    order_count INTEGER;
    invalid_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO order_count FROM orders;
    RAISE NOTICE '📊 總訂單數: %', order_count;

    SELECT COUNT(*) INTO invalid_count
    FROM orders
    WHERE contact_name IS NULL OR contact_name = '';

    IF invalid_count = 0 THEN
        RAISE NOTICE '✅ 所有訂單都有有效的客戶姓名';
    ELSE
        RAISE NOTICE '⚠️  仍有 % 筆訂單缺少客戶姓名', invalid_count;
    END IF;

    SELECT COUNT(*) INTO invalid_count
    FROM orders
    WHERE contact_phone IS NULL OR contact_phone = '';

    IF invalid_count = 0 THEN
        RAISE NOTICE '✅ 所有訂單都有有效的客戶電話';
    ELSE
        RAISE NOTICE '⚠️  仍有 % 筆訂單缺少客戶電話', invalid_count;
    END IF;
END $$;

-- 顯示表結構確認
SELECT
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'orders'
  AND column_name IN ('contact_name', 'contact_phone', 'customer_name', 'customer_phone', 'order_number')
ORDER BY column_name;

COMMIT;

-- ========================================
-- 修復完成報告
-- ========================================

NOTIFY database_fix_complete, '誠憶鮮蔬系統資料庫結構修復完成';

-- 後續建議：
-- 1. 執行測試訂單創建：使用修復後的 create_11_test_orders.sql
-- 2. 驗證外送員系統功能正常
-- 3. 檢查 LINE LIFF 功能是否正常運作
-- 4. 如果確認 customer_name 欄位不再需要，可以考慮刪除（但建議保留一段時間）