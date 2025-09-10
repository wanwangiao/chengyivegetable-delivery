/**
 * 自動遷移腳本 - 在伺服器啟動時執行
 * 這個腳本會在 server.js 中被調用，自動執行必要的資料庫遷移
 */

async function executeStartupMigrations(pool) {
  console.log('🔧 檢查並執行啟動遷移...');
  
  try {
    // 檢查 payment_method 欄位是否存在
    const checkResult = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'orders' AND column_name = 'payment_method'
    `);
    
    if (checkResult.rows.length === 0) {
      console.log('📋 payment_method 欄位不存在，開始執行遷移...');
      
      // 執行遷移
      const migrationSQL = `
        -- 為orders表添加payment_method欄位
        DO $$ 
        BEGIN 
            ALTER TABLE orders ADD COLUMN payment_method TEXT DEFAULT 'cash';
            UPDATE orders SET payment_method = 'cash' WHERE payment_method IS NULL;
            RAISE NOTICE 'payment_method 欄位已成功添加到 orders 表';
        END $$;

        -- 建立索引以提升查詢效能
        CREATE INDEX IF NOT EXISTS idx_orders_payment_method ON orders(payment_method);
      `;
      
      await pool.query(migrationSQL);
      console.log('✅ payment_method 欄位遷移完成');
      
      // 驗證結果
      const verifyResult = await pool.query(`
        SELECT column_name, data_type, column_default 
        FROM information_schema.columns 
        WHERE table_name = 'orders' AND column_name = 'payment_method'
      `);
      
      if (verifyResult.rows.length > 0) {
        console.log('✅ 遷移驗證成功:', verifyResult.rows[0]);
        
        // 檢查現有訂單數據
        const orderStats = await pool.query(`
          SELECT 
            COUNT(*) as total_orders,
            COUNT(CASE WHEN payment_method IS NOT NULL THEN 1 END) as with_payment_method
          FROM orders
        `);
        
        console.log('📊 訂單統計:', orderStats.rows[0]);
        
        return {
          success: true,
          message: 'payment_method 欄位遷移成功',
          columnInfo: verifyResult.rows[0],
          orderStats: orderStats.rows[0]
        };
      } else {
        throw new Error('遷移後無法找到 payment_method 欄位');
      }
    } else {
      console.log('✅ payment_method 欄位已存在，跳過遷移');
      
      // 檢查現有數據統計
      const orderStats = await pool.query(`
        SELECT 
          COUNT(*) as total_orders,
          COUNT(CASE WHEN payment_method IS NOT NULL THEN 1 END) as with_payment_method,
          payment_method,
          COUNT(*) as count
        FROM orders
        GROUP BY payment_method
      `);
      
      console.log('📊 現有付款方式分布:');
      orderStats.rows.forEach(row => {
        console.log(`   ${row.payment_method || 'NULL'}: ${row.count} 筆`);
      });
      
      return {
        success: true,
        message: 'payment_method 欄位已存在',
        alreadyExists: true
      };
    }
    
  } catch (error) {
    console.error('❌ 啟動遷移失敗:', error);
    throw error;
  }
}

// 執行其他必要的遷移檢查
async function executeAllStartupMigrations(pool) {
  const results = [];
  
  try {
    console.log('🚀 開始執行所有啟動遷移...');
    
    // 執行 payment_method 欄位遷移
    const paymentMethodResult = await executeStartupMigrations(pool);
    results.push(paymentMethodResult);
    
    // 可以在這裡添加其他遷移...
    
    console.log('🎉 所有啟動遷移執行完成');
    return {
      success: true,
      results: results,
      totalMigrations: results.length
    };
    
  } catch (error) {
    console.error('❌ 啟動遷移執行失敗:', error);
    return {
      success: false,
      error: error.message,
      results: results
    };
  }
}

module.exports = {
  executeStartupMigrations,
  executeAllStartupMigrations
};