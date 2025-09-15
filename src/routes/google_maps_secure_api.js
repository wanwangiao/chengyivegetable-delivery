// =====================================
// 安全的 Google Maps API 路由 (簡化版本)
// 基本功能版本，移除複雜的代理和監控功能
// =====================================

const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');

let databasePool;

// 設定資料庫連線池
function setDatabasePool(pool) {
  databasePool = pool;
}

// API 限制中間件
const geocodingLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分鐘
  max: 100, // 限制每個IP每15分鐘最多100次請求
  message: {
    success: false,
    error: 'API 請求頻率過高，請稍後再試',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// 請求驗證中間件
const validateApiRequest = (req, res, next) => {
  const apiKey = req.headers['x-api-key'] || req.query.api_key;
  const validApiKeys = process.env.INTERNAL_API_KEYS?.split(',') || [];
  
  // 如果設定了內部 API Key，則需要驗證
  if (validApiKeys.length > 0 && !validApiKeys.includes(apiKey)) {
    return res.status(401).json({
      success: false,
      error: '無效的 API Key'
    });
  }
  
  next();
};

// 健康檢查端點
router.get('/health',
  async (req, res) => {
    try {
      const status = {
        service: 'Google Maps Secure API (Simplified)',
        status: 'operational',
        timestamp: new Date().toISOString(),
        database: databasePool ? 'connected' : 'disconnected',
        version: 'simplified'
      };
      
      // 檢查 API Key 是否可用
      if (process.env.GOOGLE_MAPS_API_KEY && 
          process.env.GOOGLE_MAPS_API_KEY !== 'your_google_maps_key_here') {
        status.apiKey = 'configured';
      } else {
        status.apiKey = 'missing';
        status.status = 'degraded';
      }
      
      // 檢查資料庫連線
      if (databasePool) {
        try {
          await databasePool.query('SELECT 1');
          status.database = 'healthy';
        } catch (error) {
          status.database = 'unhealthy';
          status.status = 'degraded';
        }
      }
      
      const httpStatus = status.status === 'operational' ? 200 : 503;
      return res.status(httpStatus).json(status);
      
    } catch (error) {
      console.error('健康檢查錯誤:', error);
      return res.status(500).json({
        service: 'Google Maps Secure API (Simplified)',
        status: 'error',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }
);

// 所有其他端點返回簡化訊息
router.all('*', (req, res) => {
  res.status(503).json({
    success: false,
    error: 'Google Maps 高級功能已簡化，請使用標準 Google Maps API',
    message: '系統已簡化，移除複雜的代理和監控功能以提升穩定性'
  });
});

module.exports = { 
  router,
  setDatabasePool
};