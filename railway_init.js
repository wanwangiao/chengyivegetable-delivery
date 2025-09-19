const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// 使用Railway提供的公開URL進行本地連接
const DATABASE_URL = process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL || 'postgresql://postgres:bpBeqwyPkeXWwopKSzBYtcAuhesQRqix@postgres.railway.internal:5432/railway';

console.log('🔧 Railway 資料庫初始化開始...');
console.log('📡 連接到 Railway PostgreSQL...');

// 建立資料庫連接
const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: DATABASE_URL.includes('railway.internal') ? false : { rejectUnauthorized: false }, // 公開連接需要SSL
    connectionTimeoutMillis: 60000,
    idleTimeoutMillis: 30000
});

// 讀取SQL檔案的函數
function readSQLFile(filename) {
    try {
        const filePath = path.join(__dirname, filename);
        if (fs.existsSync(filePath)) {
            return fs.readFileSync(filePath, 'utf8');
        } else {
            console.log(`⚠️ 檔案不存在: ${filename}`);
            return null;
        }
    } catch (error) {
        console.error(`❌ 讀取檔案 ${filename} 失敗:`, error.message);
        return null;
    }
}

// 執行SQL的函數
async function executeSQLFile(filename, description) {
    console.log(`\n📂 執行 ${description}...`);
    const sql = readSQLFile(filename);
    
    if (!sql) {
        console.log(`⚠️ 跳過 ${filename}`);
        return false;
    }
    
    try {
        // 分割SQL語句（處理多個CREATE TABLE等語句）
        const statements = sql.split(';').filter(stmt => stmt.trim().length > 0);
        
        for (const statement of statements) {
            if (statement.trim()) {
                await pool.query(statement);
            }
        }
        
        console.log(`✅ ${description} 完成`);
        return true;
    } catch (error) {
        console.error(`❌ ${description} 失敗:`, error.message);
        // 某些錯誤可能是因為表已存在，繼續執行
        if (error.message.includes('already exists')) {
            console.log(`ℹ️ 表可能已存在，繼續執行...`);
            return true;
        }
        return false;
    }
}

// 主要初始化函數
async function initializeDatabase() {
    try {
        // 測試資料庫連接
        console.log('\n🔍 測試資料庫連接...');
        const result = await pool.query('SELECT NOW(), version()');
        console.log('✅ 資料庫連接成功');
        console.log(`📅 時間: ${result.rows[0].now}`);
        console.log(`🗄️ 版本: ${result.rows[0].version.split(' ').slice(0,2).join(' ')}`);

        // 依序執行SQL檔案
        const sqlFiles = [
            { file: 'schema.sql', desc: '主要資料庫架構' },
            { file: 'realtime_notifications_schema.sql', desc: '即時通訊系統架構' },
            { file: 'smart_route_system_schema.sql', desc: '智能路線系統架構' },
            { file: 'geocoding_cache_schema.sql', desc: '地理編碼快取架構' },
            { file: 'gps_tracking_schema.sql', desc: 'GPS追蹤系統架構' },
            { file: 'intelligent_routing_schema.sql', desc: '智能路線規劃架構' }
        ];

        let successCount = 0;
        for (const { file, desc } of sqlFiles) {
            const success = await executeSQLFile(file, desc);
            if (success) successCount++;
        }

        // 執行基礎資料初始化
        console.log('\n📋 初始化基礎資料...');
        
        // 新增測試商品
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
            console.log('✅ 基礎商品資料初始化完成');
        } catch (error) {
            console.log('ℹ️ 商品資料初始化:', error.message);
        }

        // 新增測試外送員
        try {
            await pool.query(`
                INSERT INTO drivers (driver_id, name, phone, password, status) VALUES
                ('driver_001', '測試外送員', '0912345678', '$2b$10$rQZ1QZ1QZ1QZ1QZ1QZ1QZO', 'available')
                ON CONFLICT (phone) DO NOTHING
            `);
            console.log('✅ 測試外送員初始化完成');
        } catch (error) {
            console.log('ℹ️ 外送員資料可能已存在');
        }

        // 新增系統設定
        try {
            await pool.query(`
                INSERT INTO system_settings (setting_key, setting_value, description) VALUES
                ('store_location', '{"lat": 24.1477, "lng": 120.6736}', '店鋪位置座標'),
                ('max_delivery_radius', '15', '最大配送半徑(公里)'),
                ('average_preparation_time', '20', '平均準備時間(分鐘)'),
                ('delivery_fee', '50', '配送費用(元)')
                ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value
            `);
            console.log('✅ 系統設定初始化完成');
        } catch (error) {
            console.log('ℹ️ 系統設定初始化:', error.message);
        }

        // 檢查資料表是否正確建立
        console.log('\n📊 檢查資料表狀態...');
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

        console.log('\n📋 資料表清單:');
        tableResult.rows.forEach(row => {
            console.log(`  • ${row.table_name} (${row.column_count} 欄位)`);
        });

        // 檢查資料筆數
        console.log('\n📊 資料統計:');
        try {
            const productCount = await pool.query('SELECT COUNT(*) FROM products');
            console.log(`  • 商品數量: ${productCount.rows[0].count}`);
            
            const driverCount = await pool.query('SELECT COUNT(*) FROM drivers');
            console.log(`  • 外送員數量: ${driverCount.rows[0].count}`);
            
            const settingCount = await pool.query('SELECT COUNT(*) FROM system_settings');
            console.log(`  • 系統設定數量: ${settingCount.rows[0].count}`);
        } catch (error) {
            console.log('ℹ️ 部分資料表可能尚未建立');
        }

        console.log(`\n🎉 Railway資料庫初始化完成！`);
        console.log(`📊 執行狀態: ${successCount}/${sqlFiles.length} 個架構檔案`);
        console.log(`🗃️ 建立資料表: ${tableResult.rows.length} 個`);
        console.log(`\n🚀 系統現在可以正常使用了！`);
        console.log(`🌐 測試網址: https://chengyivegetable-production-7b4a.up.railway.app/`);
        
    } catch (error) {
        console.error('\n❌ 資料庫初始化失敗:', error.message);
        console.error(error.stack);
    } finally {
        await pool.end();
    }
}

// 執行初始化
initializeDatabase().catch(console.error);