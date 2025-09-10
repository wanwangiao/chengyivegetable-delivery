const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

require('dotenv').config();

// 從Railway環境變數取得DATABASE_URL
const DATABASE_URL = process.env.DATABASE_URL;

console.log('🔧 Railway 資料庫初始化開始...');
console.log('DATABASE_URL:', DATABASE_URL ? '✅ 已設定' : '❌ 未設定');

if (!DATABASE_URL) {
    console.error('❌ 找不到 DATABASE_URL 環境變數');
    console.log('請確保在Railway中正確設定了PostgreSQL服務');
    process.exit(1);
}

// 建立資料庫連接
const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
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
        await pool.query(sql);
        console.log(`✅ ${description} 完成`);
        return true;
    } catch (error) {
        console.error(`❌ ${description} 失敗:`, error.message);
        return false;
    }
}

// 主要初始化函數
async function initializeDatabase() {
    try {
        // 測試資料庫連接
        console.log('\n🔍 測試資料庫連接...');
        await pool.query('SELECT NOW()');
        console.log('✅ 資料庫連接成功');

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
            console.log('ℹ️ 商品資料可能已存在:', error.message);
        }

        // 新增系統設定
        try {
            await pool.query(`
                INSERT INTO system_settings (setting_key, setting_value, description) VALUES
                ('store_location', '{"lat": 24.1477, "lng": 120.6736}', '店鋪位置座標'),
                ('max_delivery_radius', '15', '最大配送半徑(公里)'),
                ('average_preparation_time', '20', '平均準備時間(分鐘)'),
                ('delivery_fee', '50', '配送費用(元)')
                ON CONFLICT (setting_key) DO NOTHING
            `);
            console.log('✅ 系統設定初始化完成');
        } catch (error) {
            console.log('ℹ️ 系統設定可能已存在:', error.message);
        }

        // 檢查資料表是否正確建立
        console.log('\n📊 檢查資料表狀態...');
        const result = await pool.query(`
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
        result.rows.forEach(row => {
            console.log(`  • ${row.table_name} (${row.column_count} 欄位)`);
        });

        console.log(`\n🎉 資料庫初始化完成！`);
        console.log(`📊 成功執行: ${successCount}/${sqlFiles.length} 個架構檔案`);
        console.log(`🗃️ 建立資料表: ${result.rows.length} 個`);
        console.log(`\n🚀 系統現在可以正常使用了！`);
        
    } catch (error) {
        console.error('\n❌ 資料庫初始化失敗:', error.message);
        console.error(error.stack);
    } finally {
        await pool.end();
    }
}

// 執行初始化
initializeDatabase().catch(console.error);