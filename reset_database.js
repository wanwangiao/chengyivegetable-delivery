/**
 * 資料庫重置工具
 * 需要管理員密碼
 */

const axios = require('axios');

const BASE_URL = 'https://chengyivegetable-production-7b4a.up.railway.app';

console.log('🗑️ 資料庫重置工具');
console.log('📅 執行時間:', new Date().toLocaleString('zh-TW'));
console.log('🌐 目標系統:', BASE_URL);

async function resetDatabase() {
    
    console.log('\n⚠️ 重要警告:');
    console.log('這個操作將永久刪除資料庫中的數據！');
    console.log('請確認您真的要繼續操作。');
    
    console.log('\n📋 可用的重置選項:');
    console.log('1. complete - 完全重置（刪除所有數據，包括商品）');
    console.log('2. orders_only - 只清理訂單（保留商品數據）');
    
    // 由於這是一個安全操作，我們需要提供必要的參數
    const resetOptions = {
        complete: {
            resetType: 'complete',
            confirmPassword: 'CONFIRM_RESET_DATABASE'
        },
        orders_only: {
            resetType: 'orders_only', 
            confirmPassword: 'CONFIRM_RESET_DATABASE'
        }
    };
    
    console.log('\n🔧 執行完全重置...');
    try {
        const response = await axios.post(`${BASE_URL}/api/admin/reset-database`, resetOptions.complete, {
            timeout: 30000,
            validateStatus: (status) => status < 500,
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (response.status === 200) {
            console.log('✅ 重置成功！');
            console.log('📊 結果:', response.data);
            
            if (response.data.remainingData) {
                const { orders, products, users } = response.data.remainingData;
                console.log(`\n📈 剩餘數據統計:`);
                console.log(`   訂單: ${orders} 筆`);
                console.log(`   商品: ${products} 筆`);
                console.log(`   用戶: ${users} 筆`);
                
                if (orders === 0 && products === 0 && users === 0) {
                    console.log('\n🎉 資料庫已完全清空！');
                    console.log('✨ 系統現在是全新狀態，可以開始添加真實數據了');
                }
            }
            
        } else if (response.status === 401) {
            console.log('❌ 需要管理員認證');
            console.log('💡 請先登入管理後台，然後再執行此操作');
        } else {
            console.log('❌ 重置失敗，狀態碼:', response.status);
            console.log('📝 錯誤訊息:', response.data);
        }
        
    } catch (error) {
        console.log('❌ 請求失敗:', error.message);
        
        if (error.response) {
            console.log('📊 錯誤狀態:', error.response.status);
            console.log('📝 錯誤內容:', error.response.data);
            
            if (error.response.status === 401) {
                console.log('\n💡 解決方案:');
                console.log('1. 先在瀏覽器登入管理後台');
                console.log('2. 然後在瀏覽器的開發者工具Console中執行:');
                console.log(`
fetch('/api/admin/reset-database', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        resetType: 'complete',
        confirmPassword: 'CONFIRM_RESET_DATABASE'
    })
})
.then(res => res.json())
.then(data => console.log(data));
                `);
            }
        }
    }
}

resetDatabase();