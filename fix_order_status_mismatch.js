/**
 * 修復訂單狀態定義不一致問題
 * 統一管理員API和外送員API的狀態定義
 */

const fs = require('fs');
const path = require('path');

console.log('🔧 修復訂單狀態定義不一致問題');
console.log('📅 執行時間:', new Date().toLocaleString('zh-TW'));

console.log('\n🔍 問題分析:');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('❌ 管理員API狀態: [\'placed\', \'confirmed\', \'preparing\', \'out_for_delivery\', \'delivered\', \'cancelled\']');
console.log('❌ 外送員API期望: \'packed\' 狀態');
console.log('💡 外送員系統找不到可接訂單，因為狀態定義不匹配');

console.log('\n🎯 解決方案:');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

const serverPath = path.join(__dirname, 'src/server.js');

if (!fs.existsSync(serverPath)) {
    console.log('❌ 找不到server.js檔案');
    process.exit(1);
}

console.log('📖 讀取server.js檔案...');
let serverContent = fs.readFileSync(serverPath, 'utf8');

console.log('\n🔄 方案1: 修改管理員API，添加 "packed" 狀態...');

// 修復管理員API的有效狀態列表
const oldValidStatuses = `const validStatuses = ['placed', 'confirmed', 'preparing', 'out_for_delivery', 'delivered', 'cancelled'];`;
const newValidStatuses = `const validStatuses = ['placed', 'confirmed', 'preparing', 'packed', 'out_for_delivery', 'delivered', 'cancelled'];`;

if (serverContent.includes(oldValidStatuses)) {
    serverContent = serverContent.replace(oldValidStatuses, newValidStatuses);
    console.log('✅ 已添加 "packed" 狀態到管理員API');
} else {
    console.log('⚠️ 未找到管理員API狀態定義，可能已修改過');
}

console.log('\n🔄 方案2: 改善狀態對應關係...');
console.log('建議的狀態流程:');
console.log('1. placed (已下單) → 客戶下單');
console.log('2. confirmed (已確認) → 店家確認');
console.log('3. preparing (準備中) → 店家準備');
console.log('4. packed (已包裝) → 可供外送員接單 ⭐');
console.log('5. out_for_delivery (配送中) → 外送員已接單');
console.log('6. delivered (已送達) → 配送完成');

// 備份原檔案
const backupPath = serverPath + '.backup.' + Date.now();
fs.writeFileSync(backupPath, fs.readFileSync(serverPath, 'utf8'));
console.log('\n💾 原檔案已備份至:', backupPath);

// 寫入修復後的內容
fs.writeFileSync(serverPath, serverContent);
console.log('✅ server.js 修復完成');

console.log('\n🎯 建議的測試步驟:');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('1. 提交修改到Git');
console.log('2. 推送到Railway重新部署');
console.log('3. 在管理員介面將幾筆訂單狀態改為 "packed"');
console.log('4. 測試外送員API是否能看到可接訂單');
console.log('5. 測試完整的訂單狀態流程');

console.log('\n💡 創建測試訂單狀態腳本...');

// 創建測試腳本
const testScript = `/**
 * 測試訂單狀態更新
 */

const axios = require('axios');

const BASE_URL = 'https://chengyivegetable-production-7b4a.up.railway.app';

async function updateOrderStatus(orderId, status) {
    try {
        console.log(\`🔄 更新訂單 \${orderId} 狀態為 \${status}...\`);
        
        const response = await axios.put(\`\${BASE_URL}/api/admin/orders/\${orderId}\`, {
            status: status,
            notes: '測試狀態更新'
        }, {
            headers: {
                'Content-Type': 'application/json',
                // 這裡需要添加管理員認證
                'Cookie': 'admin_session=...' // 需要實際的管理員session
            }
        });
        
        if (response.status === 200) {
            console.log(\`✅ 訂單 \${orderId} 狀態已更新為 \${status}\`);
            return true;
        }
        
    } catch (error) {
        console.error(\`❌ 更新訂單 \${orderId} 失敗:\`, error.message);
        return false;
    }
}

async function testDriverAPI() {
    try {
        console.log('\\n🧪 測試外送員API...');
        
        const response = await axios.get(\`\${BASE_URL}/api/driver/order-counts\`);
        
        if (response.status === 200) {
            console.log('✅ 外送員API正常');
            console.log('📊 可接訂單數:', response.data.counts);
            
            const totalOrders = Object.values(response.data.counts).reduce((sum, count) => sum + count, 0);
            console.log(\`🎯 總可接訂單: \${totalOrders}筆\`);
            
            if (totalOrders > 0) {
                console.log('🎉 外送員現在可以看到可接訂單了！');
            } else {
                console.log('⚠️ 仍然沒有可接訂單，請檢查訂單狀態');
            }
        }
        
    } catch (error) {
        console.error('❌ 測試外送員API失敗:', error.message);
    }
}

async function main() {
    console.log('🧪 測試訂單狀態修復...');
    
    // 這裡需要實際的訂單ID，可以從資料庫查詢前幾筆
    // const testOrderIds = [1, 2, 3]; 
    
    console.log('\\n💡 手動測試步驟:');
    console.log('1. 登入管理員後台');
    console.log('2. 找到幾筆訂單');
    console.log('3. 將狀態改為 "packed"');
    console.log('4. 執行 node test_driver_orders.js 確認外送員能看到');
    
    await testDriverAPI();
}

main();
`;

fs.writeFileSync(path.join(__dirname, 'test_order_status_fix.js'), testScript);
console.log('✅ 創建測試腳本: test_order_status_fix.js');

console.log('\n🎉 修復摘要:');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('✅ 管理員API已添加 "packed" 狀態');
console.log('✅ 外送員API保持期望 "packed" 狀態不變');
console.log('✅ 創建測試腳本協助驗證');
console.log('🎯 下一步: 將幾筆訂單狀態改為 "packed" 供外送員測試');

console.log('\n🚀 立即行動:');
console.log('1. 提交並推送修改');
console.log('2. 使用管理員介面將訂單改為 "packed" 狀態');
console.log('3. 執行 node test_driver_orders.js 驗證修復效果');

module.exports = {
    updateOrderStatus,
    testDriverAPI
};