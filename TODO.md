# 待辦事項清單

> 更新時間：2025-10-14 22:53
> 當前版本：v0.4.0

---

## 🔴 立即執行（部署前必須）

### 1. LINE Bot 設定
- [ ] 登入 [LINE Developers Console](https://developers.line.biz/)
- [ ] 設定 Webhook URL: `https://你的域名/api/v1/line/webhook`
- [ ] 啟用 "Use webhook"
- [ ] 複製 Channel Access Token → 設定到 Railway 環境變數 `LINE_CHANNEL_ACCESS_TOKEN`
- [ ] 複製 Channel Secret → 設定到 Railway 環境變數 `LINE_CHANNEL_SECRET`

### 2. Railway 環境變數
登入 [Railway Dashboard](https://railway.app/) 並設定：

```bash
LINE_CHANNEL_ACCESS_TOKEN=<你的Token>
LINE_CHANNEL_SECRET=<你的Secret>
DATABASE_URL=<已存在，檢查是否正確>
GOOGLE_MAPS_API_KEY=<已存在，可選>
NODE_ENV=production
```

### 3. 資料庫遷移
```bash
# Railway 會自動執行，或手動觸發
npx prisma generate
npx prisma db push
```

---

## 🟡 部署後驗證

### 基礎功能測試
- [ ] 訪問 `https://你的域名/api/v1/health` 確認服務運行
- [ ] 登入後台 `https://你的域名/admin`
- [ ] 訪問系統設定頁面 `https://你的域名/admin/settings`
- [ ] 訪問商品管理頁面 `https://你的域名/admin/products`

### 系統設定頁面
- [ ] 檢查預設時段設定是否正確（07:30-11:00, 14:00-23:59）
- [ ] 檢查價格閾值是否為 10%
- [ ] 檢查超時時間是否為 30 分鐘
- [ ] 嘗試修改設定並儲存

### 商品管理頁面
- [ ] 確認商品列表顯示雙價格（今日 / 明日）
- [ ] 點擊「立即同步明日價格」按鈕，確認成功
- [ ] 編輯商品，確認雙價格欄位可正常編輯
- [ ] 測試「複製今日價」按鈕功能

---

## 🟢 完整功能測試（需要 LINE Token）

### 準備測試資料
1. [ ] 在 `LineUser` 表建立測試使用者（綁定電話號碼）
2. [ ] 建立測試商品並設定初始價格
3. [ ] 將系統時間調整至 14:00-23:59（或修改系統設定）
4. [ ] 前台下一個預訂單（明日配送）

### 測試價格變動通知
1. [ ] 隔天早上 8:00（或手動），更新商品價格（變動 > 10%）
2. [ ] 後台點擊「檢查價格變動並通知」按鈕
3. [ ] 確認 LINE 收到價格變動通知
4. [ ] 檢查通知內容格式是否正確
5. [ ] 檢查資料庫 `PriceChangeAlert` 記錄是否建立
6. [ ] 檢查 `Order.priceAlertSent` 是否更新為 true

### 測試客戶回應
1. [ ] 在 LINE 回覆「接受 {訂單ID前8碼}」
2. [ ] 確認訂單狀態更新為 `priceConfirmed: true`
3. [ ] 確認 `PriceChangeAlert` 記錄 `confirmedAt` 和 `customerResponse`
4. [ ] 建立另一個測試訂單，回覆「取消 {訂單ID}」
5. [ ] 確認訂單狀態更新為 `status: 'cancelled'`, `priceConfirmed: false`

### 測試自動接受機制
1. [ ] 建立測試訂單並發送價格通知
2. [ ] 等待 30 分鐘（或修改 `priceConfirmTimeout` 為 1 分鐘測試）
3. [ ] 等待背景服務執行（每 5 分鐘）
4. [ ] 確認訂單自動更新為 `priceConfirmed: true`
5. [ ] 確認 `PriceChangeAlert.autoAcceptedAt` 已記錄
6. [ ] 檢查系統日誌是否有相關記錄

---

## 📝 本地測試（可選）

```bash
# 1. 啟動開發伺服器
cd /c/chengyivegetable
npm run dev

# 2. 訪問測試
# http://localhost:3000/admin/settings
# http://localhost:3000/admin/products

# 3. 測試 API 端點（使用 Postman 或 curl）
curl http://localhost:3001/api/v1/health
curl http://localhost:3001/api/v1/admin/settings \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 🐛 已知問題與待優化

### 技術債務
- [ ] PriceCheckService 使用 createdAt 判斷（應改為 deliveryDate）
- [ ] 缺少單元測試
- [ ] 缺少 E2E 測試
- [ ] LINE API 錯誤處理可加強（重試機制）
- [ ] 缺少 API Rate Limiting

### 效能優化
- [ ] 價格檢查可加入快取
- [ ] 大量訂單考慮批次處理
- [ ] 背景服務多實例需要分散式鎖

---

## 📚 參考文件

- 詳細進度記錄：`專案進度記錄.md`
- 資料庫 Schema：`apps/api/prisma/schema.prisma`
- LINE API 文件：https://developers.line.biz/en/docs/messaging-api/
- Railway 部署：https://docs.railway.app/

---

## ✅ 完成後打勾

部署完成後，請在此打勾：

- [ ] Railway 環境變數已設定
- [ ] LINE Bot Webhook 已設定並連線成功
- [ ] 資料庫遷移已完成
- [ ] 基礎功能測試通過
- [ ] 價格變動通知測試通過
- [ ] 客戶回應處理測試通過
- [ ] 自動接受機制測試通過

**全部完成後，此專案階段即可結案！** 🎉
