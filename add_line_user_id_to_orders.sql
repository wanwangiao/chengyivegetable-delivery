-- 為 orders 表添加 LINE 用戶 ID 欄位
-- 用於在結帳時綁定 LINE 用戶

DO $$
BEGIN
    -- 檢查 line_user_id 欄位是否存在
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'orders' AND column_name = 'line_user_id'
    ) THEN
        ALTER TABLE orders ADD COLUMN line_user_id TEXT;
        RAISE NOTICE '✅ 已添加 line_user_id 欄位到 orders 表';
    ELSE
        RAISE NOTICE '⚠️ line_user_id 欄位已存在於 orders 表中';
    END IF;
END $$;

-- 檢查結果
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'orders' AND column_name = 'line_user_id';