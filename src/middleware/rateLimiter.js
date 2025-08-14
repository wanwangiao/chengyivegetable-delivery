// API 速率限制中間件
const rateLimit = require('express-rate-limit');

// 一般API限制
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分鐘
  max: 100, // 每個IP最多100次請求
  message: {
    success: false,
    message: '請求過於頻繁，請稍後再試'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// 訂單提交限制（更嚴格）
const orderLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5分鐘
  max: 3, // 每個IP最多3個訂單
  message: {
    success: false,
    message: '訂單提交過於頻繁，請5分鐘後再試'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// 登入嘗試限制
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分鐘
  max: 5, // 每個IP最多5次登入嘗試
  message: '登入嘗試過於頻繁，請稍後再試',
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  apiLimiter,
  orderLimiter,
  loginLimiter
};