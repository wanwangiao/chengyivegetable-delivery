// 修復和填充資料庫
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const baseURL = 'https://chengyivegetable-production-7b4a.up.railway.app';

async function fixAndPopulate() {
    try {
        console.log('🔧 修復和填充資料庫...');
        
        // 使用內建的測試API來新增商品
        const response = await fetch(`${baseURL}/api/test/create-orders`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'init_products' // 自定義動作
            })
        });
        
        if (response.ok) {
            const result = await response.json();
            console.log('✅ 商品初始化成功:', result);
        } else {
            console.log('⚠️ 使用備用方案...');
            
            // 備用：直接調用首次初始化API的商品部分
            const initResponse = await fetch(`${baseURL}/api/system/first-time-init`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                }
            });
            
            const initResult = await initResponse.json();
            if (initResult.alreadyInitialized) {
                console.log('✅ 系統已經初始化完成');
            } else {
                console.log('初始化結果:', initResult);
            }
        }
        
    } catch (error) {
        console.error('❌ 修復失敗:', error.message);
    }
}

fixAndPopulate();