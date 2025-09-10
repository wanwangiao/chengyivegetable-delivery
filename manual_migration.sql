-- ==========================================
-- 手動資料庫遷移腳本
-- 日期: 2025-09-10
-- 用途: 為 orders 表添加 payment_method 欄位
-- ==========================================

-- 步驟1: 檢查並添加 payment_method 欄位
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'orders' 
        AND column_name = 'payment_method'
    ) THEN
        -- 添加欄位
        ALTER TABLE orders ADD COLUMN payment_method TEXT DEFAULT 'cash';
        
        -- 更新現有記錄
        UPDATE orders SET payment_method = 'cash' WHERE payment_method IS NULL;
        
        RAISE NOTICE '✅ payment_method 欄位已成功添加到 orders 表';
    ELSE
        RAISE NOTICE '⚠️ payment_method 欄位已存在於 orders 表中';
    END IF;
END $$;

-- 步驟2: 建立索引以提升查詢效能
CREATE INDEX IF NOT EXISTS idx_orders_payment_method ON orders(payment_method);

-- 步驟3: 驗證結果
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'orders' 
    AND column_name = 'payment_method';

-- 步驟4: 檢查現有資料
SELECT 
    COUNT(*) as total_orders,
    COUNT(CASE WHEN payment_method IS NOT NULL THEN 1 END) as with_payment_method,
    COUNT(CASE WHEN payment_method IS NULL THEN 1 END) as without_payment_method
FROM orders;

-- 步驟5: 檢查付款方式分布
SELECT 
    COALESCE(payment_method, 'NULL') as payment_method,
    COUNT(*) as count,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as percentage
FROM orders 
GROUP BY payment_method
ORDER BY count DESC;

-- ==========================================
-- 執行完成後應該看到:
-- 1. ✅ payment_method 欄位已成功添加
-- 2. 欄位資訊顯示: payment_method | text | YES | 'cash'::text
-- 3. 所有訂單都有 payment_method = 'cash'
-- ==========================================