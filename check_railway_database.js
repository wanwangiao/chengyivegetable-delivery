const { Pool } = require('pg');

console.log('🚂 Railway PostgreSQL 連接檢查器');
console.log('📅 執行時間:', new Date().toLocaleString('zh-TW'));

// 直接使用線上系統的連接方式 (模擬Railway環境)
async function checkRailwayConnection() {
    // 方法1: 檢查環境變數
    console.log('\n📋 環境變數狀態:');
    console.log('  DATABASE_URL:', process.env.DATABASE_URL ? '✅ 已設定' : '❌ 未設定');
    console.log('  NODE_ENV:', process.env.NODE_ENV || '未設定');
    
    if (!process.env.DATABASE_URL) {
        console.log('\n⚠️ 本地環境沒有 Railway DATABASE_URL');
        console.log('💡 建議方案:');
        console.log('1. 從Railway Dashboard複製實際的DATABASE_URL');
        console.log('2. 或直接在Railway環境執行修復腳本');
        console.log('3. 或使用railway CLI: railway run node execute_database_fix.js');
        return false;
    }
    
    // 方法2: 測試連接
    console.log('\n🔗 測試Railway PostgreSQL連接...');
    
    try {
        const pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: false, // Railway internal不需要SSL
            connectionTimeoutMillis: 15000,
            idleTimeoutMillis: 30000,
            max: 5
        });
        
        console.log('⏳ 正在連接...');
        const client = await pool.connect();
        
        // 測試基本查詢
        const timeResult = await client.query('SELECT NOW() as current_time, version() as pg_version');
        console.log('✅ 連接成功!');
        console.log('   時間:', timeResult.rows[0].current_time);
        console.log('   版本:', timeResult.rows[0].pg_version.split(' ')[1]);
        
        // 檢查關鍵表格
        console.log('\n🔍 檢查重要表格結構...');
        
        const tablesResult = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name IN ('orders', 'products', 'drivers', 'offline_queue', 'delivery_photos')
            ORDER BY table_name
        `);
        
        const existingTables = tablesResult.rows.map(row => row.table_name);
        const expectedTables = ['orders', 'products', 'drivers', 'offline_queue', 'delivery_photos'];
        
        console.log('📊 表格狀態:');
        expectedTables.forEach(tableName => {
            const exists = existingTables.includes(tableName);
            console.log(`   ${tableName}: ${exists ? '✅ 存在' : '❌ 不存在'}`);
        });
        
        // 檢查訂單資料
        const orderCountResult = await client.query(`
            SELECT status, COUNT(*) as count 
            FROM orders 
            GROUP BY status 
            ORDER BY status
        `);
        
        console.log('\n📦 訂單狀態統計:');
        if (orderCountResult.rows.length === 0) {
            console.log('   ⚠️ 沒有訂單資料');
        } else {
            orderCountResult.rows.forEach(row => {
                console.log(`   ${row.status}: ${row.count}筆`);
            });
        }
        
        // 檢查外送員資料
        const driverResult = await client.query(`
            SELECT name, phone, status 
            FROM drivers 
            WHERE phone = '0912345678'
            LIMIT 1
        `);
        
        console.log('\n🚚 測試外送員狀態:');
        if (driverResult.rows.length === 0) {
            console.log('   ❌ 測試外送員 (0912345678) 不存在');
        } else {
            const driver = driverResult.rows[0];
            console.log(`   ✅ ${driver.name} (${driver.phone}) - ${driver.status}`);
        }
        
        client.release();
        await pool.end();
        
        console.log('\n🎯 結論:');
        console.log('✅ Railway PostgreSQL 連接正常');
        
        const missingTables = expectedTables.filter(table => !existingTables.includes(table));
        if (missingTables.length > 0) {
            console.log('⚠️ 需要執行資料庫修復腳本，缺少表格:', missingTables.join(', '));
        } else {
            console.log('✅ 所有必要表格都存在');
        }
        
        return true;
        
    } catch (error) {
        console.error('❌ 連接失敗:', error.message);
        console.log('\n💡 可能原因:');
        console.log('1. DATABASE_URL格式不正確');
        console.log('2. Railway PostgreSQL服務未啟動');
        console.log('3. 網路連接問題');
        console.log('4. 需要在Railway環境中執行');
        
        return false;
    }
}

// 主要執行函數
async function main() {
    try {
        const success = await checkRailwayConnection();
        
        if (success) {
            console.log('\n🚀 下一步: 執行外送員資料庫修復');
            console.log('   指令: node execute_database_fix.js');
        } else {
            console.log('\n❌ 需要先解決連接問題才能繼續');
        }
        
        process.exit(success ? 0 : 1);
        
    } catch (error) {
        console.error('💥 執行過程發生錯誤:', error);
        process.exit(1);
    }
}

main();