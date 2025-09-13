/**
 * 完整清理資料庫中的所有測試數據
 * 僅保留必要的系統設定
 */

const axios = require('axios');

const BASE_URL = 'https://chengyivegetable-production-7b4a.up.railway.app';

console.log('🧹 開始完整清理資料庫...');
console.log('📅 執行時間:', new Date().toLocaleString('zh-TW'));
console.log('⚠️ 這將清除所有測試數據，包括:');
console.log('   - 所有訂單和訂單明細');
console.log('   - 所有商品數據'); 
console.log('   - 庫存數據');
console.log('   - 用戶數據');
console.log('   - 其他測試數據');

async function performDatabaseCleanup() {
    
    console.log('\n🎯 建議的清理SQL指令:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const cleanupSQL = `
-- 1. 清除訂單相關數據
DELETE FROM order_items;
DELETE FROM orders;
ALTER SEQUENCE orders_id_seq RESTART WITH 1;
ALTER SEQUENCE order_items_id_seq RESTART WITH 1;

-- 2. 清除商品相關數據
DELETE FROM products;
DELETE FROM categories;
DELETE FROM inventory;
ALTER SEQUENCE products_id_seq RESTART WITH 1;
ALTER SEQUENCE categories_id_seq RESTART WITH 1;

-- 3. 清除用戶數據
DELETE FROM users;
ALTER SEQUENCE users_id_seq RESTART WITH 1;

-- 4. 清除其他測試數據
DELETE FROM notifications WHERE message LIKE '%測試%' OR message LIKE '%demo%';
DELETE FROM settings WHERE key LIKE '%demo%' OR key LIKE '%test%';

-- 5. 重置基本設定為預設值
UPDATE settings SET value = 'false' WHERE key = 'demoMode';
UPDATE settings SET value = '50' WHERE key = 'deliveryFee';
UPDATE settings SET value = '200' WHERE key = 'freeDeliveryThreshold';

-- 6. 驗證清理結果
SELECT 'orders' as table_name, COUNT(*) as count FROM orders
UNION ALL
SELECT 'order_items', COUNT(*) FROM order_items
UNION ALL  
SELECT 'products', COUNT(*) FROM products
UNION ALL
SELECT 'categories', COUNT(*) FROM categories
UNION ALL
SELECT 'inventory', COUNT(*) FROM inventory
UNION ALL
SELECT 'users', COUNT(*) FROM users;
`;

    console.log(cleanupSQL);
    
    console.log('\n📋 執行建議:');
    console.log('1. 複製上述SQL指令');
    console.log('2. 登入Railway資料庫控制台');
    console.log('3. 在PostgreSQL控制台執行這些SQL指令');
    console.log('4. 確認所有表格都顯示 count = 0');
    
    console.log('\n✨ 清理完成後，系統狀態應該是:');
    console.log('✅ 後台訂單管理: 顯示「目前沒有訂單」');
    console.log('✅ 庫存管理: 顯示「目前沒有商品」');
    console.log('✅ 外送員系統: 顯示「目前沒有可接訂單」');
    console.log('✅ 前台: 顯示「商品準備中」或空白選單');
    
    console.log('\n🔧 或者，如果您希望保留一些基本商品數據用於測試，');
    console.log('只需要清理訂單和用戶數據:');
    
    const minimalCleanupSQL = `
-- 只清理訂單和用戶，保留商品
DELETE FROM order_items;
DELETE FROM orders;
DELETE FROM users;
DELETE FROM notifications WHERE message LIKE '%測試%';
ALTER SEQUENCE orders_id_seq RESTART WITH 1;
ALTER SEQUENCE order_items_id_seq RESTART WITH 1;
ALTER SEQUENCE users_id_seq RESTART WITH 1;
`;
    
    console.log(minimalCleanupSQL);
}

performDatabaseCleanup();