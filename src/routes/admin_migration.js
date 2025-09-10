/**
 * 管理員遷移路由
 * 用於執行資料庫遷移操作
 */

const express = require('express');
const router = express.Router();

// 確保這個路由只能由管理員訪問
const requireAdmin = (req, res, next) => {
  if (req.session && req.session.isAdmin) {
    next();
  } else {
    res.status(403).send('需要管理員權限');
  }
};

/**
 * 執行 payment_method 欄位遷移
 */
router.post('/add-payment-method-column', async (req, res) => {
  try {
    console.log('🔧 開始執行 payment_method 欄位遷移...');
    
    // 從主應用程式的資料庫連線池執行遷移
    const db = req.app.locals.pool;
    
    if (!db) {
      throw new Error('資料庫連線不可用');
    }

    const migrationSQL = `
      -- 為orders表添加payment_method欄位
      DO $$ 
      BEGIN 
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                         WHERE table_name='orders' AND column_name='payment_method') THEN
              ALTER TABLE orders ADD COLUMN payment_method TEXT DEFAULT 'cash';
              UPDATE orders SET payment_method = 'cash' WHERE payment_method IS NULL;
              RAISE NOTICE 'payment_method 欄位已成功添加到 orders 表';
          ELSE
              RAISE NOTICE 'payment_method 欄位已存在於 orders 表中';
          END IF;
      END $$;

      -- 建立索引以提升查詢效能
      CREATE INDEX IF NOT EXISTS idx_orders_payment_method ON orders(payment_method);
    `;

    // 執行遷移
    await db.query(migrationSQL);
    console.log('✅ 遷移 SQL 執行完成');

    // 驗證結果
    const checkResult = await db.query(`
      SELECT column_name, data_type, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'orders' AND column_name = 'payment_method'
    `);

    const indexResult = await db.query(`
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename = 'orders' AND indexname = 'idx_orders_payment_method'
    `);

    const orderCount = await db.query('SELECT COUNT(*) as count FROM orders');
    
    const paymentMethodDistribution = await db.query(`
      SELECT payment_method, COUNT(*) as count 
      FROM orders 
      WHERE payment_method IS NOT NULL
      GROUP BY payment_method
    `);

    const response = {
      success: true,
      message: 'payment_method 欄位遷移成功',
      details: {
        columnExists: checkResult.rows.length > 0,
        columnInfo: checkResult.rows[0] || null,
        indexExists: indexResult.rows.length > 0,
        totalOrders: parseInt(orderCount.rows[0].count),
        paymentMethodDistribution: paymentMethodDistribution.rows
      },
      timestamp: new Date().toISOString()
    };

    console.log('🎉 遷移成功完成:', response);
    res.json(response);

  } catch (error) {
    console.error('❌ 遷移失敗:', error);
    
    const errorResponse = {
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    };

    res.status(500).json(errorResponse);
  }
});

/**
 * 檢查遷移狀態
 */
router.get('/check-migration-status', async (req, res) => {
  try {
    const db = req.app.locals.pool;
    
    if (!db) {
      throw new Error('資料庫連線不可用');
    }

    // 檢查 payment_method 欄位
    const columnCheck = await db.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'orders' AND column_name = 'payment_method'
    `);

    // 檢查索引
    const indexCheck = await db.query(`
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename = 'orders' AND indexname = 'idx_orders_payment_method'
    `);

    // 檢查現有資料
    const orderStats = await db.query(`
      SELECT 
        COUNT(*) as total_orders,
        COUNT(CASE WHEN payment_method IS NOT NULL THEN 1 END) as orders_with_payment_method,
        COUNT(CASE WHEN payment_method IS NULL THEN 1 END) as orders_without_payment_method
      FROM orders
    `);

    const paymentMethodStats = await db.query(`
      SELECT 
        COALESCE(payment_method, 'NULL') as payment_method,
        COUNT(*) as count 
      FROM orders 
      GROUP BY payment_method
      ORDER BY count DESC
    `);

    const status = {
      migrationStatus: {
        paymentMethodColumnExists: columnCheck.rows.length > 0,
        indexExists: indexCheck.rows.length > 0,
        needsMigration: columnCheck.rows.length === 0
      },
      columnInfo: columnCheck.rows[0] || null,
      orderStatistics: orderStats.rows[0],
      paymentMethodDistribution: paymentMethodStats.rows,
      timestamp: new Date().toISOString()
    };

    res.json(status);

  } catch (error) {
    console.error('❌ 檢查遷移狀態失敗:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 遷移管理頁面
 */
router.get('/migration-dashboard', requireAdmin, (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="zh-TW">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>資料庫遷移管理</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
            .container { max-width: 800px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; }
            .button { padding: 10px 20px; margin: 10px; border: none; border-radius: 4px; cursor: pointer; }
            .primary { background: #007bff; color: white; }
            .success { background: #28a745; color: white; }
            .warning { background: #ffc107; color: black; }
            .danger { background: #dc3545; color: white; }
            .result { margin-top: 20px; padding: 15px; border-radius: 4px; }
            .success-result { background: #d4edda; border: 1px solid #c3e6cb; color: #155724; }
            .error-result { background: #f8d7da; border: 1px solid #f5c6cb; color: #721c24; }
            pre { background: #f8f9fa; padding: 10px; border-radius: 4px; overflow-x: auto; }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>🔧 資料庫遷移管理</h1>
            
            <div>
                <h3>📊 檢查遷移狀態</h3>
                <button class="button primary" onclick="checkStatus()">檢查當前狀態</button>
                <div id="statusResult"></div>
            </div>
            
            <hr>
            
            <div>
                <h3>🚀 執行遷移</h3>
                <p>這會為 orders 表添加 payment_method 欄位</p>
                <button class="button success" onclick="runMigration()">執行 payment_method 欄位遷移</button>
                <div id="migrationResult"></div>
            </div>
        </div>

        <script>
            async function checkStatus() {
                const resultDiv = document.getElementById('statusResult');
                resultDiv.innerHTML = '<p>檢查中...</p>';
                
                try {
                    const response = await fetch('/admin/migration/check-migration-status');
                    const data = await response.json();
                    
                    resultDiv.innerHTML = \`
                        <div class="result success-result">
                            <h4>✅ 狀態檢查完成</h4>
                            <pre>\${JSON.stringify(data, null, 2)}</pre>
                        </div>
                    \`;
                } catch (error) {
                    resultDiv.innerHTML = \`
                        <div class="result error-result">
                            <h4>❌ 檢查失敗</h4>
                            <p>\${error.message}</p>
                        </div>
                    \`;
                }
            }
            
            async function runMigration() {
                const resultDiv = document.getElementById('migrationResult');
                resultDiv.innerHTML = '<p>執行遷移中...</p>';
                
                try {
                    const response = await fetch('/admin/migration/add-payment-method-column', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        }
                    });
                    const data = await response.json();
                    
                    if (data.success) {
                        resultDiv.innerHTML = \`
                            <div class="result success-result">
                                <h4>🎉 遷移成功</h4>
                                <pre>\${JSON.stringify(data, null, 2)}</pre>
                            </div>
                        \`;
                    } else {
                        resultDiv.innerHTML = \`
                            <div class="result error-result">
                                <h4>❌ 遷移失敗</h4>
                                <pre>\${JSON.stringify(data, null, 2)}</pre>
                            </div>
                        \`;
                    }
                } catch (error) {
                    resultDiv.innerHTML = \`
                        <div class="result error-result">
                            <h4>❌ 遷移失敗</h4>
                            <p>\${error.message}</p>
                        </div>
                    \`;
                }
            }
            
            // 頁面載入時自動檢查狀態
            window.onload = function() {
                checkStatus();
            };
        </script>
    </body>
    </html>
  `);
});

module.exports = router;