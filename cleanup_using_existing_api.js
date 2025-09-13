/**
 * 使用現有API端點來清理資料庫
 * 不需要等待新API部署
 */

const axios = require('axios');

const BASE_URL = 'https://chengyivegetable-production-7b4a.up.railway.app';

console.log('🧹 使用現有API清理資料庫');
console.log('📅 執行時間:', new Date().toLocaleString('zh-TW'));

async function cleanupUsingExistingAPI() {
    
    console.log('\n1️⃣ 先獲取所有商品ID...');
    
    try {
        const productsResponse = await axios.get(`${BASE_URL}/api/products`, {
            timeout: 10000,
            validateStatus: (status) => status < 500
        });
        
        if (productsResponse.status === 200 && Array.isArray(productsResponse.data)) {
            const products = productsResponse.data;
            console.log(`📦 找到 ${products.length} 個商品`);
            
            if (products.length === 0) {
                console.log('✅ 商品表已經是空的');
                return;
            }
            
            console.log('\n2️⃣ 開始刪除所有商品...');
            console.log('⚠️ 注意：這需要管理員登入狀態');
            console.log('');
            console.log('請複製以下JavaScript代碼到瀏覽器開發者工具Console中執行：');
            console.log('（請先登入管理後台）');
            console.log('');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            
            let deleteScript = `
// 批量刪除所有商品的腳本
console.log('🧹 開始批量刪除所有商品...');

const productIds = [${products.map(p => p.id).join(', ')}];
let deletedCount = 0;

async function deleteAllProducts() {
    for (const productId of productIds) {
        try {
            const response = await fetch('/api/admin/products/' + productId, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' }
            });
            
            if (response.ok) {
                deletedCount++;
                console.log('✅ 已刪除商品 ID: ' + productId);
            } else {
                console.log('❌ 刪除失敗 ID: ' + productId + ', 狀態: ' + response.status);
            }
        } catch (error) {
            console.log('❌ 刪除錯誤 ID: ' + productId + ', 錯誤: ' + error.message);
        }
        
        // 避免過快請求
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log('🎉 批量刪除完成！已刪除 ' + deletedCount + ' 個商品');
    console.log('💡 現在請重新整理後台頁面確認結果');
}

deleteAllProducts();
`;

            console.log(deleteScript);
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            
            console.log('\n📋 執行步驟:');
            console.log('1. 在瀏覽器中登入管理後台');
            console.log('2. 按F12開啟開發者工具');
            console.log('3. 切換到Console標籤');
            console.log('4. 如果出現警告，請輸入 "allow pasting" 並按Enter');
            console.log('5. 貼上上述JavaScript代碼並按Enter執行');
            console.log('6. 等待所有商品刪除完成');
            console.log('7. 重新整理後台頁面確認結果');
            
        } else if (productsResponse.status === 404) {
            console.log('ℹ️ 商品API不存在，可能商品表已經是空的');
        } else {
            console.log('❌ 無法獲取商品列表，狀態:', productsResponse.status);
        }
        
    } catch (error) {
        console.log('❌ 獲取商品列表失敗:', error.message);
        console.log('\n💡 替代方案：');
        console.log('由於無法自動獲取商品列表，您可以：');
        console.log('1. 登入管理後台的商品管理頁面');
        console.log('2. 手動刪除所有商品');
        console.log('3. 或者等待新的資料庫重置API部署完成');
    }
    
    console.log('\n🎯 清理完成後的預期狀態：');
    console.log('✅ 後台訂單管理：顯示「目前沒有訂單」');
    console.log('✅ 庫存管理：顯示「目前沒有商品」');
    console.log('✅ 外送員系統：顯示「目前沒有可接訂單」');
    console.log('✅ 系統準備好接收真實數據');
}

cleanupUsingExistingAPI();