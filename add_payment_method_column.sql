-- 為orders表添加payment_method欄位
-- 執行日期: 2025-09-10
-- 用途: 修復前台結帳時的訂單提交錯誤

-- 檢查欄位是否已存在，如果不存在則添加
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='orders' AND column_name='payment_method') THEN
        ALTER TABLE orders ADD COLUMN payment_method TEXT DEFAULT 'cash';
        
        -- 更新現有記錄的預設付款方式
        UPDATE orders SET payment_method = 'cash' WHERE payment_method IS NULL;
        
        RAISE NOTICE 'payment_method 欄位已成功添加到 orders 表';
    ELSE
        RAISE NOTICE 'payment_method 欄位已存在於 orders 表中';
    END IF;
END $$;

-- 建立索引以提升查詢效能
CREATE INDEX IF NOT EXISTS idx_orders_payment_method ON orders(payment_method);