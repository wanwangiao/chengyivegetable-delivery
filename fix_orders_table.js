// 修復orders表結構，添加missing的total_amount欄位
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

async function fixOrdersTable() {
    try {
        console.log('🔧 修復orders表結構...');
        
        // 使用首次初始化API執行SQL修復
        const response = await fetch('https://chengyivegetable-production-7b4a.up.railway.app/api/system/first-time-init', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'fix_orders_table'
            })
        });
        
        const result = await response.json();
        
        if (result.alreadyInitialized) {
            console.log('系統已初始化，需要手動執行SQL修復');
            console.log('建議執行以下SQL:');
            console.log('ALTER TABLE orders ADD COLUMN IF NOT EXISTS total_amount NUMERIC;');
            console.log('UPDATE orders SET total_amount = total WHERE total_amount IS NULL;');
        }
        
    } catch (error) {
        console.error('❌ 修復失敗:', error.message);
    }
}

fixOrdersTable();