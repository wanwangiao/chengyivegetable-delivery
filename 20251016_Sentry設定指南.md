# Sentry 錯誤監控整合指南

> 建立日期: 2025-10-16
> 優先級: P0 - 錯誤監控

---

## 🎯 目標

整合 Sentry 錯誤監控,即時追蹤和修復生產環境的錯誤。

---

## 📋 設定步驟

### 步驟 1: 註冊 Sentry 帳號

1. 前往 https://sentry.io/signup/
2. 使用 GitHub 或 Email 註冊
3. 建立新組織 (Organization): `誠憶鮮蔬` 或 `ChengYi`

### 步驟 2: 建立專案

在 Sentry Dashboard:

1. 點擊 **"Create Project"**
2. 選擇平台: **Node.js**
3. 設定專案名稱: `chengyivegetable-api`
4. 選擇 Alert 頻率: **Alert on every new issue**
5. 點擊 **"Create Project"**
6. 複製 **DSN** (Data Source Name)

範例 DSN:
```
https://abc123def456@o1234567.ingest.sentry.io/7654321
```

### 步驟 3: 設定 Railway 環境變數

在 Railway Dashboard → API 服務 → Variables:

```bash
SENTRY_DSN=https://your-dsn-here@sentry.io/project-id
```

**重要**: 設定後需要重新部署服務!

### 步驟 4: 驗證整合

部署後,檢查 Railway 日誌應該看到:

```
Sentry initialized (environment: production)
```

---

## 🧪 測試 Sentry 整合

### 方法 1: 手動觸發測試錯誤

建立測試端點 (僅用於開發/測試):

```typescript
// apps/api/src/application/routes/index.ts
if (env.NODE_ENV !== 'production') {
  router.get('/test-sentry', (_req, _res) => {
    throw new Error('Test Sentry error - this is intentional!');
  });
}
```

測試:
```bash
curl https://chengyivegetable-api-production.up.railway.app/api/v1/test-sentry
```

### 方法 2: 使用 Sentry CLI

```bash
# 安裝 Sentry CLI
npm install -g @sentry/cli

# 發送測試事件
sentry-cli send-event -m "Test error from CLI"
```

### 方法 3: 檢查現有錯誤

在 Sentry Dashboard 查看是否有捕獲到的錯誤。

---

## 📊 Sentry Dashboard 功能

### Issues (問題追蹤)

- **查看所有錯誤**: 按頻率、影響使用者數排序
- **錯誤詳情**: Stack trace、請求資訊、使用者 context
- **狀態管理**: Resolve、Ignore、Assign

### Performance (效能監控)

- **交易追蹤**: API 請求的效能分析
- **慢查詢偵測**: 找出效能瓶頸
- **取樣率**: 目前設定為 10% (生產環境)

### Releases (版本追蹤)

使用 Git commit SHA 追蹤錯誤是在哪個版本出現:

```bash
# Railway 自動設定
RAILWAY_GIT_COMMIT_SHA=abc123def
```

### Alerts (警報設定)

建議設定:

1. **Critical Errors**: 立即通知
   - 影響 > 100 位使用者
   - 錯誤率 > 5%

2. **New Issues**: Email 通知
   - 新類型的錯誤出現

3. **Slack Integration**: 團隊頻道通知
   - 設定 Slack Webhook

---

## 🔐 安全與隱私

### 已實作的資料過濾

在 `sentry.ts` 中的 `beforeSend` 函數:

```typescript
beforeSend(event) {
  // 移除敏感 headers
  delete event.request.headers['authorization'];
  delete event.request.headers['cookie'];

  // 移除敏感查詢參數
  if (params.has('token')) params.delete('token');
  if (params.has('password')) params.delete('password');

  return event;
}
```

### 建議額外過濾

- 信用卡號
- 身分證字號
- 完整地址
- 電話號碼

---

## 📈 最佳實踐

### 1. 設定錯誤層級

```typescript
import { Severity } from '@sentry/node';

// 警告
Sentry.captureMessage('User attempted invalid action', Severity.Warning);

// 錯誤
Sentry.captureException(error);

// 致命錯誤
Sentry.captureException(error, { level: Severity.Fatal });
```

### 2. 添加 Context

```typescript
Sentry.setContext('order', {
  orderId: order.id,
  totalAmount: order.totalAmount,
  customerId: order.customerId
});

// 或使用 tags
Sentry.setTag('order_status', order.status);
Sentry.setTag('payment_method', order.paymentMethod);
```

### 3. 追蹤使用者

```typescript
Sentry.setUser({
  id: user.id,
  email: user.email,
  username: user.name
});
```

### 4. 手動捕獲錯誤

```typescript
try {
  await riskyOperation();
} catch (error) {
  Sentry.captureException(error, {
    tags: {
      operation: 'riskyOperation',
      module: 'order-service'
    }
  });
  // 繼續處理...
}
```

---

## 🚨 Alert 規則建議

### 高優先級 (立即處理)

- 資料庫連線失敗
- 支付處理錯誤
- 訂單建立失敗
- 認證系統錯誤

### 中優先級 (24小時內處理)

- 外部 API 呼叫失敗
- 檔案上傳錯誤
- Email 發送失敗

### 低優先級 (本週處理)

- UI 顯示問題
- 非關鍵功能錯誤
- 效能警告

---

## 📊 監控指標

### 建議追蹤的指標

1. **錯誤率**: < 1% 為健康
2. **平均回應時間**: < 200ms
3. **P95 回應時間**: < 500ms
4. **資料庫查詢時間**: < 100ms
5. **外部 API 呼叫時間**: < 1000ms

---

## ✅ 檢查清單

- [ ] 已註冊 Sentry 帳號
- [ ] 已建立 `chengyivegetable-api` 專案
- [ ] 已複製 DSN
- [ ] 已在 Railway 設定 `SENTRY_DSN` 環境變數
- [ ] 已重新部署 API 服務
- [ ] 已在日誌中確認 "Sentry initialized"
- [ ] 已發送測試錯誤驗證整合
- [ ] 已在 Sentry Dashboard 看到測試錯誤
- [ ] 已設定 Slack/Email 通知
- [ ] 已建立 Alert 規則

---

## 🔗 相關連結

- Sentry Dashboard: https://sentry.io/
- Sentry Node.js 文件: https://docs.sentry.io/platforms/node/
- Best Practices: https://docs.sentry.io/platforms/node/best-practices/

---

## 📝 故障排除

### 問題 1: Sentry 未初始化

**症狀**: 日誌中沒有 "Sentry initialized"

**解決方法**:
1. 檢查 `SENTRY_DSN` 環境變數是否設定
2. 檢查 DSN 格式是否正確
3. 重新部署服務

### 問題 2: 錯誤未出現在 Sentry

**症狀**: 產生錯誤但 Sentry 沒有記錄

**檢查項目**:
1. Sentry SDK 版本是否最新
2. 是否在 `ignoreErrors` 列表中
3. 網路連線是否正常
4. Sentry 專案配額是否已滿

### 問題 3: 敏感資訊洩漏

**症狀**: Sentry 記錄包含密碼、Token 等

**解決方法**:
1. 檢查 `beforeSend` 過濾邏輯
2. 添加更多敏感欄位過濾
3. 使用 Sentry Data Scrubbing 功能

---

**最後更新**: 2025-10-16
**負責人**: DevOps Team
