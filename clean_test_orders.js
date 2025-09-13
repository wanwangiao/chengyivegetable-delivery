/**
 * 清除後台的測試訂單數據
 */

const axios = require('axios');

const BASE_URL = 'https://chengyivegetable-production-7b4a.up.railway.app';

console.log('🧹 清除後台測試訂單數據');
console.log('📅 執行時間:', new Date().toLocaleString('zh-TW'));

/**
 * 檢查當前後台訂單數據
 */
async function checkCurrentOrders() {
    try {
        console.log('\n🔍 檢查當前後台訂單...');
        
        const response = await axios.get(`${BASE_URL}/api/admin/orders`, {
            timeout: 10000,
            validateStatus: (status) => status < 500
        });
        
        if (response.status === 200 && response.data) {
            let orders = [];
            
            if (Array.isArray(response.data)) {
                orders = response.data;
            } else if (response.data.orders && Array.isArray(response.data.orders)) {
                orders = response.data.orders;
            }
            
            console.log(`📊 找到 ${orders.length} 筆訂單`);
            
            if (orders.length > 0) {
                console.log('\n📋 訂單列表:');
                orders.forEach((order, index) => {
                    console.log(`${index + 1}. ID: ${order.id}`);
                    console.log(`   客戶: ${order.contact_name || order.customer_name || '未知'}`);
                    console.log(`   電話: ${order.contact_phone || order.customer_phone || '未知'}`);
                    console.log(`   狀態: ${order.status}`);
                    console.log(`   建立時間: ${order.created_at || '未知'}`);
                    console.log(`   總額: ${order.total_amount || order.total || '未知'}`);
                    console.log('   ────────────────');
                });
                
                // 分析是否為測試數據
                const testIndicators = [
                    '測試客戶', '王小明', '李小華', '張小美', '陳大明',
                    'test', 'demo', '示範', '0912345'
                ];
                
                const testOrders = orders.filter(order => {
                    const name = order.contact_name || order.customer_name || '';
                    const phone = order.contact_phone || order.customer_phone || '';
                    return testIndicators.some(indicator => 
                        name.includes(indicator) || phone.includes(indicator)
                    );
                });
                
                console.log(`\n🎭 疑似測試訂單: ${testOrders.length} 筆`);
                console.log(`📝 可能真實訂單: ${orders.length - testOrders.length} 筆`);
                
                if (testOrders.length > 0) {
                    console.log('\n⚠️ 建議清除的測試訂單:');
                    testOrders.forEach(order => {
                        console.log(`- ID ${order.id}: ${order.contact_name || order.customer_name}`);
                    });
                }
                
                return { total: orders.length, testOrders: testOrders, realOrders: orders.length - testOrders.length };
            } else {
                console.log('✅ 後台沒有訂單（正確狀態）');
                return { total: 0, testOrders: [], realOrders: 0 };
            }
        } else if (response.status === 401) {
            console.log('🔐 需要管理員認證，無法檢查訂單');
            return 'needs_auth';
        }
        
    } catch (error) {
        console.error('❌ 檢查訂單失敗:', error.message);
        return 'error';
    }
}

/**
 * 生成清理SQL腳本
 */
function generateCleanupSQL(orderAnalysis) {
    if (orderAnalysis === 'needs_auth' || orderAnalysis === 'error') {
        console.log('\n💡 無法自動生成清理腳本，需要手動處理');
        return;
    }
    
    if (orderAnalysis.total === 0) {
        console.log('\n✅ 沒有需要清理的訂單');
        return;
    }
    
    console.log('\n🔧 生成清理SQL腳本...');
    
    const sqlScript = `
-- 清除測試訂單數據腳本
-- 執行前請確認這些是測試數據而非真實客戶訂單

-- 查看現有訂單
SELECT id, contact_name, contact_phone, status, created_at, total_amount 
FROM orders 
ORDER BY created_at DESC;

-- 清除疑似測試訂單（請謹慎執行）
-- 方法1: 根據客戶姓名清除
DELETE FROM order_items WHERE order_id IN (
    SELECT id FROM orders 
    WHERE contact_name LIKE '%測試客戶%' 
    OR contact_name LIKE '%王小明%'
    OR contact_name LIKE '%李小華%'
    OR contact_name LIKE '%張小美%'
    OR contact_name LIKE '%陳大明%'
);

DELETE FROM orders 
WHERE contact_name LIKE '%測試客戶%' 
OR contact_name LIKE '%王小明%'
OR contact_name LIKE '%李小華%'
OR contact_name LIKE '%張小美%'
OR contact_name LIKE '%陳大明%';

-- 方法2: 根據電話號碼清除
DELETE FROM order_items WHERE order_id IN (
    SELECT id FROM orders 
    WHERE contact_phone LIKE '%0912345%'
);

DELETE FROM orders 
WHERE contact_phone LIKE '%0912345%';

-- 方法3: 清除所有訂單（如果確定都是測試數據）
-- 警告：這會清除所有訂單！
-- DELETE FROM order_items;
-- DELETE FROM orders;

-- 驗證清理結果
SELECT COUNT(*) as remaining_orders FROM orders;
SELECT COUNT(*) as remaining_order_items FROM order_items;
`;
    
    // 寫入SQL檔案
    const fs = require('fs');
    const filePath = 'cleanup_test_orders.sql';
    
    try {
        fs.writeFileSync(filePath, sqlScript);
        console.log(`✅ SQL腳本已生成: ${filePath}`);
    } catch (error) {
        console.log('⚠️ 無法寫入SQL檔案，以下是腳本內容:');
        console.log(sqlScript);
    }
}

/**
 * 提供手動清理建議
 */
function provideManualCleanupSteps() {
    console.log('\n📋 手動清理步驟:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('1. 登入Railway資料庫控制台');
    console.log('2. 執行查詢確認訂單內容:');
    console.log('   SELECT * FROM orders ORDER BY created_at DESC;');
    console.log('3. 確認哪些是測試訂單後執行清理');
    console.log('4. 或使用生成的cleanup_test_orders.sql腳本');
    console.log('');
    console.log('⚠️ 清理前請務必備份重要數據！');
}

// 主執行函數
async function main() {
    const orderAnalysis = await checkCurrentOrders();
    generateCleanupSQL(orderAnalysis);
    provideManualCleanupSteps();
}

main();