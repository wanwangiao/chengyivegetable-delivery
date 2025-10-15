# API 速率限制配置

## 概述

本系統已實作 API 速率限制功能，以防止暴力破解、DDoS 攻擊和系統濫用。

## 使用套件

- **express-rate-limit** (v8.1.0): 基於 Express 的速率限制中間件

## 限制規則

### 1. 全域限制 (Global Limiter)

```typescript
windowMs: 15 * 60 * 1000  // 15 分鐘
max: 100                   // 最多 100 次請求
```

**應用範圍**: 所有 API 端點

**用途**: 防止一般性的 API 濫用和 DDoS 攻擊

**錯誤訊息**: "Too many requests, please try again later."

### 2. 登入限制 (Login Limiter)

```typescript
windowMs: 15 * 60 * 1000  // 15 分鐘
max: 5                     // 最多 5 次嘗試
skipSuccessfulRequests: true
```

**應用範圍**: `/api/v1/auth/login`

**用途**: 防止暴力破解密碼攻擊

**特性**: 成功的登入不計入限制次數

**錯誤訊息**: "Too many login attempts, please try again later."

### 3. 訂單建立限制 (Order Limiter)

```typescript
windowMs: 60 * 1000  // 1 分鐘
max: 3                // 最多 3 次請求
```

**應用範圍**: `POST /api/v1/orders`

**用途**: 防止惡意大量建立訂單

**錯誤訊息**: "Too many orders, please slow down."

## 檔案結構

```
apps/api/src/
├── middleware/
│   └── rate-limit.ts          # 速率限制配置
├── application/
│   └── routes/
│       ├── auth.routes.ts     # 登入路由 (應用 loginLimiter)
│       └── order.routes.ts    # 訂單路由 (應用 orderLimiter)
└── app.ts                      # 應用程式主檔 (應用 globalLimiter)
```

## 回應格式

當觸發速率限制時，API 會返回：

- **HTTP 狀態碼**: 429 (Too Many Requests)
- **標頭**:
  - `RateLimit-Limit`: 限制數量
  - `RateLimit-Remaining`: 剩餘請求數
  - `RateLimit-Reset`: 限制重置時間 (Unix timestamp)
  - `Retry-After`: 建議重試秒數

## 測試

### 手動測試

執行測試腳本：

```bash
# 確保 API 服務器在運行
cd apps/api
node test-rate-limit.js
```

### 使用 curl 測試

```bash
# 測試登入限制
for i in {1..7}; do
  curl -X POST http://localhost:3000/api/v1/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@test.com","password":"wrong"}' \
    -i
done

# 測試訂單限制
for i in {1..5}; do
  curl -X POST http://localhost:3000/api/v1/orders \
    -H "Content-Type: application/json" \
    -d '{"customerName":"Test","phone":"0912345678","items":[]}' \
    -i
done
```

## 自訂配置

### 修改限制參數

編輯 `apps/api/src/middleware/rate-limit.ts`:

```typescript
export const customLimiter = rateLimit({
  windowMs: 60 * 1000,  // 時間窗口 (毫秒)
  max: 10,              // 最大請求數
  message: '自訂錯誤訊息',
  standardHeaders: true,  // 使用標準的 RateLimit-* 標頭
  legacyHeaders: false,   // 停用舊的 X-RateLimit-* 標頭
});
```

### 應用到特定路由

在路由檔案中引入並使用：

```typescript
import { customLimiter } from '../../middleware/rate-limit';

router.post('/custom-endpoint', customLimiter, controller.handler);
```

## 生產環境建議

### 1. 使用外部儲存

在分散式環境中，建議使用 Redis 作為速率限制的儲存：

```typescript
import RedisStore from 'rate-limit-redis';
import { createClient } from 'redis';

const client = createClient({
  url: process.env.REDIS_URL
});

export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  store: new RedisStore({
    client,
    prefix: 'rate_limit:'
  })
});
```

### 2. 根據使用者類型調整限制

```typescript
export const dynamicLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: async (req) => {
    // 已認證用戶有更高的限制
    if (req.user?.role === 'ADMIN') return 1000;
    if (req.user) return 500;
    return 100; // 匿名用戶
  }
});
```

### 3. IP 白名單

```typescript
export const whitelistedLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  skip: (req) => {
    // 跳過內部 IP 或可信任的代理
    const trustedIPs = ['127.0.0.1', '::1'];
    return trustedIPs.includes(req.ip);
  }
});
```

## 監控與日誌

建議在生產環境中記錄速率限制事件：

```typescript
export const monitoredLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  handler: (req, res) => {
    logger.warn({
      message: 'Rate limit exceeded',
      ip: req.ip,
      path: req.path,
      user: req.user?.id
    });
    res.status(429).json({
      error: 'Too many requests'
    });
  }
});
```

## 安全注意事項

1. **Trust Proxy**: 確保 `app.set('trust proxy', 1)` 已設定，以正確識別客戶端 IP
2. **不要過於寬鬆**: 限制應該足夠嚴格以防止攻擊，但不要太嚴格影響正常使用
3. **不同端點不同限制**: 敏感操作（如登入、密碼重設）應該有更嚴格的限制
4. **監控與警報**: 設定警報以偵測異常的速率限制觸發模式

## 參考資源

- [express-rate-limit 文件](https://github.com/express-rate-limit/express-rate-limit)
- [OWASP Rate Limiting 指南](https://cheatsheetseries.owasp.org/cheatsheets/Denial_of_Service_Cheat_Sheet.html)
