# Railway 服務網址配置

> 最後更新：2025-10-15
> 專案：誠憶鮮蔬線上系統

---

## 🌐 生產環境服務網址

### 1. Web 服務 (前端 + Next.js)
- **網址**: https://chengyivegetable-production-7b4a.up.railway.app/
- **環境變數**: `RAILWAY_BUILD_TARGET=web`
- **用途**: Next.js 前端界面、客戶下單頁面
- **技術棧**: Next.js 14, React 18, Material-UI

### 2. API 服務 (後端 + Express)
- **網址**: https://chengyivegetable-api-production.up.railway.app/
- **環境變數**: `RAILWAY_BUILD_TARGET=api`
- **用途**: Express REST API、LINE Bot Webhook、訂單管理
- **技術棧**: Express, Prisma, PostgreSQL, Redis
- **重要端點**:
  - Health Check: `/api/v1/health`
  - LINE Webhook: `/api/v1/line/webhook`
  - Admin API: `/api/v1/admin/*`
  - Orders API: `/api/v1/orders`
  - Products API: `/api/v1/products`

### 3. Driver 服務 (外送員 App)
- **網址**: https://chengyivegetable-driver-production.up.railway.app/
- **環境變數**: `RAILWAY_BUILD_TARGET=driver`
- **用途**: Expo Driver App、外送員配送管理
- **技術棧**: Expo, React Native Web

---

## 🔗 LINE Bot 配置

### Webhook URL
```
https://chengyivegetable-api-production.up.railway.app/api/v1/line/webhook
```

### 設定位置
1. LINE Developers Console: https://developers.line.biz/console/
2. 選擇您的 Messaging API Channel
3. Webhook settings → Webhook URL
4. 貼上上方網址並啟用 "Use webhook"

---

## 🧪 快速測試命令

### 測試 Web 服務
```bash
curl https://chengyivegetable-production-7b4a.up.railway.app/
```

### 測試 API 服務
```bash
curl https://chengyivegetable-api-production.up.railway.app/api/v1/health
```

### 測試 Driver 服務
```bash
curl https://chengyivegetable-driver-production.up.railway.app/
```

### 測試 LINE Webhook
```bash
curl -X POST https://chengyivegetable-api-production.up.railway.app/api/v1/line/webhook \
  -H "Content-Type: application/json" \
  -H "x-line-signature: test" \
  -d '{"events": []}'
```

---

## 📊 服務狀態檢查

### 檢查所有服務
```bash
# Web
curl -I https://chengyivegetable-production-7b4a.up.railway.app/

# API
curl -I https://chengyivegetable-api-production.up.railway.app/api/v1/health

# Driver
curl -I https://chengyivegetable-driver-production.up.railway.app/
```

---

## 🔐 環境變數配置

### 所有服務共用的環境變數
```bash
DATABASE_URL=postgresql://...
NODE_ENV=production
SESSION_SECRET=...
JWT_SECRET=...
```

### API 服務專用
```bash
RAILWAY_BUILD_TARGET=api
LINE_CHANNEL_ID=...
LINE_CHANNEL_SECRET=...
LINE_CHANNEL_ACCESS_TOKEN=...
GOOGLE_MAPS_API_KEY=...
REDIS_URL=redis://...（可選）
```

### Web 服務專用
```bash
RAILWAY_BUILD_TARGET=web
NEXT_PUBLIC_API_URL=https://chengyivegetable-api-production.up.railway.app
```

### Driver 服務專用
```bash
RAILWAY_BUILD_TARGET=driver
EXPO_PUBLIC_API_BASE=https://chengyivegetable-api-production.up.railway.app
```

---

## 📝 備註

- 所有服務都使用同一個 PostgreSQL 資料庫
- API 服務是唯一與資料庫互動的服務
- Web 和 Driver 服務透過 API 服務存取資料
- LINE Bot Webhook 只能設定在 API 服務
- 記得在 Railway Dashboard 為每個服務設定正確的 `RAILWAY_BUILD_TARGET`

---

**重要提醒**:
- 修改環境變數後需要重新部署服務
- LINE Webhook URL 必須使用 HTTPS
- 測試 LINE Webhook 前需先完成 LINE Developers Console 設定
