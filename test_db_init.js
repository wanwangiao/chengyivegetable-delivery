const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

require('dotenv').config();

// 使用本地環境的DATABASE_URL或者從環境變數配置檔讀取
let DATABASE_URL = process.env.DATABASE_URL;

// 如果沒有找到，使用Supabase的測試連接（僅用於測試初始化腳本）
if (!DATABASE_URL) {
    console.log('⚠️ 本地未設定Railway DATABASE_URL，使用測試連接驗證腳本...');
    DATABASE_URL = 'postgresql://postgres.cywcuzgbuqmxjxwyrrsp:Chengyi2025%21Fresh@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres';
}

console.log('🔧 資料庫初始化腳本測試...');

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

// 檢查檔案存在性
async function checkFiles() {
    console.log('\n📂 檢查SQL檔案...');
    
    const sqlFiles = [
        'schema.sql',
        'realtime_notifications_schema.sql', 
        'smart_route_system_schema.sql',
        'geocoding_cache_schema.sql',
        'gps_tracking_schema.sql',
        'intelligent_routing_schema.sql'
    ];
    
    const availableFiles = [];
    for (const file of sqlFiles) {
        if (readSQLFile(file)) {
            console.log(`✅ ${file} - 存在`);
            availableFiles.push(file);
        } else {
            console.log(`❌ ${file} - 不存在`);
        }
    }
    
    return availableFiles;
}

// 測試資料庫連接
async function testConnection() {
    try {
        console.log('\n🔍 測試資料庫連接...');
        await pool.query('SELECT NOW()');
        console.log('✅ 資料庫連接成功');
        return true;
    } catch (error) {
        console.error('❌ 資料庫連接失敗:', error.message);
        return false;
    }
}

// 主函數
async function main() {
    try {
        // 檢查檔案
        const availableFiles = await checkFiles();
        
        // 測試連接
        const connected = await testConnection();
        
        if (connected) {
            console.log('\n✅ 初始化腳本準備就緒');
            console.log(`📁 可用SQL檔案: ${availableFiles.length} 個`);
            console.log('\n📋 建議執行步驟:');
            console.log('1. 在Railway中取得PostgreSQL的DATABASE_URL');
            console.log('2. 設定環境變數: DATABASE_URL="你的Railway資料庫URL"');
            console.log('3. 執行: node initialize_database.js');
        }
        
    } catch (error) {
        console.error('❌ 測試失敗:', error.message);
    } finally {
        await pool.end();
    }
}

main().catch(console.error);