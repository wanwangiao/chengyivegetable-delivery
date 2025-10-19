import rateLimit from 'express-rate-limit';

// 根據環境調整限制：開發環境放寬，生產環境嚴格
const isDevelopment = process.env.NODE_ENV === 'development';

// 全域限制：每 15 分鐘 100 次請求 (開發環境: 1000 次)
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDevelopment ? 1000 : 100,
  message: 'Too many requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// 登入限制：每 15 分鐘 5 次嘗試 (開發環境: 50 次)
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDevelopment ? 50 : 5,
  message: 'Too many login attempts, please try again later.',
  skipSuccessfulRequests: true,
});

// 訂單建立限制：每分鐘 3 次 (開發環境: 100 次)
export const orderLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isDevelopment ? 100 : 3,
  message: 'Too many orders, please slow down.',
});
