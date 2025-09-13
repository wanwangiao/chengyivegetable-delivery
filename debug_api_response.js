/**
 * 詳細檢查API回應格式
 */

const axios = require('axios');

const BASE_URL = 'https://chengyivegetable-production-7b4a.up.railway.app';

async function debugAPIResponse() {
    console.log('🔍 詳細檢查API回應...');
    
    try {
        const response = await axios.get(`${BASE_URL}/api/admin/orders`, {
            timeout: 10000,
            validateStatus: (status) => status < 500
        });
        
        console.log('📊 回應狀態:', response.status);
        console.log('📋 回應標頭:', response.headers['content-type']);
        console.log('📝 回應內容類型:', typeof response.data);
        console.log('📦 完整回應內容:');
        console.log(JSON.stringify(response.data, null, 2));
        
        // 檢查是否有orders屬性
        if (response.data && typeof response.data === 'object') {
            console.log('\n🔍 response.data的屬性:');
            console.log('keys:', Object.keys(response.data));
            
            if (response.data.orders) {
                console.log('✅ 找到orders屬性，長度:', response.data.orders.length);
            } else if (Array.isArray(response.data)) {
                console.log('✅ response.data本身是陣列，長度:', response.data.length);
            } else {
                console.log('❓ 沒有找到orders屬性，也不是陣列');
            }
        }
        
    } catch (error) {
        console.log('❌ 錯誤:', error.message);
        if (error.response) {
            console.log('📊 錯誤狀態:', error.response.status);
            console.log('📝 錯誤內容:', error.response.data);
        }
    }
}

debugAPIResponse();