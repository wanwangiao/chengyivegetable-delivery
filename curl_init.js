// 使用node-fetch來執行Railway資料庫初始化
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const baseURL = 'https://chengyivegetable-production-7b4a.up.railway.app';

async function initDatabase() {
    try {
        console.log('🔧 開始Railway資料庫初始化...');
        console.log('🌐 目標: ' + baseURL);
        
        // 直接執行首次系統初始化（無需管理員登入）
        console.log('\n📋 執行首次系統初始化...');
        const initResponse = await fetch(`${baseURL}/api/system/first-time-init`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            }
        });
        
        const initData = await initResponse.json();
        
        if (initData.success) {
            console.log('\n🎉 資料庫初始化完成！');
            console.log('📅 執行時間:', initData.timestamp);
            console.log('🗃️ 建立資料表:', initData.tables.length, '個');
            
            // 顯示執行結果
            console.log('\n📋 執行結果:');
            initData.results.forEach(result => {
                const status = result.status === 'success' ? '✅' : 
                             result.status === 'already_exists' ? '⚠️' : '❌';
                console.log(`  ${status} ${result.description || result.task}${result.file ? ` (${result.file})` : ''}`);
                if (result.error) {
                    console.log(`      錯誤: ${result.error}`);
                }
            });
            
            // 顯示資料表列表
            console.log('\n📊 建立的資料表:');
            initData.tables.forEach(table => {
                console.log(`  • ${table.table_name} (${table.column_count} 欄位)`);
            });
            
            // 顯示統計資料
            if (initData.statistics && initData.statistics.length > 0) {
                console.log('\n📈 資料統計:');
                initData.statistics.forEach(stat => {
                    console.log(`  • ${stat.table}: ${stat.count} 筆資料`);
                });
            }
            
            return true;
        } else {
            console.error('❌ 資料庫初始化失敗:', initData.error);
            return false;
        }
        
    } catch (error) {
        console.error('❌ 初始化過程發生錯誤:', error.message);
        return false;
    }
}

// 執行初始化
initDatabase().then(success => {
    if (success) {
        console.log('\n🚀 系統現在可以正常使用了！');
        console.log('🌐 前台: https://chengyivegetable-production-7b4a.up.railway.app/');
        console.log('⚙️ 管理: https://chengyivegetable-production-7b4a.up.railway.app/admin');
        console.log('🚚 外送: https://chengyivegetable-production-7b4a.up.railway.app/driver');
        process.exit(0);
    } else {
        console.log('\n❌ 初始化失敗，請檢查錯誤訊息');
        process.exit(1);
    }
}).catch(error => {
    console.error('❌ 執行失敗:', error);
    process.exit(1);
});