-- 驗證 LINE 用戶修復腳本
-- 執行時間：2025年09月17日

DO $$
DECLARE
    phone_nullable BOOLEAN;
    line_user_id_unique BOOLEAN;
    line_user_id_indexed BOOLEAN;
BEGIN
    RAISE NOTICE '🔍 開始驗證 LINE 用戶修復狀態...';
    RAISE NOTICE '';

    -- 1. 檢查 phone 欄位是否允許 NULL
    SELECT is_nullable = 'YES' INTO phone_nullable
    FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'phone';
    
    IF phone_nullable THEN
        RAISE NOTICE '✅ users.phone 欄位允許 NULL 值';
    ELSE
        RAISE NOTICE '❌ users.phone 欄位仍然是 NOT NULL - 需要執行修復腳本';
    END IF;

    -- 2. 檢查 line_user_id 是否有 UNIQUE 約束
    SELECT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'users' 
        AND constraint_type = 'UNIQUE' 
        AND constraint_name LIKE '%line_user_id%'
    ) INTO line_user_id_unique;
    
    IF line_user_id_unique THEN
        RAISE NOTICE '✅ users.line_user_id 有 UNIQUE 約束';
    ELSE
        RAISE NOTICE '❌ users.line_user_id 缺少 UNIQUE 約束 - 需要執行修復腳本';
    END IF;

    -- 3. 檢查 line_user_id 是否有索引
    SELECT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'users' 
        AND indexname LIKE '%line_user_id%'
    ) INTO line_user_id_indexed;
    
    IF line_user_id_indexed THEN
        RAISE NOTICE '✅ users.line_user_id 有索引';
    ELSE
        RAISE NOTICE '⚠️ users.line_user_id 缺少索引 - 建議添加以提高性能';
    END IF;

    RAISE NOTICE '';
    
    -- 4. 測試 ON CONFLICT 語法
    IF phone_nullable AND line_user_id_unique THEN
        RAISE NOTICE '🎉 資料庫結構已正確配置！';
        RAISE NOTICE '✅ 可以安全使用 ON CONFLICT (line_user_id) 語法';
        
        -- 嘗試執行測試 UPSERT
        BEGIN
            INSERT INTO users (line_user_id, line_display_name, name, created_at)
            VALUES ('test_verification_user', '測試用戶', '測試用戶', NOW())
            ON CONFLICT (line_user_id) DO UPDATE SET
              line_display_name = EXCLUDED.line_display_name;
            
            -- 清理測試數據
            DELETE FROM users WHERE line_user_id = 'test_verification_user';
            
            RAISE NOTICE '✅ ON CONFLICT 語法測試成功';
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE '❌ ON CONFLICT 語法測試失敗: %', SQLERRM;
        END;
    ELSE
        RAISE NOTICE '❌ 資料庫結構需要修復';
        RAISE NOTICE '📋 請執行: fix_line_user_constraints.sql';
    END IF;

    RAISE NOTICE '';
    RAISE NOTICE '🔚 驗證完成';
END $$;