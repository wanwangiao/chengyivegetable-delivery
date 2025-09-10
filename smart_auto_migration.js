/**
 * 智能自動遷移 - 不會阻止服務啟動
 * 這個版本即使遷移失敗，服務也會繼續運行
 */

async function smartAutoMigration(pool) {
  // 如果沒有資料庫連線，直接跳過
  if (!pool) {
    console.log('⚠️ 無資料庫連線，跳過自動遷移');
    return { skipped: true, reason: '無資料庫連線' };
  }

  try {
    console.log('🔧 開始智能自動遷移...');
    
    // 快速檢查資料庫是否可用
    const healthCheck = await Promise.race([
      pool.query('SELECT 1'),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('資料庫連線超時')), 3000)
      )
    ]);
    
    console.log('✅ 資料庫連線正常');

    // 檢查是否需要遷移
    const columnCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'orders' AND column_name = 'payment_method'
    `);

    if (columnCheck.rows.length > 0) {
      console.log('✅ payment_method 欄位已存在，無需遷移');
      
      // 檢查是否有 NULL 值需要修復
      const nullCheck = await pool.query(
        'SELECT COUNT(*) as count FROM orders WHERE payment_method IS NULL'
      );
      
      if (parseInt(nullCheck.rows[0].count) > 0) {
        console.log(`🔄 修復 ${nullCheck.rows[0].count} 筆 NULL 值...`);
        await pool.query("UPDATE orders SET payment_method = 'cash' WHERE payment_method IS NULL");
        console.log('✅ NULL 值修復完成');
      }
      
      return { success: true, action: 'fixed_nulls', message: '欄位存在，已修復空值' };
    }

    console.log('➕ payment_method 欄位不存在，開始添加...');

    // 執行遷移 - 使用安全的 SQL
    await pool.query(`
      DO $$ 
      BEGIN 
        BEGIN
          ALTER TABLE orders ADD COLUMN payment_method TEXT DEFAULT 'cash';
          RAISE NOTICE 'payment_method 欄位已添加';
        EXCEPTION
          WHEN duplicate_column THEN
            RAISE NOTICE 'payment_method 欄位已存在';
        END;
      END $$;
    `);

    // 更新現有記錄
    const updateResult = await pool.query(
      "UPDATE orders SET payment_method = 'cash' WHERE payment_method IS NULL"
    );

    // 建立索引
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_orders_payment_method ON orders(payment_method)
    `);

    console.log('✅ 遷移完成！');
    console.log(`   - 欄位已添加: payment_method`);
    console.log(`   - 更新記錄數: ${updateResult.rowCount}`);
    console.log(`   - 索引已建立: idx_orders_payment_method`);

    return { 
      success: true, 
      action: 'migration_completed',
      updatedRows: updateResult.rowCount,
      message: '遷移成功完成'
    };

  } catch (error) {
    console.warn('⚠️ 自動遷移失敗，但服務將繼續運行:', error.message);
    
    // 記錄錯誤但不拋出異常
    return { 
      success: false, 
      error: error.message,
      message: '遷移失敗，但服務正常啟動'
    };
  }
}

module.exports = { smartAutoMigration };