import rateLimit from 'express-rate-limit';

// 全域限制：每 15 分鐘 100 次請求
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// 登入限制：每 15 分鐘 5 次嘗試
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many login attempts, please try again later.',
  skipSuccessfulRequests: true,
});

// 訂單建立限制：每分鐘 3 次
export const orderLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 3,
  message: 'Too many orders, please slow down.',
});
