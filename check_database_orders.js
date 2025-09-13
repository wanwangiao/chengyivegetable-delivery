/**
 * 直接檢查Railway資料庫中的訂單狀態
 * 用來確認"11筆舊訂單"的實際情況
 */

// 需要設定環境變數
require('dotenv').config();

const { Pool } = require('pg');

console.log('🔍 檢查Railway資料庫中的訂單狀態');
console.log('📅 執行時間:', new Date().toLocaleString('zh-TW'));

/**
 * 檢查資料庫訂單狀態
 */
async function checkDatabaseOrders() {
    let pool = null;
    
    try {
        // 嘗試連接資料庫
        const dbUrl = process.env.DATABASE_URL;
        if (!dbUrl) {
            throw new Error('未找到 DATABASE_URL 環境變數');
        }
        
        console.log('🔗 連接資料庫...');
        console.log('📍 資料庫URL:', dbUrl.substring(0, 30) + '...');
        
        pool = new Pool({
            connectionString: dbUrl,
            ssl: dbUrl.includes('railway') ? { rejectUnauthorized: false } : false
        });
        
        // 測試連接
        await pool.query('SELECT NOW()');
        console.log('✅ 資料庫連接成功');
        
        console.log('\n📊 1. 檢查所有訂單的狀態分佈:');
        console.log('═══════════════════════════════');
        
        try {
            const statusResult = await pool.query('SELECT status, COUNT(*) as count FROM orders GROUP BY status ORDER BY count DESC');
            
            if (statusResult.rows.length === 0) {
                console.log('⚠️ 資料庫中沒有任何訂單');
            } else {
                console.log('訂單狀態統計:');
                statusResult.rows.forEach(row => {
                    console.log(`  ${row.status}: ${row.count} 筆`);
                });
                
                const totalOrders = statusResult.rows.reduce((sum, row) => sum + parseInt(row.count), 0);
                console.log(`📊 總訂單數: ${totalOrders} 筆`);
                
                // 檢查是否有packed狀態的訂單
                const packedOrders = statusResult.rows.find(row => row.status === 'packed');
                if (packedOrders) {
                    console.log(`🎯 關鍵發現: 有 ${packedOrders.count} 筆 'packed' 狀態的訂單`);
                } else {
                    console.log('⚠️ 沒有 "packed" 狀態的訂單');
                }
            }
        } catch (error) {
            console.log('❌ 檢查訂單狀態失敗:', error.message);
        }
        
        console.log('\n📊 2. 檢查已分配的訂單:');
        console.log('═══════════════════════════');
        
        try {
            const driverResult = await pool.query('SELECT driver_id, COUNT(*) as count FROM orders WHERE driver_id IS NOT NULL GROUP BY driver_id');
            
            if (driverResult.rows.length === 0) {
                console.log('✅ 沒有訂單被分配給外送員');
            } else {
                console.log('已分配的訂單:');
                driverResult.rows.forEach(row => {
                    console.log(`  外送員ID ${row.driver_id}: ${row.count} 筆`);
                });
            }
        } catch (error) {
            console.log('❌ 檢查已分配訂單失敗:', error.message);
        }
        
        console.log('\n📊 3. 檢查可接取的訂單 (packed + 未分配):');
        console.log('═══════════════════════════════════════');
        
        try {
            const availableResult = await pool.query(`
                SELECT id, customer_name, address, total_amount, status, driver_id, created_at 
                FROM orders 
                WHERE status = 'packed' AND driver_id IS NULL 
                ORDER BY created_at DESC 
                LIMIT 15
            `);
            
            if (availableResult.rows.length === 0) {
                console.log('⚠️ 沒有可接取的訂單 (packed + 未分配)');
                console.log('');
                console.log('這解釋了為什麼外送員API返回0筆訂單！');
            } else {
                console.log(`✅ 找到 ${availableResult.rows.length} 筆可接取的訂單:`);
                availableResult.rows.forEach((order, index) => {
                    console.log(`  ${index + 1}. 訂單#${order.id} - ${order.customer_name} - ${order.address} - NT$${order.total_amount} (${order.created_at.toLocaleDateString()})`);
                });
            }
        } catch (error) {
            console.log('❌ 檢查可接取訂單失敗:', error.message);
        }
        
        console.log('\n📊 4. 檢查地址包含地區關鍵字的訂單:');
        console.log('═══════════════════════════════════');
        
        try {
            const areaResult = await pool.query(`
                SELECT id, address, status, driver_id, created_at
                FROM orders 
                WHERE address LIKE '%三峽%' OR address LIKE '%樹林%' OR address LIKE '%鶯歌%' OR address LIKE '%土城%' OR address LIKE '%北大%'
                ORDER BY created_at DESC 
                LIMIT 20
            `);
            
            if (areaResult.rows.length === 0) {
                console.log('⚠️ 沒有包含目標地區關鍵字的訂單');
                console.log('');
                console.log('可能的問題:');
                console.log('1. 地址欄位不包含 "三峽", "樹林", "鶯歌" 等關鍵字');
                console.log('2. 地址欄位可能使用不同的格式或名稱');
            } else {
                console.log(`✅ 找到 ${areaResult.rows.length} 筆包含地區關鍵字的訂單:`);
                areaResult.rows.forEach((order, index) => {
                    const statusIcon = order.status === 'packed' && !order.driver_id ? '🟢' : '🔴';
                    const driverText = order.driver_id ? `(外送員${order.driver_id})` : '(未分配)';
                    console.log(`  ${index + 1}. ${statusIcon} 訂單#${order.id} - ${order.status} ${driverText}`);
                    console.log(`      地址: ${order.address}`);
                });
            }
        } catch (error) {
            console.log('❌ 檢查地區訂單失敗:', error.message);
        }
        
        console.log('\n📊 5. 檢查orders表結構:');
        console.log('═══════════════════════════');
        
        try {
            const structureResult = await pool.query(`
                SELECT column_name, data_type, is_nullable
                FROM information_schema.columns 
                WHERE table_name = 'orders' 
                ORDER BY ordinal_position
            `);
            
            console.log('orders表的欄位結構:');
            structureResult.rows.forEach(col => {
                console.log(`  ${col.column_name}: ${col.data_type} ${col.is_nullable === 'YES' ? '(可空)' : '(必填)'}`);
            });
        } catch (error) {
            console.log('❌ 檢查表結構失敗:', error.message);
        }
        
        console.log('\n📊 6. 抽樣檢查實際訂單內容:');
        console.log('═══════════════════════════════');
        
        try {
            const sampleResult = await pool.query(`
                SELECT id, customer_name, address, status, driver_id, total_amount, created_at
                FROM orders 
                ORDER BY created_at DESC 
                LIMIT 10
            `);
            
            if (sampleResult.rows.length === 0) {
                console.log('⚠️ 資料庫中完全沒有訂單數據');
            } else {
                console.log(`📋 最近的 ${sampleResult.rows.length} 筆訂單:`);
                sampleResult.rows.forEach((order, index) => {
                    const availableIcon = order.status === 'packed' && !order.driver_id ? '🟢可接取' : '🔴不可接取';
                    console.log(`  ${index + 1}. ${availableIcon} #${order.id} - ${order.customer_name || '無名稱'}`);
                    console.log(`      狀態: ${order.status}, 外送員: ${order.driver_id || '未分配'}`);
                    console.log(`      地址: ${order.address || '無地址'}`);
                    console.log(`      金額: NT$${order.total_amount || 0}, 時間: ${order.created_at?.toLocaleString() || '無時間'}`);
                    console.log('');
                });
            }
        } catch (error) {
            console.log('❌ 檢查訂單內容失敗:', error.message);
        }
        
        return { success: true };
        
    } catch (error) {
        console.error('\n❌ 資料庫檢查失敗:', error.message);
        
        if (error.code) {
            console.log('錯誤代碼:', error.code);
        }
        
        if (error.message.includes('ENOTFOUND')) {
            console.log('');
            console.log('🔍 可能的解決方案:');
            console.log('1. 檢查網路連線是否正常');
            console.log('2. 確認 DATABASE_URL 環境變數設定正確');
            console.log('3. 檢查 Railway 資料庫服務是否正常運行');
        }
        
        return { success: false, error: error.message };
        
    } finally {
        if (pool) {
            await pool.end();
            console.log('🔒 資料庫連接已關閉');
        }
    }
}

// 提供建議的修復方案
function provideSolutions() {
    console.log('\n💡 根據檢查結果的修復建議:');
    console.log('═══════════════════════════════════');
    console.log('');
    console.log('如果沒有可接取訂單 (packed + 未分配):');
    console.log('1. 創建測試訂單:');
    console.log('   INSERT INTO orders (customer_name, address, status, driver_id, total_amount, created_at)');
    console.log("   VALUES ('測試客戶', '新北市三峽區中山路123號', 'packed', NULL, 150, NOW());");
    console.log('');
    console.log('2. 將現有訂單設為可接取狀態:');
    console.log("   UPDATE orders SET status = 'packed', driver_id = NULL WHERE id IN (SELECT id FROM orders LIMIT 5);");
    console.log('');
    console.log('如果地址不包含地區關鍵字:');
    console.log('3. 更新訂單地址:');
    console.log("   UPDATE orders SET address = '新北市三峽區' || address WHERE address NOT LIKE '%三峽%' AND id <= 5;");
    console.log('');
    console.log('驗證修復結果:');
    console.log('4. 重新運行外送員系統測試');
    console.log('5. 檢查 API 是否返回正確的訂單數量');
}

// 執行檢查
checkDatabaseOrders()
    .then(result => {
        if (result.success) {
            console.log('\n🏆 資料庫檢查完成');
            provideSolutions();
        } else {
            console.log('\n💥 資料庫檢查失敗:', result.error);
            console.log('無法連接到資料庫，請檢查環境配置');
        }
    })
    .catch(error => {
        console.error('檢查執行失敗:', error.message);
        console.log('\n📋 替代方案:');
        console.log('1. 手動登錄 Railway 控制台檢查資料庫');
        console.log('2. 使用 Railway CLI 工具: railway connect');
        console.log('3. 直接透過管理後台查看訂單狀態');
    });