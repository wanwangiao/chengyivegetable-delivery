require('dotenv').config();
const { Pool } = require('pg');

async function testMultipleConnections() {
    console.log('=== 多種連線字串測試 ===');
    console.log('時間:', new Date().toLocaleString('zh-TW'));
    
    // 測試不同的連線字串格式
    const connectionStrings = [
        {
            name: '用戶提供的密碼 (URL編碼)',
            url: 'postgresql://postgres.cywcuzgbuqmxjxwyrrsp:%40shnf830629%40@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres'
        },
        {
            name: '用戶提供的密碼 (原始格式)',
            url: 'postgresql://postgres.cywcuzgbuqmxjxwyrrsp:@shnf830629@@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres'
        },
        {
            name: '用戶提供的密碼 (雙重編碼)',
            url: 'postgresql://postgres.cywcuzgbuqmxjxwyrrsp:%2540shnf830629%2540@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres'
        },
        {
            name: '原始舊密碼',
            url: 'postgresql://postgres.cywcuzgbuqmxjxwyrrsp:Chengyivegetable2025!@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres'
        },
        {
            name: '使用標準端口5432',
            url: 'postgresql://postgres.cywcuzgbuqmxjxwyrrsp:%40shnf830629%40@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres'
        },
        {
            name: '直接連接(非pooler)',
            url: 'postgresql://postgres:%40shnf830629%40@db.cywcuzgbuqmxjxwyrrsp.supabase.co:5432/postgres'
        }
    ];

    for (let i = 0; i < connectionStrings.length; i++) {
        const config = connectionStrings[i];
        console.log(`\n--- 測試 ${i + 1}: ${config.name} ---`);
        console.log('連線字串:', config.url);
        
        const pool = new Pool({
            connectionString: config.url,
            ssl: {
                rejectUnauthorized: false
            }
        });

        try {
            const client = await pool.connect();
            console.log('✅ 連線成功！');
            
            // 快速測試查詢
            const result = await client.query('SELECT current_database(), current_user');
            console.log('資料庫:', result.rows[0].current_database);
            console.log('用戶:', result.rows[0].current_user);
            
            client.release();
            await pool.end();
            
            console.log('🎉 找到有效的連線字串！');
            console.log('請使用此連線字串更新.env檔案');
            return config.url;
            
        } catch (error) {
            console.log('❌ 連線失敗:', error.message);
            await pool.end();
            continue;
        }
    }
    
    console.log('\n⚠️ 所有連線嘗試都失敗了');
    console.log('請檢查:');
    console.log('1. Supabase專案是否正常運作');
    console.log('2. 密碼是否正確');
    console.log('3. 網路連線是否正常');
    console.log('4. 防火牆設定是否允許連線');
}

// 執行測試
testMultipleConnections();