require('dotenv').config();
const { Pool } = require('pg');

async function testDatabaseConnection() {
    console.log('=== 資料庫連線測試 ===');
    console.log('時間:', new Date().toLocaleString('zh-TW'));
    console.log('DATABASE_URL:', process.env.DATABASE_URL);
    
    // 創建連接池
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: {
            rejectUnauthorized: false
        }
    });

    try {
        console.log('\n正在測試資料庫連線...');
        
        // 測試基本連線
        const client = await pool.connect();
        console.log('✅ 資料庫連線成功！');
        
        // 測試查詢
        console.log('\n正在執行測試查詢...');
        const result = await client.query('SELECT version(), current_database(), current_user, inet_server_addr(), inet_server_port()');
        
        console.log('✅ 查詢執行成功！');
        console.log('資料庫版本:', result.rows[0].version);
        console.log('當前資料庫:', result.rows[0].current_database);
        console.log('當前用戶:', result.rows[0].current_user);
        console.log('伺服器地址:', result.rows[0].inet_server_addr);
        console.log('伺服器端口:', result.rows[0].inet_server_port);
        
        // 測試表格是否存在
        console.log('\n檢查核心表格是否存在...');
        const tablesQuery = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name IN ('products', 'orders', 'drivers', 'customers')
            ORDER BY table_name
        `);
        
        console.log('找到的核心表格:');
        tablesQuery.rows.forEach(row => {
            console.log('  ✅', row.table_name);
        });
        
        // 測試產品數據
        console.log('\n檢查產品數據...');
        const productCount = await client.query('SELECT COUNT(*) as count FROM products');
        console.log('產品總數:', productCount.rows[0].count);
        
        // 測試訂單數據
        console.log('\n檢查訂單數據...');
        const orderCount = await client.query('SELECT COUNT(*) as count FROM orders');
        console.log('訂單總數:', orderCount.rows[0].count);
        
        client.release();
        
        console.log('\n🎉 所有測試通過！資料庫連線正常運作！');
        
    } catch (error) {
        console.error('❌ 資料庫連線測試失敗:');
        console.error('錯誤類型:', error.name);
        console.error('錯誤訊息:', error.message);
        
        if (error.code) {
            console.error('錯誤代碼:', error.code);
        }
        
        if (error.errno) {
            console.error('系統錯誤代碼:', error.errno);
        }
        
        // 提供故障排除建議
        console.log('\n🔧 故障排除建議:');
        
        if (error.message.includes('password authentication failed')) {
            console.log('- 密碼驗證失敗，請檢查密碼是否正確');
            console.log('- 確認密碼已正確進行URL編碼');
        }
        
        if (error.message.includes('getaddrinfo ENOTFOUND') || error.message.includes('connect ETIMEDOUT')) {
            console.log('- 網路連線問題，請檢查網路設定');
            console.log('- 確認防火牆沒有阻擋連接');
            console.log('- 嘗試使用VPN或更換網路');
        }
        
        if (error.message.includes('IPv6')) {
            console.log('- IPv6連線問題，請確認使用IPv4兼容的端點');
            console.log('- 當前使用的是Session Pooler端點，應該支援IPv4');
        }
        
        process.exit(1);
    } finally {
        await pool.end();
        console.log('\n資料庫連接池已關閉');
    }
}

// 執行測試
testDatabaseConnection();