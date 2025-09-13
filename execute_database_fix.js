const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

console.log('🔧 外送員資料庫修復執行器');
console.log('📅 執行時間:', new Date().toLocaleString('zh-TW'));

// 資料庫連接配置 - 只使用 Railway PostgreSQL
const databaseConfigs = [
    {
        name: 'Railway PostgreSQL',
        connectionString: process.env.DATABASE_URL,
        enabled: !!process.env.DATABASE_URL
    }
];

async function executeFixScript() {
    console.log('\n🔍 可用的資料庫連接:');
    
    let successfulConnection = null;
    
    // 嘗試每個資料庫連接
    for (const config of databaseConfigs) {
        if (!config.enabled) {
            console.log(`⏭️ 跳過 ${config.name}: 連接字串未設定`);
            continue;
        }
        
        console.log(`\n🔗 嘗試連接 ${config.name}...`);
        
        try {
            const pool = new Pool({
                connectionString: config.connectionString,
                ssl: false, // Railway internal 不需要 SSL
                connectionTimeoutMillis: 10000,
                idleTimeoutMillis: 30000,
                max: 1
            });
            
            // 測試連接
            const client = await pool.connect();
            const result = await client.query('SELECT NOW() as current_time');
            console.log(`✅ ${config.name} 連接成功!`, result.rows[0]);
            
            client.release();
            successfulConnection = { config, pool };
            break;
            
        } catch (error) {
            console.log(`❌ ${config.name} 連接失敗:`, error.message);
        }
    }
    
    if (!successfulConnection) {
        console.log('\n🚨 所有資料庫連接都失敗，無法執行修復腳本');
        return false;
    }
    
    console.log(`\n🎯 使用 ${successfulConnection.config.name} 執行修復...`);
    
    try {
        // 讀取修復腳本
        const scriptPath = path.join(__dirname, 'fix_driver_database.sql');
        if (!fs.existsSync(scriptPath)) {
            console.log('❌ 修復腳本檔案不存在:', scriptPath);
            return false;
        }
        
        const sqlScript = fs.readFileSync(scriptPath, 'utf8');
        console.log('📄 修復腳本載入成功, 大小:', sqlScript.length, '字元');
        
        // 執行腳本前先檢查現狀
        console.log('\n🔍 檢查執行前的資料狀態...');
        const client = await successfulConnection.pool.connect();
        
        try {
            // 檢查訂單數量和狀態
            const orderCheck = await client.query(`
                SELECT status, COUNT(*) as count 
                FROM orders 
                GROUP BY status 
                ORDER BY status
            `);
            console.log('📊 當前訂單狀態分布:');
            orderCheck.rows.forEach(row => {
                console.log(`   ${row.status}: ${row.count}筆`);
            });
            
            // 檢查是否已有測試訂單
            const testOrderCheck = await client.query(`
                SELECT order_number, customer_name, status 
                FROM orders 
                WHERE order_number LIKE 'TEST%' 
                ORDER BY order_number
            `);
            
            if (testOrderCheck.rows.length > 0) {
                console.log('⚠️ 發現現有測試訂單:');
                testOrderCheck.rows.forEach(row => {
                    console.log(`   ${row.order_number}: ${row.customer_name} (${row.status})`);
                });
            } else {
                console.log('📋 未發現測試訂單，將新建立');
            }
            
            // 執行修復腳本
            console.log('\n🔧 開始執行修復腳本...');
            await client.query(sqlScript);
            console.log('✅ 修復腳本執行完成!');
            
            // 驗證修復結果
            console.log('\n🔍 驗證修復結果...');
            
            // 檢查新的訂單狀態
            const newOrderCheck = await client.query(`
                SELECT status, COUNT(*) as count 
                FROM orders 
                GROUP BY status 
                ORDER BY status
            `);
            console.log('📊 修復後訂單狀態分布:');
            newOrderCheck.rows.forEach(row => {
                console.log(`   ${row.status}: ${row.count}筆`);
            });
            
            // 檢查測試訂單
            const newTestOrderCheck = await client.query(`
                SELECT order_number, customer_name, status, total 
                FROM orders 
                WHERE order_number LIKE 'TEST%' 
                ORDER BY order_number
            `);
            
            if (newTestOrderCheck.rows.length > 0) {
                console.log('✅ 測試訂單建立成功:');
                newTestOrderCheck.rows.forEach(row => {
                    console.log(`   ${row.order_number}: ${row.customer_name} - NT$${row.total} (${row.status})`);
                });
            } else {
                console.log('⚠️ 測試訂單未建立成功');
            }
            
            // 檢查外送員表
            const driverCheck = await client.query(`
                SELECT name, phone, status 
                FROM drivers 
                WHERE phone = '0912345678'
            `);
            
            if (driverCheck.rows.length > 0) {
                console.log('✅ 測試外送員確認存在:', driverCheck.rows[0]);
            } else {
                console.log('⚠️ 測試外送員不存在');
            }
            
            // 檢查新建立的表
            const tableCheck = await client.query(`
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name IN ('offline_queue', 'delivery_photos', 'delivery_problems')
                ORDER BY table_name
            `);
            
            console.log('📋 外送員系統表格狀態:');
            const expectedTables = ['offline_queue', 'delivery_photos', 'delivery_problems'];
            expectedTables.forEach(tableName => {
                const exists = tableCheck.rows.some(row => row.table_name === tableName);
                console.log(`   ${tableName}: ${exists ? '✅ 存在' : '❌ 不存在'}`);
            });
            
            console.log('\n🎉 資料庫修復執行完成!');
            console.log('👉 請用外送員帳號 0912345678/driver123 測試登入');
            console.log('🎯 預期結果: 應該看到可接單的訂單，並能勾選加入訂單欄');
            
            return true;
            
        } finally {
            client.release();
            await successfulConnection.pool.end();
        }
        
    } catch (error) {
        console.error('❌ 執行修復腳本時發生錯誤:', error);
        return false;
    }
}

// 執行修復
executeFixScript()
    .then(success => {
        if (success) {
            console.log('\n🏆 修復程序成功完成');
            process.exit(0);
        } else {
            console.log('\n💥 修復程序失敗');
            process.exit(1);
        }
    })
    .catch(error => {
        console.error('💥 程序執行失敗:', error);
        process.exit(1);
    });