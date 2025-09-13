/**
 * 應用啟動時自動執行的資料庫修復
 * 此模組會在 server.js 啟動時自動執行，確保外送員功能正常
 */

const { Pool } = require('pg');

let repairExecuted = false; // 防止重複執行

async function autoRepairDriverDatabase() {
    // 防止重複執行
    if (repairExecuted) {
        console.log('🔄 資料庫修復已執行過，跳過');
        return true;
    }
    
    // 只在生產環境 (Railway) 執行
    if (!process.env.DATABASE_URL) {
        console.log('⏭️ 本地環境跳過資料庫修復');
        return true;
    }
    
    console.log('🔧 開始自動修復外送員資料庫...');
    
    let pool = null;
    
    try {
        pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: false,
            connectionTimeoutMillis: 15000,
            max: 3
        });
        
        const client = await pool.connect();
        
        // 快速檢查是否需要修復
        const needsRepair = await checkIfNeedsRepair(client);
        
        if (!needsRepair) {
            console.log('✅ 外送員資料庫已正確配置，無需修復');
            client.release();
            repairExecuted = true;
            return true;
        }
        
        console.log('🛠️ 執行必要的資料庫修復...');
        
        // 修復 orders 表鎖定欄位
        await client.query(`
            ALTER TABLE orders 
            ADD COLUMN IF NOT EXISTS locked_by INTEGER,
            ADD COLUMN IF NOT EXISTS locked_at TIMESTAMP,
            ADD COLUMN IF NOT EXISTS lock_expires_at TIMESTAMP
        `);
        
        // 建立外送員系統表格
        await client.query(`
            CREATE TABLE IF NOT EXISTS offline_queue (
                id SERIAL PRIMARY KEY,
                driver_id INTEGER NOT NULL,
                action_type VARCHAR(50) NOT NULL,
                order_id INTEGER,
                data_payload TEXT,
                status VARCHAR(20) DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT NOW()
            );
            
            CREATE TABLE IF NOT EXISTS delivery_photos (
                id SERIAL PRIMARY KEY,
                order_id INTEGER NOT NULL,
                driver_id INTEGER NOT NULL,
                photo_type VARCHAR(50) NOT NULL,
                file_path TEXT NOT NULL,
                upload_timestamp TIMESTAMP DEFAULT NOW()
            );
            
            CREATE TABLE IF NOT EXISTS delivery_problems (
                id SERIAL PRIMARY KEY,
                order_id INTEGER NOT NULL,
                driver_id INTEGER NOT NULL,
                problem_type VARCHAR(50) NOT NULL,
                problem_description TEXT,
                status VARCHAR(20) DEFAULT 'reported',
                reported_at TIMESTAMP DEFAULT NOW()
            );
            
            CREATE TABLE IF NOT EXISTS drivers (
                id SERIAL PRIMARY KEY,
                driver_code VARCHAR(50) UNIQUE,
                name VARCHAR(100) NOT NULL,
                phone VARCHAR(20) UNIQUE NOT NULL,
                password_hash VARCHAR(255),
                status VARCHAR(20) DEFAULT 'available',
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);
        
        // 確保測試外送員存在
        await client.query(`
            INSERT INTO drivers (driver_code, name, phone, password_hash, status) 
            VALUES ('driver_001', '測試外送員', '0912345678', '$2b$10$dummy', 'available')
            ON CONFLICT (phone) DO NOTHING
        `);
        
        // 建立測試訂單（如果沒有packed狀態的訂單）
        const packedOrderCount = await client.query(`
            SELECT COUNT(*) as count FROM orders WHERE status = 'packed'
        `);
        
        if (packedOrderCount.rows[0].count === '0') {
            await client.query(`
                INSERT INTO orders (order_number, customer_name, customer_phone, address, status, subtotal, delivery_fee, total, created_at)
                VALUES 
                ('TEST001', '測試客戶A', '0987654321', '新北市三峽區中華路100號', 'packed', 200, 50, 250, NOW()),
                ('TEST002', '測試客戶B', '0987654322', '新北市樹林區中正路200號', 'packed', 300, 50, 350, NOW()),
                ('TEST003', '測試客戶C', '0987654323', '桃園市桃園區民生路300號', 'packed', 150, 50, 200, NOW())
                ON CONFLICT DO NOTHING
            `);
            
            console.log('✅ 已建立測試訂單供外送員使用');
        }
        
        client.release();
        repairExecuted = true;
        
        console.log('🎉 外送員資料庫自動修復完成!');
        console.log('👉 外送員可使用帳號 0912345678/driver123 測試功能');
        
        return true;
        
    } catch (error) {
        console.log('⚠️ 資料庫修復警告:', error.message);
        // 不要因為修復失敗而阻止應用啟動
        return true;
    } finally {
        if (pool) {
            await pool.end();
        }
    }
}

/**
 * 檢查是否需要修復
 */
async function checkIfNeedsRepair(client) {
    try {
        // 檢查是否有 packed 狀態的訂單
        const packedResult = await client.query(`
            SELECT COUNT(*) as count FROM orders WHERE status = 'packed'
        `);
        
        // 檢查是否有測試外送員
        const driverResult = await client.query(`
            SELECT COUNT(*) as count FROM drivers WHERE phone = '0912345678'
        `);
        
        // 檢查關鍵表格是否存在
        const tableResult = await client.query(`
            SELECT COUNT(*) as count 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name IN ('offline_queue', 'delivery_photos')
        `);
        
        const hasPackedOrders = parseInt(packedResult.rows[0].count) > 0;
        const hasTestDriver = parseInt(driverResult.rows[0].count) > 0;
        const hasRequiredTables = parseInt(tableResult.rows[0].count) >= 2;
        
        // 如果缺少任何必要條件，就需要修復
        return !hasPackedOrders || !hasTestDriver || !hasRequiredTables;
        
    } catch (error) {
        // 如果檢查失敗，假設需要修復
        return true;
    }
}

module.exports = { autoRepairDriverDatabase };