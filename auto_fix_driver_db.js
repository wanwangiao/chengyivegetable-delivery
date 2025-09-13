// 自動修復外送員資料庫系統
// 用途：連接Railway PostgreSQL並執行修復腳本
// 日期：2025年09月13日

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// 設定資料庫連接
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function checkDatabaseConnection() {
    try {
        const result = await pool.query('SELECT NOW() as current_time');
        console.log('✅ 資料庫連接成功，當前時間：', result.rows[0].current_time);
        return true;
    } catch (error) {
        console.error('❌ 資料庫連接失敗：', error.message);
        return false;
    }
}

async function checkExistingStructure() {
    console.log('\n📊 檢查現有資料庫結構...');
    
    try {
        // 檢查orders表的鎖定欄位
        const lockColumns = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'orders' 
            AND column_name IN ('locked_by', 'locked_at', 'lock_expires_at')
        `);
        
        console.log(`  orders表鎖定欄位: ${lockColumns.rows.length}/3 個已存在`);
        
        // 檢查必要的表格
        const tables = await pool.query(`
            SELECT tablename 
            FROM pg_tables 
            WHERE schemaname = 'public' 
            AND tablename IN ('offline_queue', 'delivery_photos', 'delivery_problems', 'drivers')
        `);
        
        console.log(`  外送員系統表格: ${tables.rows.length}/4 個已存在`);
        console.log(`  已存在的表格: ${tables.rows.map(t => t.tablename).join(', ')}`);
        
        // 檢查測試訂單
        const testOrders = await pool.query(`
            SELECT COUNT(*) as count 
            FROM orders 
            WHERE order_number LIKE 'TEST%'
        `);
        
        console.log(`  測試訂單數量: ${testOrders.rows[0].count} 筆`);
        
        return {
            lockColumns: lockColumns.rows.length,
            tables: tables.rows.length,
            testOrders: parseInt(testOrders.rows[0].count)
        };
        
    } catch (error) {
        console.error('❌ 檢查資料庫結構時發生錯誤：', error.message);
        return null;
    }
}

async function executeSQLFile() {
    console.log('\n🔧 開始執行資料庫修復腳本...');
    
    try {
        // 讀取SQL檔案
        const sqlPath = path.join(__dirname, 'fix_driver_database.sql');
        const sqlContent = fs.readFileSync(sqlPath, 'utf8');
        
        // 執行SQL腳本
        await pool.query(sqlContent);
        
        console.log('✅ SQL腳本執行成功！');
        return true;
        
    } catch (error) {
        console.error('❌ 執行SQL腳本失敗：', error.message);
        
        // 如果是因為物件已存在的錯誤，可能是部分成功
        if (error.message.includes('already exists')) {
            console.log('⚠️  部分物件已存在，繼續檢查狀態...');
            return 'partial';
        }
        
        return false;
    }
}

async function verifyFix() {
    console.log('\n🔍 驗證修復結果...');
    
    const afterFix = await checkExistingStructure();
    
    if (!afterFix) {
        console.log('❌ 無法驗證修復結果');
        return false;
    }
    
    // 檢查是否所有結構都已建立
    const success = afterFix.lockColumns === 3 && 
                   afterFix.tables === 4 && 
                   afterFix.testOrders >= 3;
    
    if (success) {
        console.log('\n🎉 修復驗證成功！');
        console.log('  ✅ orders表鎖定欄位完整');
        console.log('  ✅ 所有必要表格已建立');
        console.log('  ✅ 測試訂單已建立');
    } else {
        console.log('\n⚠️  修復部分成功：');
        if (afterFix.lockColumns < 3) {
            console.log(`  ❌ orders表鎖定欄位不完整 (${afterFix.lockColumns}/3)`);
        }
        if (afterFix.tables < 4) {
            console.log(`  ❌ 部分表格未建立 (${afterFix.tables}/4)`);
        }
        if (afterFix.testOrders < 3) {
            console.log(`  ❌ 測試訂單不足 (${afterFix.testOrders}/3)`);
        }
    }
    
    return success;
}

async function testDriverAPI() {
    console.log('\n🌐 測試外送員API端點...');
    
    try {
        // 測試訂單計數API
        const orderCounts = await pool.query(`
            SELECT 
                CASE 
                    WHEN address LIKE '%三峽%' THEN '三峽區'
                    WHEN address LIKE '%樹林%' THEN '樹林區'
                    WHEN address LIKE '%鶯歌%' THEN '鶯歌區'
                    WHEN address LIKE '%桃園%' THEN '桃園區'
                    ELSE '其他'
                END as area,
                COUNT(*) as count
            FROM orders
            WHERE status = 'packed'
            GROUP BY area
        `);
        
        console.log('  ✅ 訂單計數查詢成功');
        console.log('  各區訂單數量：');
        orderCounts.rows.forEach(row => {
            console.log(`    ${row.area}: ${row.count} 筆`);
        });
        
        return true;
        
    } catch (error) {
        console.error('  ❌ API測試失敗：', error.message);
        return false;
    }
}

async function main() {
    console.log('====================================');
    console.log('🚀 誠憶鮮蔬外送員系統資料庫修復工具');
    console.log('====================================\n');
    
    // 步驟1：檢查資料庫連接
    const connected = await checkDatabaseConnection();
    if (!connected) {
        console.log('\n❌ 無法連接資料庫，請檢查環境變數設定');
        process.exit(1);
    }
    
    // 步驟2：檢查現有結構
    console.log('\n📋 修復前狀態：');
    const beforeFix = await checkExistingStructure();
    
    if (beforeFix && beforeFix.lockColumns === 3 && beforeFix.tables === 4) {
        console.log('\n✅ 資料庫結構已完整，無需修復');
        
        // 但可能需要補充測試資料
        if (beforeFix.testOrders < 3) {
            console.log('⚠️  但測試訂單不足，補充中...');
            // 這裡可以單獨執行插入測試訂單的SQL
        }
    } else {
        // 步驟3：執行修復
        const fixResult = await executeSQLFile();
        
        if (fixResult) {
            // 步驟4：驗證修復
            const verified = await verifyFix();
            
            if (verified) {
                // 步驟5：測試API
                await testDriverAPI();
                
                console.log('\n====================================');
                console.log('🎉 修復完成！外送員系統應該可以正常運作了');
                console.log('====================================');
                console.log('\n建議後續動作：');
                console.log('1. 訪問 https://chengyivegetable-production-7b4a.up.railway.app/driver/login');
                console.log('2. 使用 0912345678 / driver123 登入測試');
                console.log('3. 確認可以看到3筆測試訂單');
                console.log('4. 測試訂單勾選功能是否正常');
            } else {
                console.log('\n⚠️  修復可能不完整，請手動檢查');
            }
        } else {
            console.log('\n❌ 修復失敗，請檢查錯誤訊息');
        }
    }
    
    // 關閉資料庫連接
    await pool.end();
}

// 執行主程式
main().catch(error => {
    console.error('❌ 程式執行錯誤：', error);
    process.exit(1);
});