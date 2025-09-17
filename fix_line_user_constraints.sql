-- 修復 LINE 用戶約束問題
-- 執行時間：2025年09月17日

DO $$
BEGIN
    -- 1. 修改 phone 欄位為可選（移除 NOT NULL 約束）
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'phone' 
        AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE users ALTER COLUMN phone DROP NOT NULL;
        RAISE NOTICE '✅ users.phone 欄位 NOT NULL 約束已移除';
    ELSE
        RAISE NOTICE '⚠️ users.phone 欄位已經允許 NULL';
    END IF;

    -- 2. 為 line_user_id 添加 UNIQUE 約束（如果不存在）
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'users' 
        AND constraint_type = 'UNIQUE' 
        AND constraint_name LIKE '%line_user_id%'
    ) THEN
        -- 首先清理重複的 line_user_id（如果有的話）
        DELETE FROM users a USING users b 
        WHERE a.id > b.id 
        AND a.line_user_id = b.line_user_id 
        AND a.line_user_id IS NOT NULL;
        
        -- 添加 UNIQUE 約束
        ALTER TABLE users ADD CONSTRAINT uk_users_line_user_id UNIQUE (line_user_id);
        RAISE NOTICE '✅ users.line_user_id UNIQUE 約束已添加';
    ELSE
        RAISE NOTICE '⚠️ users.line_user_id UNIQUE 約束已存在';
    END IF;

    -- 3. 創建索引以提高查詢性能
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'users' 
        AND indexname = 'idx_users_line_user_id'
    ) THEN
        CREATE INDEX idx_users_line_user_id ON users(line_user_id);
        RAISE NOTICE '✅ users.line_user_id 索引已創建';
    ELSE
        RAISE NOTICE '⚠️ users.line_user_id 索引已存在';
    END IF;

    -- 4. 確保 phone 欄位仍然有 UNIQUE 約束（但允許 NULL）
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'users' 
        AND constraint_type = 'UNIQUE' 
        AND constraint_name LIKE '%phone%'
    ) THEN
        ALTER TABLE users ADD CONSTRAINT uk_users_phone UNIQUE (phone);
        RAISE NOTICE '✅ users.phone UNIQUE 約束已添加';
    ELSE
        RAISE NOTICE '⚠️ users.phone UNIQUE 約束已存在';
    END IF;

END $$;

-- 輸出完成訊息
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🎉 LINE 用戶約束修復完成！';
    RAISE NOTICE '📋 修改內容：';
    RAISE NOTICE '   - phone 欄位現在允許 NULL 值';
    RAISE NOTICE '   - line_user_id 欄位現在有 UNIQUE 約束';
    RAISE NOTICE '   - 添加了相應的索引以提高性能';
    RAISE NOTICE '✅ 現在可以安全使用 ON CONFLICT (line_user_id) 語法';
    RAISE NOTICE '';
END $$;