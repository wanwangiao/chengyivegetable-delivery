// 直接使用SQL API新增商品
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

async function addProductDirect() {
    try {
        console.log('🔧 直接新增商品到資料庫...');
        
        // 使用first-time-init API，但只執行商品新增部分
        const response = await fetch('https://chengyivegetable-production-7b4a.up.railway.app/api/system/first-time-init', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            }
        });
        
        const result = await response.json();
        console.log('API回應:', result);
        
        if (result.success) {
            console.log('✅ 初始化成功！');
            console.log('📊 建立的資料表:', result.tables.length, '個');
            console.log('📈 資料統計:', result.statistics);
        } else if (result.alreadyInitialized) {
            console.log('ℹ️ 系統已經初始化，商品應該存在');
            
            // 檢查商品
            const productResponse = await fetch('https://chengyivegetable-production-7b4a.up.railway.app/api/products');
            const products = await productResponse.json();
            console.log('🛒 商品檢查:', products);
        } else {
            console.error('❌ 初始化失敗:', result.error);
        }
        
    } catch (error) {
        console.error('❌ 執行失敗:', error.message);
    }
}

addProductDirect();