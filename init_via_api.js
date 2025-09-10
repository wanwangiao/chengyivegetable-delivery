// 這個檔案將被加入到server.js中作為API endpoint
// 用於通過部署的應用程式初始化資料庫

const fs = require('fs');
const path = require('path');

// 資料庫初始化API endpoint
app.post('/api/admin/init-database', async (req, res) => {
    console.log('🔧 開始資料庫初始化...');
    
    try {
        // 檢查資料庫連接
        await pool.query('SELECT NOW()');
        
        // 讀取並執行SQL檔案
        const sqlFiles = [
            'schema.sql',
            'realtime_notifications_schema.sql',
            'smart_route_system_schema.sql',
            'geocoding_cache_schema.sql',
            'gps_tracking_schema.sql',
            'intelligent_routing_schema.sql'
        ];
        
        const results = [];
        
        for (const filename of sqlFiles) {
            try {
                const filePath = path.join(__dirname, filename);
                if (fs.existsSync(filePath)) {
                    const sql = fs.readFileSync(filePath, 'utf8');
                    
                    // 分割SQL語句
                    const statements = sql.split(';').filter(stmt => stmt.trim().length > 0);
                    
                    for (const statement of statements) {
                        if (statement.trim()) {
                            await pool.query(statement);
                        }
                    }
                    
                    results.push({ file: filename, status: 'success' });
                    console.log(`✅ ${filename} 執行完成`);
                } else {
                    results.push({ file: filename, status: 'not_found' });
                    console.log(`⚠️ ${filename} 檔案不存在`);
                }
            } catch (error) {
                console.error(`❌ ${filename} 執行失敗:`, error.message);
                if (error.message.includes('already exists')) {
                    results.push({ file: filename, status: 'already_exists' });
                } else {
                    results.push({ file: filename, status: 'error', error: error.message });
                }
            }
        }
        
        // 初始化基礎資料
        try {
            await pool.query(`
                INSERT INTO products (name, price, is_priced_item, unit_hint) VALUES
                ('高麗菜', 50.00, false, '顆'),
                ('白蘿蔔', 30.00, false, '條'),
                ('紅蘿蔔', 25.00, false, '條'),
                ('青花菜', 40.00, false, '顆'),
                ('空心菜', 20.00, false, '把'),
                ('菠菜', 25.00, false, '把'),
                ('韭菜', 30.00, false, '把'),
                ('青江菜', 20.00, false, '把'),
                ('大白菜', 35.00, false, '顆'),
                ('小白菜', 15.00, false, '把')
                ON CONFLICT (name) DO NOTHING
            `);
            results.push({ task: 'products_init', status: 'success' });
        } catch (error) {
            results.push({ task: 'products_init', status: 'error', error: error.message });
        }
        
        try {
            await pool.query(`
                INSERT INTO system_settings (setting_key, setting_value, description) VALUES
                ('store_location', '{"lat": 24.1477, "lng": 120.6736}', '店鋪位置座標'),
                ('max_delivery_radius', '15', '最大配送半徑(公里)'),
                ('average_preparation_time', '20', '平均準備時間(分鐘)'),
                ('delivery_fee', '50', '配送費用(元)')
                ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value
            `);
            results.push({ task: 'settings_init', status: 'success' });
        } catch (error) {
            results.push({ task: 'settings_init', status: 'error', error: error.message });
        }
        
        // 檢查最終狀態
        const tableResult = await pool.query(`
            SELECT table_name, 
                   (SELECT count(*) FROM information_schema.columns 
                    WHERE table_name = t.table_name AND table_schema = 'public') as column_count
            FROM information_schema.tables t
            WHERE table_schema = 'public' 
              AND table_name NOT LIKE 'pg_%'
              AND table_name NOT LIKE 'sql_%'
            ORDER BY table_name
        `);
        
        console.log('🎉 資料庫初始化完成！');
        
        res.json({
            success: true,
            message: '資料庫初始化完成',
            results: results,
            tables: tableResult.rows,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ 資料庫初始化失敗:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

console.log('✅ 資料庫初始化API已註冊: POST /api/admin/init-database');