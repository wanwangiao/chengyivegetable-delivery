/**
 * 檢查資料庫實際內容
 */

const axios = require('axios');

const BASE_URL = 'https://chengyivegetable-production-7b4a.up.railway.app';

console.log('🔍 檢查資料庫實際內容...');
console.log('📅 執行時間:', new Date().toLocaleString('zh-TW'));

async function checkDatabaseContent() {
    
    // 1. 檢查外送員API的訂單統計
    console.log('\n1️⃣ 檢查外送員訂單統計...');
    try {
        const response = await axios.get(`${BASE_URL}/api/driver/order-counts`, {
            timeout: 10000
        });
        console.log('✅ 外送員訂單統計:', response.data);
        
        if (response.data && response.data.counts) {
            const totalOrders = Object.values(response.data.counts).reduce((sum, count) => sum + count, 0);
            console.log('📊 總訂單數:', totalOrders);
            
            if (totalOrders === 0) {
                console.log('✅ 訂單表確實是空的');
            } else {
                console.log('❌ 訂單表還有數據！');
            }
        }
        
    } catch (error) {
        console.log('❌ 外送員API錯誤:', error.message);
    }
    
    // 2. 檢查商品API（如果存在）
    console.log('\n2️⃣ 檢查商品數據...');
    try {
        const menuResponse = await axios.get(`${BASE_URL}/api/products`, {
            timeout: 10000,
            validateStatus: (status) => status < 500
        });
        
        if (menuResponse.status === 200) {
            console.log('✅ 商品API可訪問');
            if (Array.isArray(menuResponse.data)) {
                console.log('📦 商品數量:', menuResponse.data.length);
            } else if (menuResponse.data && menuResponse.data.products) {
                console.log('📦 商品數量:', menuResponse.data.products.length);
            } else {
                console.log('📦 商品數據格式:', typeof menuResponse.data);
            }
        }
        
    } catch (error) {
        console.log('❌ 商品API錯誤:', error.message);
    }
    
    // 3. 嘗試其他公開API
    console.log('\n3️⃣ 檢查其他數據源...');
    const publicEndpoints = [
        '/api/menu',
        '/api/categories',
        '/api/driver/areas'
    ];
    
    for (const endpoint of publicEndpoints) {
        try {
            const response = await axios.get(`${BASE_URL}${endpoint}`, {
                timeout: 5000,
                validateStatus: (status) => status < 500
            });
            
            console.log(`${endpoint}: 狀態 ${response.status}`);
            if (response.status === 200) {
                if (Array.isArray(response.data)) {
                    console.log(`   數據量: ${response.data.length} 筆`);
                } else if (response.data && typeof response.data === 'object') {
                    const keys = Object.keys(response.data);
                    console.log(`   包含屬性: ${keys.join(', ')}`);
                    if (response.data.categories) {
                        console.log(`   分類數: ${Object.keys(response.data.categories).length}`);
                    }
                }
            }
        } catch (error) {
            console.log(`${endpoint}: 不存在或錯誤`);
        }
    }
    
    console.log('\n🎯 結論:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('如果外送員API顯示0筆訂單，但後台還有數據，');
    console.log('那麼問題可能是:');
    console.log('1. 資料庫中確實有舊的測試數據需要清理');
    console.log('2. 不同的API讀取不同的資料表');
    console.log('3. 需要手動清理資料庫');
}

checkDatabaseContent();