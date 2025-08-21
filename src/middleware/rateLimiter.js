// API 速率限制中間件
const rateLimit = require('express-rate-limit');

// Vercel 環境配置
const isProduction = process.env.NODE_ENV === 'production';
const isVercel = process.env.VERCEL === '1';

// 基礎配置，適用於 Vercel 環境
const baseConfig = {
  standardHeaders: true,
  legacyHeaders: false,
  // 在 Vercel 中使用更安全的 IP 提取策略
  ...(isVercel && {
    keyGenerator: (req) => {
      return req.ip || req.connection.remoteAddress || 'unknown';
    },
    skip: () => !isProduction, // 開發環境跳過限制
  })
};

// 一般API限制
const apiLimiter = rateLimit({
  ...baseConfig,
  windowMs: 15 * 60 * 1000, // 15分鐘
  max: 100, // 每個IP最多100次請求
  message: {
    success: false,
    message: '請求過於頻繁，請稍後再試'
  },
});

// 訂單提交限制（更嚴格）
const orderLimiter = rateLimit({
  ...baseConfig,
  windowMs: 5 * 60 * 1000, // 5分鐘
  max: 3, // 每個IP最多3個訂單
  message: {
    success: false,
    message: '訂單提交過於頻繁，請5分鐘後再試'
  },
});

// 登入嘗試限制（開發期間放寬）
const loginLimiter = rateLimit({
  ...baseConfig,
  windowMs: 5 * 60 * 1000, // 5分鐘
  max: 20, // 每個IP最多20次登入嘗試
  message: '登入嘗試過於頻繁，請稍後再試',
});

module.exports = {
  apiLimiter,
  orderLimiter,
  loginLimiter
};