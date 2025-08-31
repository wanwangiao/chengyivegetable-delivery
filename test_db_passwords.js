const { Pool } = require('pg');

async function testPasswords() {
    const passwords = [
        'chengyivegetable',
        '@chengyivegetable',
        'chengyivegetable@',
        '@chengyivegetable@',
        '@Chengyivegetable',
        '@Chengyivegetable@',
        'Chengyivegetable2025!',
        '@Chengyivegetable2025',
        'Chengyivegetable'
    ];
    
    for (const pwd of passwords) {
        // URL encode @ symbols
        const encoded = pwd.replace(/@/g, '%40').replace(/!/g, '%21');
        const url = `postgresql://postgres.cywcuzgbuqmxjxwyrrsp:${encoded}@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres`;
        
        console.log(`\nTesting password: "${pwd}"`);
        console.log(`Encoded: "${encoded}"`);
        
        const pool = new Pool({ 
            connectionString: url,
            connectionTimeoutMillis: 5000,
            query_timeout: 5000
        });
        
        try {
            const res = await pool.query('SELECT NOW()');
            console.log('✅ SUCCESS! Connected with password:', pwd);
            console.log('Database time:', res.rows[0].now);
            await pool.end();
            
            // Save working password
            console.log('\n🎉 WORKING CONNECTION STRING:');
            console.log(url);
            return;
        } catch (err) {
            console.log('❌ Failed:', err.message);
            await pool.end();
        }
    }
    
    console.log('\n😞 None of the passwords worked');
}

testPasswords().catch(console.error);