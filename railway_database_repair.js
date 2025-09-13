const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

console.log('🚂 Railway 外送員資料庫修復器');
console.log('📅 執行時間:', new Date().toLocaleString('zh-TW'));
console.log('🌍 執行環境:', process.env.NODE_ENV || 'development');

/**
 * 在 Railway 環境中執行外送員資料庫修復
 * 此腳本專門設計在 Railway 部署環境中執行
 */
async function repairDriverDatabase() {
    // 檢查環境
    console.log('\n🔍 環境檢查:');
    console.log('  DATABASE_URL:', process.env.DATABASE_URL ? '✅ 已設定' : '❌ 未設定');
    console.log('  PORT:', process.env.PORT || '未設定');
    
    if (!process.env.DATABASE_URL) {
        console.log('❌ DATABASE_URL 未設定，無法連接資料庫');
        return false;
    }
    
    let pool = null;
    
    try {
        // 建立資料庫連接
        pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: false, // Railway internal 不需要 SSL
            connectionTimeoutMillis: 30000,
            idleTimeoutMillis: 60000,
            max: 10
        });
        
        console.log('\n🔗 連接 Railway PostgreSQL...');
        const client = await pool.connect();
        
        // 確認連接
        const timeResult = await client.query('SELECT NOW() as current_time');
        console.log('✅ 資料庫連接成功:', timeResult.rows[0].current_time);
        
        console.log('\n📊 修復前狀態檢查...');
        
        // 檢查訂單狀態
        const orderStatusResult = await client.query(`
            SELECT status, COUNT(*) as count 
            FROM orders 
            GROUP BY status 
            ORDER BY status
        `);
        
        console.log('📦 修復前訂單狀態:');
        orderStatusResult.rows.forEach(row => {
            console.log(`   ${row.status}: ${row.count}筆`);
        });
        
        // 檢查測試訂單
        const testOrderResult = await client.query(`
            SELECT order_number, customer_name, status 
            FROM orders 
            WHERE order_number LIKE 'TEST%'
        `);
        
        if (testOrderResult.rows.length > 0) {
            console.log('⚠️ 發現現有測試訂單:');
            testOrderResult.rows.forEach(row => {
                console.log(`   ${row.order_number}: ${row.customer_name} (${row.status})`);
            });
        } else {
            console.log('📋 未發現測試訂單，將建立新的');
        }
        
        console.log('\n🔧 開始執行外送員資料庫修復...');
        
        // === 修復步驟 1: 檢查並新增 orders 表鎖定欄位 ===
        console.log('\n1️⃣ 檢查 orders 表鎖定欄位...');
        
        try {
            const lockColumnCheck = await client.query(`
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'orders' 
                AND column_name IN ('locked_by', 'locked_at', 'lock_expires_at')
            `);
            
            const existingColumns = lockColumnCheck.rows.map(row => row.column_name);
            const neededColumns = ['locked_by', 'locked_at', 'lock_expires_at'];
            const missingColumns = neededColumns.filter(col => !existingColumns.includes(col));
            
            if (missingColumns.length > 0) {
                console.log('   新增鎖定欄位:', missingColumns.join(', '));
                await client.query(`
                    ALTER TABLE orders 
                    ADD COLUMN IF NOT EXISTS locked_by INTEGER,
                    ADD COLUMN IF NOT EXISTS locked_at TIMESTAMP,
                    ADD COLUMN IF NOT EXISTS lock_expires_at TIMESTAMP
                `);
                
                // 新增索引
                await client.query(`
                    CREATE INDEX IF NOT EXISTS idx_orders_locked_by ON orders(locked_by);
                    CREATE INDEX IF NOT EXISTS idx_orders_lock_expires ON orders(lock_expires_at);
                `);
                
                console.log('   ✅ orders 表鎖定欄位新增完成');
            } else {
                console.log('   ✅ orders 表鎖定欄位已存在');
            }
        } catch (error) {
            console.log('   ⚠️ orders 表修復警告:', error.message);
        }
        
        // === 修復步驟 2: 建立外送員系統表格 ===
        console.log('\n2️⃣ 建立外送員系統表格...');
        
        const tables = [
            {
                name: 'offline_queue',
                sql: `
                    CREATE TABLE IF NOT EXISTS offline_queue (
                        id SERIAL PRIMARY KEY,
                        driver_id INTEGER NOT NULL,
                        action_type VARCHAR(50) NOT NULL,
                        order_id INTEGER,
                        data_payload TEXT,
                        file_paths TEXT[],
                        status VARCHAR(20) DEFAULT 'pending',
                        created_at TIMESTAMP DEFAULT NOW(),
                        processed_at TIMESTAMP
                    );
                    CREATE INDEX IF NOT EXISTS idx_offline_queue_driver ON offline_queue(driver_id);
                    CREATE INDEX IF NOT EXISTS idx_offline_queue_status ON offline_queue(status);
                `
            },
            {
                name: 'delivery_photos',
                sql: `
                    CREATE TABLE IF NOT EXISTS delivery_photos (
                        id SERIAL PRIMARY KEY,
                        order_id INTEGER NOT NULL,
                        driver_id INTEGER NOT NULL,
                        photo_type VARCHAR(50) NOT NULL,
                        original_filename VARCHAR(255),
                        stored_filename VARCHAR(255),
                        file_path TEXT NOT NULL,
                        file_size INTEGER,
                        upload_timestamp TIMESTAMP DEFAULT NOW()
                    );
                    CREATE INDEX IF NOT EXISTS idx_delivery_photos_order ON delivery_photos(order_id);
                    CREATE INDEX IF NOT EXISTS idx_delivery_photos_driver ON delivery_photos(driver_id);
                `
            },
            {
                name: 'delivery_problems',
                sql: `
                    CREATE TABLE IF NOT EXISTS delivery_problems (
                        id SERIAL PRIMARY KEY,
                        order_id INTEGER NOT NULL,
                        driver_id INTEGER NOT NULL,
                        problem_type VARCHAR(50) NOT NULL,
                        problem_description TEXT,
                        priority VARCHAR(20) DEFAULT 'normal',
                        status VARCHAR(20) DEFAULT 'reported',
                        reported_at TIMESTAMP DEFAULT NOW(),
                        resolved_at TIMESTAMP
                    );
                    CREATE INDEX IF NOT EXISTS idx_delivery_problems_order ON delivery_problems(order_id);
                    CREATE INDEX IF NOT EXISTS idx_delivery_problems_driver ON delivery_problems(driver_id);
                    CREATE INDEX IF NOT EXISTS idx_delivery_problems_status ON delivery_problems(status);
                `
            }
        ];
        
        for (const table of tables) {
            try {
                await client.query(table.sql);
                console.log(`   ✅ ${table.name} 表建立完成`);
            } catch (error) {
                console.log(`   ⚠️ ${table.name} 表建立警告:`, error.message);
            }
        }
        
        // === 修復步驟 3: 確保外送員測試帳號存在 ===
        console.log('\n3️⃣ 檢查外送員測試帳號...');
        
        try {
            // 確保 drivers 表存在
            await client.query(`
                CREATE TABLE IF NOT EXISTS drivers (
                    id SERIAL PRIMARY KEY,
                    driver_code VARCHAR(50) UNIQUE,
                    name VARCHAR(100) NOT NULL,
                    phone VARCHAR(20) UNIQUE NOT NULL,
                    password_hash VARCHAR(255),
                    status VARCHAR(20) DEFAULT 'available',
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                );
            `);
            
            // 檢查測試外送員
            const driverCheck = await client.query(`
                SELECT id, name, phone, status 
                FROM drivers 
                WHERE phone = '0912345678'
            `);
            
            if (driverCheck.rows.length === 0) {
                await client.query(`
                    INSERT INTO drivers (driver_code, name, phone, password_hash, status) 
                    VALUES ('driver_001', '測試外送員', '0912345678', '$2b$10$rQZ1QZ1QZ1QZ1QZ1QZ1QZO', 'available')
                `);
                console.log('   ✅ 測試外送員帳號建立完成');
            } else {
                console.log('   ✅ 測試外送員帳號已存在:', driverCheck.rows[0].name);
            }
        } catch (error) {
            console.log('   ⚠️ 外送員帳號檢查警告:', error.message);
        }
        
        // === 修復步驟 4: 建立測試訂單資料 ===
        console.log('\n4️⃣ 建立測試訂單資料...');
        
        try {
            // 檢查現有測試訂單
            const existingTestOrders = await client.query(`
                SELECT order_number FROM orders WHERE order_number LIKE 'TEST%'
            `);
            
            if (existingTestOrders.rows.length === 0) {
                const testOrders = [
                    {
                        order_number: 'TEST001',
                        customer_name: '測試客戶A',
                        customer_phone: '0987654321',
                        address: '新北市三峽區中華路100號',
                        status: 'packed',
                        subtotal: 200,
                        delivery_fee: 50,
                        total: 250
                    },
                    {
                        order_number: 'TEST002',
                        customer_name: '測試客戶B',
                        customer_phone: '0987654322',
                        address: '新北市樹林區中正路200號',
                        status: 'packed',
                        subtotal: 300,
                        delivery_fee: 50,
                        total: 350
                    },
                    {
                        order_number: 'TEST003',
                        customer_name: '測試客戶C',
                        customer_phone: '0987654323',
                        address: '桃園市桃園區民生路300號',
                        status: 'packed',
                        subtotal: 150,
                        delivery_fee: 50,
                        total: 200
                    }
                ];
                
                for (const order of testOrders) {
                    await client.query(`
                        INSERT INTO orders (order_number, customer_name, customer_phone, address, status, subtotal, delivery_fee, total, created_at)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
                    `, [order.order_number, order.customer_name, order.customer_phone, order.address, order.status, order.subtotal, order.delivery_fee, order.total]);
                }
                
                console.log('   ✅ 3筆測試訂單建立完成');
            } else {
                console.log('   ✅ 測試訂單已存在，跳過建立');
            }
        } catch (error) {
            console.log('   ⚠️ 測試訂單建立警告:', error.message);
        }
        
        // === 驗證修復結果 ===
        console.log('\n🔍 驗證修復結果...');
        
        const finalOrderCheck = await client.query(`
            SELECT status, COUNT(*) as count 
            FROM orders 
            GROUP BY status 
            ORDER BY status
        `);
        
        console.log('📊 修復後訂單狀態分布:');
        finalOrderCheck.rows.forEach(row => {
            console.log(`   ${row.status}: ${row.count}筆`);
        });
        
        const finalTestOrderCheck = await client.query(`
            SELECT order_number, customer_name, status, total 
            FROM orders 
            WHERE order_number LIKE 'TEST%' 
            ORDER BY order_number
        `);
        
        if (finalTestOrderCheck.rows.length > 0) {
            console.log('✅ 測試訂單確認:');
            finalTestOrderCheck.rows.forEach(row => {
                console.log(`   ${row.order_number}: ${row.customer_name} - NT$${row.total} (${row.status})`);
            });
        }
        
        client.release();
        
        console.log('\n🎉 Railway 外送員資料庫修復完成!');
        console.log('🎯 測試建議:');
        console.log('1. 使用外送員帳號 0912345678/driver123 登入');
        console.log('2. 檢查是否能看到可接單的訂單');
        console.log('3. 測試勾選訂單加入訂單欄功能');
        
        return true;
        
    } catch (error) {
        console.error('❌ 修復過程發生錯誤:', error);
        return false;
    } finally {
        if (pool) {
            await pool.end();
        }
    }
}

// 執行修復
repairDriverDatabase()
    .then(success => {
        if (success) {
            console.log('\n🏆 修復成功完成');
            process.exit(0);
        } else {
            console.log('\n💥 修復失敗');
            process.exit(1);
        }
    })
    .catch(error => {
        console.error('💥 程序執行失敗:', error);
        process.exit(1);
    });