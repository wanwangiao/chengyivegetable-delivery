// 資料庫狀態檢查API
const { Pool } = require('pg');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  
  try {
    // 檢查環境變數
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      return res.json({
        status: 'error',
        message: '資料庫URL未設定',
        demoMode: true,
        env: {
          NODE_ENV: process.env.NODE_ENV,
          VERCEL: process.env.VERCEL || false
        }
      });
    }
    
    // 嘗試連接資料庫
    const pool = new Pool({
      connectionString: dbUrl,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 10000
    });
    
    const result = await pool.query('SELECT NOW() as current_time, version() as version');
    await pool.end();
    
    res.json({
      status: 'success',
      message: '生產模式已啟用 - 資料庫連線正常',
      demoMode: false,
      database: {
        connected: true,
        timestamp: result.rows[0].current_time,
        version: result.rows[0].version.substring(0, 50) + '...'
      },
      env: {
        NODE_ENV: process.env.NODE_ENV,
        VERCEL: process.env.VERCEL || false
      }
    });
    
  } catch (error) {
    res.json({
      status: 'error',
      message: '資料庫連線失敗',
      demoMode: true,
      error: error.message,
      env: {
        NODE_ENV: process.env.NODE_ENV,
        VERCEL: process.env.VERCEL || false
      }
    });
  }
};