/**
 * 智能自動遷移 - 不會阻止服務啟動
 * 這個版本即使遷移失敗，服務也會繼續運行
 * 包含外送員系統修復功能
 */

async function smartAutoMigration(pool) {
  // 如果沒有資料庫連線，直接跳過
  if (!pool) {
    console.log('⚠️ 無資料庫連線，跳過自動遷移');
    return { skipped: true, reason: '無資料庫連線' };
  }

  try {
    console.log('🔧 開始智能自動遷移...');
    console.log('🚛 包含外送員系統修復功能');
    
    // 快速檢查資料庫是否可用
    const healthCheck = await Promise.race([
      pool.query('SELECT 1'),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('資料庫連線超時')), 3000)
      )
    ]);
    
    console.log('✅ 資料庫連線正常');

    const migrationResults = [];

    // 1. 檢查並修復 orders 表的鎖定欄位 (外送員系統)
    try {
      console.log('🔍 檢查外送員系統所需的 orders 表鎖定欄位...');
      const lockColumnCheck = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'orders' AND column_name = 'locked_by'
      `);

      if (lockColumnCheck.rows.length === 0) {
        console.log('➕ 新增 orders 表鎖定欄位...');
        await pool.query(`
          DO $$
          BEGIN
              -- 新增鎖定相關欄位到 orders 表
              IF NOT EXISTS (
                  SELECT 1 FROM information_schema.columns 
                  WHERE table_name = 'orders' AND column_name = 'locked_by'
              ) THEN
                  ALTER TABLE orders 
                  ADD COLUMN locked_by INTEGER,
                  ADD COLUMN locked_at TIMESTAMP,
                  ADD COLUMN lock_expires_at TIMESTAMP;
                  
                  -- 新增索引提升查詢效能
                  CREATE INDEX idx_orders_locked_by ON orders(locked_by);
                  CREATE INDEX idx_orders_lock_expires ON orders(lock_expires_at);
                  
                  RAISE NOTICE '✅ orders 表鎖定欄位新增完成';
              END IF;
          END $$;
        `);
        migrationResults.push('✅ orders 表鎖定欄位新增完成');
      } else {
        console.log('✅ orders 表鎖定欄位已存在');
        migrationResults.push('✅ orders 表鎖定欄位已存在');
      }
    } catch (error) {
      console.warn('⚠️ orders 鎖定欄位遷移失敗:', error.message);
      migrationResults.push('⚠️ orders 鎖定欄位遷移失敗');
    }

    // 2. 建立外送員系統所需的表格
    const requiredTables = [
      {
        name: 'offline_queue',
        sql: `CREATE TABLE IF NOT EXISTS offline_queue (
          id SERIAL PRIMARY KEY,
          driver_id INTEGER NOT NULL,
          action_type VARCHAR(50) NOT NULL,
          order_id INTEGER,
          data_payload TEXT,
          file_paths TEXT[],
          status VARCHAR(20) DEFAULT 'pending',
          created_at TIMESTAMP DEFAULT NOW(),
          processed_at TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_offline_queue_driver ON offline_queue(driver_id);
        CREATE INDEX IF NOT EXISTS idx_offline_queue_status ON offline_queue(status);`
      },
      {
        name: 'delivery_photos',
        sql: `CREATE TABLE IF NOT EXISTS delivery_photos (
          id SERIAL PRIMARY KEY,
          order_id INTEGER NOT NULL,
          driver_id INTEGER NOT NULL,
          photo_type VARCHAR(50) NOT NULL,
          original_filename VARCHAR(255),
          stored_filename VARCHAR(255),
          file_path TEXT NOT NULL,
          file_size INTEGER,
          upload_timestamp TIMESTAMP DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_delivery_photos_order ON delivery_photos(order_id);
        CREATE INDEX IF NOT EXISTS idx_delivery_photos_driver ON delivery_photos(driver_id);`
      },
      {
        name: 'delivery_problems',
        sql: `CREATE TABLE IF NOT EXISTS delivery_problems (
          id SERIAL PRIMARY KEY,
          order_id INTEGER NOT NULL,
          driver_id INTEGER NOT NULL,
          problem_type VARCHAR(50) NOT NULL,
          problem_description TEXT,
          priority VARCHAR(20) DEFAULT 'normal',
          status VARCHAR(20) DEFAULT 'reported',
          reported_at TIMESTAMP DEFAULT NOW(),
          resolved_at TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_delivery_problems_order ON delivery_problems(order_id);
        CREATE INDEX IF NOT EXISTS idx_delivery_problems_driver ON delivery_problems(driver_id);
        CREATE INDEX IF NOT EXISTS idx_delivery_problems_status ON delivery_problems(status);`
      }
    ];

    for (const table of requiredTables) {
      try {
        console.log(`🔍 檢查 ${table.name} 表是否存在...`);
        const tableCheck = await pool.query(`
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_schema = 'public' AND table_name = $1
        `, [table.name]);

        if (tableCheck.rows.length === 0) {
          console.log(`➕ 建立 ${table.name} 表...`);
          await pool.query(table.sql);
          migrationResults.push(`✅ ${table.name} 表建立成功`);
        } else {
          console.log(`✅ ${table.name} 表已存在`);
          migrationResults.push(`✅ ${table.name} 表已存在`);
        }
      } catch (error) {
        console.warn(`⚠️ ${table.name} 表建立失敗:`, error.message);
        migrationResults.push(`⚠️ ${table.name} 表建立失敗`);
      }
    }

    // 3. 確保 drivers 表存在並包含測試帳號
    try {
      console.log('🔍 檢查 drivers 表...');
      const driversTableCheck = await pool.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'drivers'
      `);

      if (driversTableCheck.rows.length === 0) {
        console.log('➕ 建立 drivers 表...');
        await pool.query(`
          CREATE TABLE IF NOT EXISTS drivers (
              id SERIAL PRIMARY KEY,
              driver_code VARCHAR(50) UNIQUE,
              name VARCHAR(100) NOT NULL,
              phone VARCHAR(20) UNIQUE NOT NULL,
              password_hash VARCHAR(255),
              status VARCHAR(20) DEFAULT 'available',
              created_at TIMESTAMP DEFAULT NOW(),
              updated_at TIMESTAMP DEFAULT NOW()
          );
        `);
        migrationResults.push('✅ drivers 表建立成功');
      }

      // 插入測試外送員（如果不存在）
      console.log('🔍 檢查測試外送員...');
      const testDriverCheck = await pool.query(
        'SELECT id FROM drivers WHERE phone = $1', 
        ['0912345678']
      );

      if (testDriverCheck.rows.length === 0) {
        console.log('➕ 新增測試外送員...');
        await pool.query(`
          INSERT INTO drivers (driver_code, name, phone, password_hash, status) 
          VALUES ('driver_001', '測試外送員', '0912345678', '$2b$10$rQZ1QZ1QZ1QZ1QZ1QZ1QZO', 'available')
          ON CONFLICT (phone) DO NOTHING
        `);
        migrationResults.push('✅ 測試外送員建立成功');
      } else {
        console.log('✅ 測試外送員已存在');
        migrationResults.push('✅ 測試外送員已存在');
      }
    } catch (error) {
      console.warn('⚠️ drivers 表處理失敗:', error.message);
      migrationResults.push('⚠️ drivers 表處理失敗');
    }

    // 4. 建立測試訂單數據
    try {
      console.log('🔍 檢查測試訂單...');
      const testOrderCheck = await pool.query(
        "SELECT COUNT(*) as count FROM orders WHERE order_number LIKE 'TEST%'"
      );

      if (parseInt(testOrderCheck.rows[0].count) === 0) {
        console.log('➕ 新增測試訂單...');
        await pool.query(`
          INSERT INTO orders (
              order_number, 
              customer_name, 
              customer_phone, 
              address, 
              status, 
              subtotal, 
              delivery_fee, 
              total, 
              created_at
          ) VALUES 
          (
              'TEST001', 
              '測試客戶A', 
              '0987654321', 
              '新北市三峽區中華路100號', 
              'packed', 
              200, 
              50, 
              250, 
              NOW()
          ),
          (
              'TEST002', 
              '測試客戶B', 
              '0987654322', 
              '新北市樹林區中正路200號', 
              'packed', 
              300, 
              50, 
              350, 
              NOW()
          ),
          (
              'TEST003', 
              '測試客戶C', 
              '0987654323', 
              '桃園市桃園區民生路300號', 
              'packed', 
              150, 
              50, 
              200, 
              NOW()
          )
          ON CONFLICT DO NOTHING
        `);
        migrationResults.push('✅ 測試訂單建立成功 (3筆)');
      } else {
        console.log(`✅ 測試訂單已存在 (${testOrderCheck.rows[0].count}筆)`);
        migrationResults.push(`✅ 測試訂單已存在 (${testOrderCheck.rows[0].count}筆)`);
      }
    } catch (error) {
      console.warn('⚠️ 測試訂單建立失敗:', error.message);
      migrationResults.push('⚠️ 測試訂單建立失敗');
    }

    // 5. 原有的 payment_method 欄位遷移
    const columnCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'orders' AND column_name = 'payment_method'
    `);

    if (columnCheck.rows.length === 0) {
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

      migrationResults.push(`✅ payment_method 欄位添加完成 (更新${updateResult.rowCount}筆)`);
    } else {
      // 檢查是否有 NULL 值需要修復
      const nullCheck = await pool.query(
        'SELECT COUNT(*) as count FROM orders WHERE payment_method IS NULL'
      );
      
      if (parseInt(nullCheck.rows[0].count) > 0) {
        console.log(`🔄 修復 ${nullCheck.rows[0].count} 筆 NULL 值...`);
        await pool.query("UPDATE orders SET payment_method = 'cash' WHERE payment_method IS NULL");
        migrationResults.push(`✅ payment_method NULL值修復完成 (${nullCheck.rows[0].count}筆)`);
      } else {
        migrationResults.push('✅ payment_method 欄位正常');
      }
    }

    console.log('🎉 外送員系統智能遷移完成！');
    console.log('📋 遷移結果:');
    migrationResults.forEach(result => console.log(`   ${result}`));

    return { 
      success: true, 
      action: 'driver_system_migration_completed',
      results: migrationResults,
      message: '外送員系統遷移成功完成'
    };

  } catch (error) {
    console.warn('⚠️ 外送員系統自動遷移失敗，但服務將繼續運行:', error.message);
    
    // 記錄錯誤但不拋出異常
    return { 
      success: false, 
      error: error.message,
      message: '外送員系統遷移失敗，但服務正常啟動'
    };
  }
}

module.exports = { smartAutoMigration };