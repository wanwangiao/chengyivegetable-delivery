/**
 * 一鍵修復 - 添加 payment_method 欄位
 * 
 * 使用方法：
 * 1. 打開命令提示字元 (cmd)
 * 2. 輸入：cd "C:\Users\黃士嘉\誠憶鮮蔬線上系統"
 * 3. 輸入：set DB_PASSWORD=您的資料庫密碼
 * 4. 輸入：node 一鍵修復.js
 */

const { Pool } = require('pg');
const readline = require('readline');

// 建立輸入介面
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('🔧 誠憶鮮蔬資料庫一鍵修復工具');
console.log('=======================================');
console.log('');
console.log('這個工具會為您的 orders 表添加 payment_method 欄位');
console.log('修復結帳時出現的「資料驗證失敗」錯誤');
console.log('');

// 詢問密碼
function askPassword() {
  return new Promise((resolve) => {
    // 檢查環境變數
    if (process.env.DB_PASSWORD) {
      console.log('✅ 從環境變數讀取到資料庫密碼');
      resolve(process.env.DB_PASSWORD);
      return;
    }
    
    console.log('🔑 請輸入您的資料庫密碼：');
    console.log('（DigitalOcean PostgreSQL 的 doadmin 用戶密碼）');
    
    // 隱藏輸入的密碼
    process.stdin.setRawMode(true);
    let password = '';
    
    process.stdin.on('data', (char) => {
      const c = char.toString();
      
      if (c === '\r' || c === '\n') {
        // 按下 Enter
        process.stdin.setRawMode(false);
        console.log('\n');
        resolve(password);
      } else if (c === '\u0003') {
        // 按下 Ctrl+C
        console.log('\n操作已取消');
        process.exit(0);
      } else if (c === '\u0008' || c === '\u007f') {
        // 按下 Backspace
        if (password.length > 0) {
          password = password.slice(0, -1);
          process.stdout.write('\b \b');
        }
      } else if (c >= ' ' && c <= '~') {
        // 一般字符
        password += c;
        process.stdout.write('*');
      }
    });
  });
}

// 執行遷移
async function executeMigration(password) {
  const pool = new Pool({
    host: 'db-postgresql-sgp1-67006-do-user-16407903-0.c.db.ondigitalocean.com',
    port: 25060,
    database: 'defaultdb',
    user: 'doadmin',
    password: password,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000
  });

  try {
    console.log('🔗 連接資料庫中...');
    const client = await pool.connect();
    console.log('✅ 資料庫連接成功！');

    try {
      // 步驟1: 檢查現有狀況
      console.log('\n📊 檢查現有資料庫狀況...');
      
      const checkColumn = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'orders' AND column_name = 'payment_method'
      `);
      
      const orderCount = await client.query('SELECT COUNT(*) as count FROM orders');
      console.log(`   📋 總訂單數量: ${orderCount.rows[0].count}`);
      
      if (checkColumn.rows.length > 0) {
        console.log('   ⚠️  payment_method 欄位已存在');
        
        // 檢查是否有 NULL 值
        const nullCount = await client.query('SELECT COUNT(*) as count FROM orders WHERE payment_method IS NULL');
        if (parseInt(nullCount.rows[0].count) > 0) {
          console.log(`   🔄 發現 ${nullCount.rows[0].count} 筆記錄沒有付款方式，正在修復...`);
          await client.query("UPDATE orders SET payment_method = 'cash' WHERE payment_method IS NULL");
          console.log('   ✅ 已將空值更新為現金付款');
        } else {
          console.log('   ✅ 所有訂單都已有付款方式');
        }
      } else {
        // 步驟2: 添加欄位
        console.log('   ➕ payment_method 欄位不存在，正在添加...');
        
        await client.query(`
          ALTER TABLE orders ADD COLUMN payment_method TEXT DEFAULT 'cash'
        `);
        console.log('   ✅ payment_method 欄位已添加');
        
        // 更新現有記錄
        const updateResult = await client.query(`
          UPDATE orders SET payment_method = 'cash' WHERE payment_method IS NULL
        `);
        console.log(`   ✅ 已更新 ${updateResult.rowCount} 筆現有記錄`);
      }

      // 步驟3: 建立索引
      console.log('\n🔍 建立索引以提升效能...');
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_orders_payment_method ON orders(payment_method)
      `);
      console.log('   ✅ 索引建立完成');

      // 步驟4: 驗證結果
      console.log('\n🔍 驗證修復結果...');
      
      const finalCheck = await client.query(`
        SELECT 
          column_name, 
          data_type, 
          column_default 
        FROM information_schema.columns 
        WHERE table_name = 'orders' AND column_name = 'payment_method'
      `);
      
      if (finalCheck.rows.length > 0) {
        const col = finalCheck.rows[0];
        console.log('   ✅ 欄位驗證成功:');
        console.log(`      名稱: ${col.column_name}`);
        console.log(`      類型: ${col.data_type}`);
        console.log(`      預設值: ${col.column_default}`);
      }
      
      const paymentStats = await client.query(`
        SELECT 
          COALESCE(payment_method, 'NULL') as payment_method,
          COUNT(*) as count
        FROM orders 
        GROUP BY payment_method
        ORDER BY count DESC
      `);
      
      console.log('\n   💳 付款方式分布:');
      paymentStats.rows.forEach(row => {
        console.log(`      ${row.payment_method}: ${row.count} 筆訂單`);
      });

    } finally {
      client.release();
    }

    console.log('\n🎉 修復完成！');
    console.log('=======================================');
    console.log('✅ payment_method 欄位已成功添加');
    console.log('✅ 所有現有訂單都設定為現金付款');
    console.log('✅ 索引已建立，查詢效能已優化');
    console.log('✅ 結帳功能現在應該正常工作了！');
    console.log('');
    console.log('您現在可以測試前台結帳功能。');

  } catch (error) {
    console.error('\n❌ 修復失敗:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.log('\n💡 連接失敗，可能原因:');
      console.log('   - 網路連線問題');
      console.log('   - 資料庫服務未啟動');
      console.log('   - 防火牆阻擋連線');
    } else if (error.code === '28P01') {
      console.log('\n💡 認證失敗，可能原因:');
      console.log('   - 密碼錯誤');
      console.log('   - 使用者名稱錯誤');
      console.log('   - 資料庫權限問題');
    } else {
      console.log('\n💡 建議:');
      console.log('   - 檢查密碼是否正確');
      console.log('   - 確認網路連線正常');
      console.log('   - 聯繫資料庫管理員');
    }
  } finally {
    await pool.end();
  }
}

// 主程序
async function main() {
  try {
    const password = await askPassword();
    rl.close();
    
    console.log('🚀 開始執行修復...');
    console.log('');
    
    await executeMigration(password);
    
  } catch (error) {
    console.error('❌ 程式執行失敗:', error.message);
  }
}

// 執行主程序
main().then(() => {
  console.log('\n按任意鍵退出...');
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.on('data', () => {
    process.exit(0);
  });
}).catch(error => {
  console.error('程式異常:', error);
  process.exit(1);
});