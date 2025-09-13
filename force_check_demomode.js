/**
 * 強制檢查線上系統demoMode狀態
 */

const axios = require('axios');

const BASE_URL = 'https://chengyivegetable-production-7b4a.up.railway.app';

console.log('🔍 強制檢查線上系統狀態...');
console.log('📅 執行時間:', new Date().toLocaleString('zh-TW'));
console.log('🌐 目標URL:', BASE_URL);

async function checkSystemStatus() {
    
    // 1. 檢查首頁是否正常
    console.log('\n1️⃣ 檢查系統首頁...');
    try {
        const homeResponse = await axios.get(BASE_URL, {
            timeout: 10000
        });
        console.log('✅ 首頁正常 (狀態:', homeResponse.status, ')');
    } catch (error) {
        console.log('❌ 首頁錯誤:', error.message);
    }
    
    // 2. 檢查版本資訊（可能包含部署時間）
    console.log('\n2️⃣ 檢查系統版本...');
    try {
        const versionResponse = await axios.get(`${BASE_URL}/api/version`, {
            timeout: 10000
        });
        console.log('✅ 版本資訊:', versionResponse.data);
    } catch (error) {
        console.log('❌ 版本API不存在或錯誤');
    }
    
    // 3. 檢查不需要認證的API
    console.log('\n3️⃣ 檢查公開API...');
    try {
        const menuResponse = await axios.get(`${BASE_URL}/api/menu`, {
            timeout: 10000
        });
        console.log('✅ 選單API正常，商品數量:', menuResponse.data.categories ? Object.keys(menuResponse.data.categories).length : '未知');
    } catch (error) {
        console.log('❌ 選單API錯誤:', error.message);
    }
    
    // 4. 檢查外送員相關API（不需要管理員認證）
    console.log('\n4️⃣ 檢查外送員API...');
    try {
        const driverResponse = await axios.get(`${BASE_URL}/api/driver/order-counts`, {
            timeout: 10000
        });
        console.log('✅ 外送員API正常');
        console.log('📊 訂單統計:', driverResponse.data);
    } catch (error) {
        console.log('❌ 外送員API錯誤:', error.message);
    }
    
    // 5. 嘗試檢查其他管理員API端點
    console.log('\n5️⃣ 檢查其他管理員API端點...');
    const adminEndpoints = [
        '/api/admin/orders-list',
        '/api/admin/orders-geo'
    ];
    
    for (const endpoint of adminEndpoints) {
        try {
            const response = await axios.get(`${BASE_URL}${endpoint}`, {
                timeout: 5000,
                validateStatus: (status) => status < 500
            });
            console.log(`${endpoint}: 狀態 ${response.status}`);
            if (response.status === 200) {
                console.log(`   回應類型: ${typeof response.data}`);
                if (response.data && response.data.orders) {
                    console.log(`   訂單數: ${response.data.orders.length}`);
                }
            }
        } catch (error) {
            console.log(`${endpoint}: 錯誤 (${error.message})`);
        }
    }
}

checkSystemStatus();