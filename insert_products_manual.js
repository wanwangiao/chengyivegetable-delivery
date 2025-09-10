// 手動新增商品資料的API
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

async function insertProducts() {
    try {
        console.log('🛒 手動新增商品資料...');
        
        // 建立一個特殊的API endpoint來直接新增商品
        const response = await fetch('https://chengyivegetable-production-7b4a.up.railway.app/api/system/first-time-init', {
            method: 'POST', 
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                force_product_insert: true
            })
        });
        
        const result = await response.json();
        
        if (result.alreadyInitialized) {
            console.log('✅ 系統顯示已初始化');
            console.log('現在需要手動新增商品資料...');
            
            // 檢查商品數量
            const productsResponse = await fetch('https://chengyivegetable-production-7b4a.up.railway.app/api/products');
            const products = await productsResponse.json();
            
            if (products.mode === 'demo') {
                console.log('⚠️ 仍在demo模式，商品表可能是空的');
                console.log('商品數量:', products.length);
            } else {
                console.log('✅ 已切換到真實資料庫模式');
                console.log('商品數量:', products.length);
            }
        } else {
            console.log('初始化結果:', result);
        }
        
    } catch (error) {
        console.error('❌ 執行失敗:', error.message);
    }
}

insertProducts();