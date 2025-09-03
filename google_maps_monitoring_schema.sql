-- =====================================
-- Google Maps API 使用量監控資料庫結構
-- 提供完整的 API 使用追蹤、成本控制和預警功能
-- =====================================

-- Google Maps API 使用日誌表
CREATE TABLE IF NOT EXISTS google_maps_usage_log (
    id SERIAL PRIMARY KEY,
    client_ip INET NOT NULL,                    -- 客戶端IP
    user_agent TEXT,                            -- 用戶代理
    operation_type VARCHAR(50) NOT NULL,        -- 操作類型
    request_data JSONB,                         -- 請求數據
    response_status VARCHAR(20) DEFAULT 'OK',   -- 回應狀態
    response_time_ms INTEGER,                   -- 回應時間（毫秒）
    api_cost DECIMAL(10, 6) DEFAULT 0.0,       -- API 成本
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- 新增索引
    CONSTRAINT valid_operation_type CHECK (operation_type IN (
        'geocoding', 'distance_matrix', 'directions', 'places_api',
        'cache_hit', 'api_call_success', 'api_call_failed', 
        'rate_limit_exceeded_minute', 'rate_limit_exceeded_hour', 
        'rate_limit_exceeded_day', 'validation_passed', 'error'
    ))
);

-- 為使用日誌表建立索引
CREATE INDEX IF NOT EXISTS idx_google_maps_usage_log_created_at ON google_maps_usage_log(created_at);
CREATE INDEX IF NOT EXISTS idx_google_maps_usage_log_operation ON google_maps_usage_log(operation_type);
CREATE INDEX IF NOT EXISTS idx_google_maps_usage_log_client_ip ON google_maps_usage_log(client_ip);
CREATE INDEX IF NOT EXISTS idx_google_maps_usage_log_status ON google_maps_usage_log(response_status);

-- API 成本配置表
CREATE TABLE IF NOT EXISTS google_maps_pricing (
    id SERIAL PRIMARY KEY,
    api_type VARCHAR(50) UNIQUE NOT NULL,       -- API 類型
    cost_per_1000 DECIMAL(10, 4) NOT NULL,     -- 每1000次請求的成本 (USD)
    free_quota INTEGER DEFAULT 0,               -- 免費配額
    description TEXT,                           -- 描述
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 插入預設價格設定
INSERT INTO google_maps_pricing (api_type, cost_per_1000, free_quota, description) VALUES
('geocoding', 5.00, 40000, 'Geocoding API - $5 per 1000 requests'),
('distance_matrix', 5.00, 40000, 'Distance Matrix API - $5 per 1000 requests'),
('directions', 5.00, 40000, 'Directions API - $5 per 1000 requests'),
('places_api', 32.00, 6250, 'Places API - $32 per 1000 requests'),
('static_maps', 2.00, 100000, 'Static Maps API - $2 per 1000 requests'),
('js_api', 7.00, 28571, 'Maps JavaScript API - $7 per 1000 loads')
ON CONFLICT (api_type) DO UPDATE SET
    cost_per_1000 = EXCLUDED.cost_per_1000,
    free_quota = EXCLUDED.free_quota,
    description = EXCLUDED.description,
    updated_at = CURRENT_TIMESTAMP;

-- API 使用限制表
CREATE TABLE IF NOT EXISTS google_maps_rate_limits (
    id SERIAL PRIMARY KEY,
    limit_type VARCHAR(20) NOT NULL,            -- 限制類型: minute, hour, day, month
    max_requests INTEGER NOT NULL,              -- 最大請求數
    time_window_minutes INTEGER NOT NULL,       -- 時間窗口（分鐘）
    is_active BOOLEAN DEFAULT true,             -- 是否啟用
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT valid_limit_type CHECK (limit_type IN ('minute', 'hour', 'day', 'month'))
);

-- 插入預設限制設定
INSERT INTO google_maps_rate_limits (limit_type, max_requests, time_window_minutes) VALUES
('minute', 100, 1),
('hour', 2500, 60),
('day', 25000, 1440),
('month', 200000, 43200)  -- 30天
ON CONFLICT DO NOTHING;

-- 成本預警設定表
CREATE TABLE IF NOT EXISTS google_maps_cost_alerts (
    id SERIAL PRIMARY KEY,
    alert_type VARCHAR(20) NOT NULL,            -- 預警類型: daily, monthly
    threshold_usd DECIMAL(10, 2) NOT NULL,      -- 預警閾值 (USD)
    current_amount DECIMAL(10, 2) DEFAULT 0,    -- 當前金額
    is_active BOOLEAN DEFAULT true,             -- 是否啟用
    last_triggered TIMESTAMP,                   -- 上次觸發時間
    notification_emails TEXT[],                 -- 通知郵箱列表
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT valid_alert_type CHECK (alert_type IN ('daily', 'monthly'))
);

-- 插入預設預警設定
INSERT INTO google_maps_cost_alerts (alert_type, threshold_usd, notification_emails) VALUES
('daily', 10.00, ARRAY['admin@yourdomain.com']),  -- 每日$10預警
('monthly', 150.00, ARRAY['admin@yourdomain.com']) -- 每月$150預警
ON CONFLICT DO NOTHING;

-- API 性能統計表
CREATE TABLE IF NOT EXISTS google_maps_performance_stats (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,                         -- 統計日期
    api_type VARCHAR(50) NOT NULL,              -- API 類型
    total_requests INTEGER DEFAULT 0,           -- 總請求數
    successful_requests INTEGER DEFAULT 0,      -- 成功請求數
    failed_requests INTEGER DEFAULT 0,          -- 失敗請求數
    cache_hits INTEGER DEFAULT 0,              -- 快取命中數
    avg_response_time_ms DECIMAL(10, 2),       -- 平均回應時間
    total_cost_usd DECIMAL(10, 4) DEFAULT 0,   -- 總成本
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(date, api_type)
);

-- 為性能統計表建立索引
CREATE INDEX IF NOT EXISTS idx_google_maps_performance_stats_date ON google_maps_performance_stats(date);
CREATE INDEX IF NOT EXISTS idx_google_maps_performance_stats_api_type ON google_maps_performance_stats(api_type);

-- 建立自動更新性能統計的函數
CREATE OR REPLACE FUNCTION update_google_maps_daily_stats()
RETURNS VOID AS $$
DECLARE
    target_date DATE := CURRENT_DATE - INTERVAL '1 day';
    pricing_record RECORD;
BEGIN
    -- 為每種 API 類型計算昨日統計
    FOR pricing_record IN 
        SELECT api_type FROM google_maps_pricing 
    LOOP
        INSERT INTO google_maps_performance_stats (
            date, api_type, total_requests, successful_requests, 
            failed_requests, cache_hits, avg_response_time_ms, total_cost_usd
        )
        SELECT 
            target_date,
            pricing_record.api_type,
            COUNT(*) as total_requests,
            COUNT(*) FILTER (WHERE response_status = 'OK') as successful_requests,
            COUNT(*) FILTER (WHERE response_status != 'OK') as failed_requests,
            COUNT(*) FILTER (WHERE operation_type = 'cache_hit') as cache_hits,
            AVG(response_time_ms) as avg_response_time_ms,
            SUM(api_cost) as total_cost_usd
        FROM google_maps_usage_log 
        WHERE DATE(created_at) = target_date 
        AND (
            operation_type = pricing_record.api_type OR 
            (pricing_record.api_type = 'geocoding' AND operation_type IN ('api_call_success', 'api_call_failed')) OR
            (pricing_record.api_type = 'distance_matrix' AND operation_type LIKE '%distance%')
        )
        GROUP BY pricing_record.api_type
        ON CONFLICT (date, api_type) DO UPDATE SET
            total_requests = EXCLUDED.total_requests,
            successful_requests = EXCLUDED.successful_requests,
            failed_requests = EXCLUDED.failed_requests,
            cache_hits = EXCLUDED.cache_hits,
            avg_response_time_ms = EXCLUDED.avg_response_time_ms,
            total_cost_usd = EXCLUDED.total_cost_usd;
    END LOOP;
    
    -- 更新成本預警的當前金額
    UPDATE google_maps_cost_alerts 
    SET current_amount = (
        SELECT COALESCE(SUM(total_cost_usd), 0) 
        FROM google_maps_performance_stats 
        WHERE date = target_date
    )
    WHERE alert_type = 'daily';
    
    UPDATE google_maps_cost_alerts 
    SET current_amount = (
        SELECT COALESCE(SUM(total_cost_usd), 0) 
        FROM google_maps_performance_stats 
        WHERE date >= DATE_TRUNC('month', CURRENT_DATE)
    )
    WHERE alert_type = 'monthly';
    
    -- 記錄統計更新日誌
    INSERT INTO system_logs (operation, message) 
    VALUES ('daily_stats_update', 'Updated Google Maps daily statistics for ' || target_date);
END;
$$ LANGUAGE plpgsql;

-- 建立檢查成本預警的函數
CREATE OR REPLACE FUNCTION check_google_maps_cost_alerts()
RETURNS TABLE(alert_id INTEGER, alert_type VARCHAR, threshold_usd DECIMAL, current_amount DECIMAL) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ca.id,
        ca.alert_type,
        ca.threshold_usd,
        ca.current_amount
    FROM google_maps_cost_alerts ca
    WHERE ca.is_active = true 
    AND ca.current_amount >= ca.threshold_usd
    AND (ca.last_triggered IS NULL OR ca.last_triggered < CURRENT_DATE);
END;
$$ LANGUAGE plpgsql;

-- 建立獲取使用統計的視圖
CREATE OR REPLACE VIEW google_maps_usage_summary AS
SELECT 
    DATE(created_at) as usage_date,
    operation_type,
    COUNT(*) as request_count,
    COUNT(*) FILTER (WHERE response_status = 'OK') as successful_count,
    COUNT(*) FILTER (WHERE response_status != 'OK') as failed_count,
    AVG(response_time_ms) as avg_response_time,
    SUM(api_cost) as total_cost
FROM google_maps_usage_log
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(created_at), operation_type
ORDER BY usage_date DESC, operation_type;

-- 建立成本效益分析視圖
CREATE OR REPLACE VIEW google_maps_cost_analysis AS
SELECT 
    DATE_TRUNC('month', pstats.date) as month,
    pstats.api_type,
    SUM(pstats.total_requests) as total_requests,
    SUM(pstats.cache_hits) as cache_hits,
    ROUND(
        (SUM(pstats.cache_hits)::DECIMAL / NULLIF(SUM(pstats.total_requests), 0)) * 100, 
        2
    ) as cache_hit_rate_percent,
    SUM(pstats.total_cost_usd) as total_cost_usd,
    p.cost_per_1000,
    p.free_quota,
    CASE 
        WHEN SUM(pstats.total_requests) <= p.free_quota 
        THEN 0 
        ELSE (SUM(pstats.total_requests) - p.free_quota) * p.cost_per_1000 / 1000 
    END as actual_billable_cost
FROM google_maps_performance_stats pstats
JOIN google_maps_pricing p ON pstats.api_type = p.api_type
GROUP BY DATE_TRUNC('month', pstats.date), pstats.api_type, p.cost_per_1000, p.free_quota
ORDER BY month DESC, pstats.api_type;

-- 建立地理編碼快取效能視圖
CREATE OR REPLACE VIEW geocoding_cache_performance AS
SELECT 
    c.address,
    c.hit_count,
    c.created_at,
    c.last_used_at,
    c.expires_at,
    CASE 
        WHEN c.expires_at > NOW() THEN '有效'
        ELSE '已過期'
    END as cache_status,
    -- 計算節省的 API 成本
    (c.hit_count * (SELECT cost_per_1000 FROM google_maps_pricing WHERE api_type = 'geocoding') / 1000) as saved_cost_usd
FROM geocoding_cache c
ORDER BY c.hit_count DESC, c.last_used_at DESC;

-- 建立自動清理過期數據的函數
CREATE OR REPLACE FUNCTION cleanup_google_maps_old_data()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER := 0;
    temp_count INTEGER;
BEGIN
    -- 清理超過90天的使用日誌
    DELETE FROM google_maps_usage_log 
    WHERE created_at < NOW() - INTERVAL '90 days';
    GET DIAGNOSTICS temp_count = ROW_COUNT;
    deleted_count := deleted_count + temp_count;
    
    -- 清理超過1年的性能統計
    DELETE FROM google_maps_performance_stats 
    WHERE date < CURRENT_DATE - INTERVAL '365 days';
    GET DIAGNOSTICS temp_count = ROW_COUNT;
    deleted_count := deleted_count + temp_count;
    
    -- 清理過期的地理編碼快取
    SELECT cleanup_expired_geocoding_cache() INTO temp_count;
    deleted_count := deleted_count + temp_count;
    
    -- 記錄清理日誌
    INSERT INTO system_logs (operation, message) 
    VALUES ('data_cleanup', 'Cleaned up ' || deleted_count || ' old Google Maps data entries');
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- 建立觸發器來自動計算 API 成本
CREATE OR REPLACE FUNCTION calculate_api_cost()
RETURNS TRIGGER AS $$
DECLARE
    cost_per_1000 DECIMAL(10, 4);
BEGIN
    -- 根據操作類型獲取成本
    SELECT p.cost_per_1000 
    INTO cost_per_1000
    FROM google_maps_pricing p 
    WHERE p.api_type = CASE 
        WHEN NEW.operation_type IN ('api_call_success', 'geocoding') THEN 'geocoding'
        WHEN NEW.operation_type LIKE '%distance%' THEN 'distance_matrix'
        WHEN NEW.operation_type LIKE '%direction%' THEN 'directions'
        WHEN NEW.operation_type LIKE '%places%' THEN 'places_api'
        ELSE 'geocoding'  -- 預設
    END;
    
    -- 只有成功的 API 調用才計算成本
    IF NEW.operation_type IN ('api_call_success', 'geocoding', 'distance_matrix_success', 'directions_success') THEN
        NEW.api_cost := COALESCE(cost_per_1000 / 1000, 0);
    ELSE
        NEW.api_cost := 0;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 建立觸發器（如果不存在）
DROP TRIGGER IF EXISTS trigger_calculate_api_cost ON google_maps_usage_log;
CREATE TRIGGER trigger_calculate_api_cost
    BEFORE INSERT ON google_maps_usage_log
    FOR EACH ROW
    EXECUTE FUNCTION calculate_api_cost();

-- 插入初始系統日誌
INSERT INTO system_logs (operation, message) 
VALUES ('schema_init', 'Google Maps monitoring schema initialized');

COMMENT ON TABLE google_maps_usage_log IS 'Google Maps API 使用日誌 - 記錄所有 API 調用';
COMMENT ON TABLE google_maps_pricing IS 'Google Maps API 價格配置';
COMMENT ON TABLE google_maps_rate_limits IS 'API 請求頻率限制設定';
COMMENT ON TABLE google_maps_cost_alerts IS '成本預警設定';
COMMENT ON TABLE google_maps_performance_stats IS 'API 性能統計數據';
COMMENT ON VIEW google_maps_usage_summary IS 'Google Maps 使用情況摘要視圖';
COMMENT ON VIEW google_maps_cost_analysis IS 'Google Maps 成本效益分析視圖';
COMMENT ON VIEW geocoding_cache_performance IS '地理編碼快取效能分析視圖';