# LINE Bot 設定與測試指南

> 最後更新：2025-10-15
> 專案：誠憶鮮蔬線上系統

---

## 🔧 LINE Bot 設定步驟

### 步驟 1：LINE Developers Console 設定

1. **登入 LINE Developers Console**
   - 網址：https://developers.line.biz/console/
   - 使用您的 LINE Business 帳號登入

2. **選擇您的 Messaging API Channel**
   - 在 Console 首頁選擇您的 Provider
   - 點選對應的 Messaging API Channel

3. **設定 Webhook URL**
   ```
   https://chengyivegetable-api-production.up.railway.app/api/v1/line/webhook
   ```

   **設定位置**：
   - 進入 Channel 設定頁面
   - 找到「Messaging API」標籤
   - 找到「Webhook settings」區塊
   - 點擊「Edit」按鈕
   - 輸入上方的 Webhook URL
   - 啟用「Use webhook」開關
   - 點擊「Update」儲存設定

4. **驗證 Webhook 連線**
   - 在 Webhook settings 區塊
   - 點擊「Verify」按鈕
   - 應該會顯示綠色勾勾 ✅ 表示連線成功

5. **取得必要的 Token 和 Secret**（應該已設定在 Railway）
   - Channel ID：在「Basic settings」找到
   - Channel Secret：在「Basic settings」找到
   - Channel Access Token：在「Messaging API」找到（長期有效）

---

## 📋 Railway 環境變數檢查清單

確認以下環境變數已設定在 Railway API 服務中：

- [x] `LINE_CHANNEL_ID` - Channel ID
- [x] `LINE_CHANNEL_SECRET` - Channel Secret
- [x] `LINE_CHANNEL_ACCESS_TOKEN` - Channel Access Token (長期)
- [x] `RAILWAY_BUILD_TARGET=api`

---

## 🧪 測試 LINE Bot 功能

### 測試 1：Webhook 端點連線測試

```bash
# 測試簽章驗證（應該返回 401 Invalid signature）
curl -X POST https://chengyivegetable-api-production.up.railway.app/api/v1/line/webhook \
  -H "Content-Type: application/json" \
  -H "x-line-signature: test_signature" \
  -d '{"events":[]}'
```

**預期結果**：
```json
{"error":"Invalid signature"}
```

### 測試 2：建立測試 LINE 使用者

在 Railway 的 PostgreSQL 資料庫執行以下 SQL：

```sql
-- 建立測試用 LINE 使用者
INSERT INTO "LineUser" (
  id,
  "lineUserId",
  "displayName",
  phone,
  "createdAt",
  "updatedAt"
) VALUES (
  gen_random_uuid(),
  'Utest123456789abcdef0123456789ab',  -- 測試用 LINE User ID（32字元）
  '測試客戶',                            -- 顯示名稱
  '0912345678',                         -- 電話號碼（需要與訂單一致）
  NOW(),
  NOW()
);

-- 查詢確認
SELECT * FROM "LineUser" WHERE phone = '0912345678';
```

### 測試 3：手動觸發訂單建立通知

在您的應用程式中建立一筆測試訂單：
- 使用電話號碼：`0912345678`
- 系統會自動發送 LINE 通知給對應的 LINE 使用者

### 測試 4：測試價格變動通知

1. **建立預訂單**（明日配送）
   - 電話號碼：`0912345678`
   - 選擇幾項商品

2. **修改商品價格**
   - 在管理後台修改商品的 `nextDayPrice`
   - 價格變動需超過 10%（或系統設定的閾值）

3. **執行價格檢查**
   - 價格檢查服務會自動執行（每小時一次）
   - 或手動觸發價格檢查服務

4. **驗證通知**
   - LINE 使用者應收到價格變動通知
   - 通知內容包含：
     - 商品價格變動明細
     - 總金額變化
     - 接受/取消指令說明

### 測試 5：測試客戶回應（接受/取消）

在收到價格變動通知後，在 LINE 聊天室回覆：

**接受價格變動**：
```
接受 12345678
```
或
```
accept 12345678
```

**取消訂單**：
```
取消 12345678
```
或
```
cancel 12345678
```

> 註：`12345678` 是訂單 ID 的前 8 碼

---

## 📊 LINE Bot 功能清單

### ✅ 已實作功能

1. **訂單建立通知**
   - 事件：`order.created`
   - 通知內容：訂單編號、配送日期、訂單金額

2. **訂單狀態變更通知**
   - 事件：`order.status-changed`
   - 通知內容：訂單編號、新狀態、備註

3. **價格變動通知**
   - 事件：`order.price-alert`
   - 通知內容：價格變動明細、新舊總金額、接受/取消指令
   - 自動接受機制：30 分鐘內未回應視為接受

4. **客戶回應處理**
   - 解析「接受」或「取消」指令
   - 更新訂單狀態和價格確認記錄
   - 支援中英文指令

### 🔐 安全機制

1. **簽章驗證**
   - 使用 HMAC SHA256 驗證 LINE Webhook 簽章
   - 防止偽造請求

2. **使用者驗證**
   - 只處理資料庫中已註冊的 LINE 使用者
   - 透過電話號碼關聯訂單

3. **訂單驗證**
   - 驗證訂單是否屬於該使用者（透過電話號碼）
   - 驗證訂單狀態是否允許操作

---

## 🐛 故障排除

### 問題 1：Webhook 驗證失敗

**症狀**：LINE Console 顯示 Webhook 驗證失敗

**解決方法**：
1. 確認 API 服務正在運行
   ```bash
   curl https://chengyivegetable-api-production.up.railway.app/api/v1/health
   ```
2. 確認 `LINE_CHANNEL_SECRET` 環境變數正確設定
3. 檢查 Railway 部署日誌

### 問題 2：無法收到 LINE 通知

**症狀**：訂單建立後沒有收到 LINE 訊息

**檢查清單**：
1. 確認 `LINE_CHANNEL_ACCESS_TOKEN` 已設定
2. 確認 LINE 使用者已在資料庫註冊（`LineUser` 表）
3. 確認電話號碼匹配（訂單的 `contactPhone` = `LineUser.phone`）
4. 檢查 Railway API 服務日誌

### 問題 3：客戶回應無效

**症狀**：在 LINE 回覆「接受/取消」沒有作用

**檢查清單**：
1. 確認訂單 ID 前綴正確（至少 8 碼）
2. 確認訂單狀態為 `priceAlertSent: true` 且 `priceConfirmed: null`
3. 確認回覆格式正確（範例：`接受 12345678` 或 `accept 12345678`）
4. 檢查 Railway API 服務日誌中的錯誤訊息

---

## 📝 資料庫表結構

### LineUser 表

| 欄位 | 類型 | 說明 |
|-----|------|------|
| id | UUID | 主鍵 |
| lineUserId | String | LINE User ID（唯一） |
| displayName | String | LINE 顯示名稱 |
| pictureUrl | String? | LINE 頭像 URL（可選） |
| phone | String? | 電話號碼（用於關聯訂單） |
| createdAt | DateTime | 建立時間 |
| updatedAt | DateTime | 更新時間 |

### PriceChangeAlert 表

| 欄位 | 類型 | 說明 |
|-----|------|------|
| id | UUID | 主鍵 |
| orderId | String | 訂單 ID |
| sentAt | DateTime | 通知發送時間 |
| confirmedAt | DateTime? | 客戶確認時間 |
| autoAcceptedAt | DateTime? | 自動接受時間 |
| customerResponse | String? | 客戶回應（accepted/cancelled） |
| priceChanges | JSON | 價格變動明細 |

---

## 🎯 下一步行動

1. **完成 LINE Developers Console 設定**
   - [ ] 設定 Webhook URL
   - [ ] 驗證 Webhook 連線
   - [ ] 確認 Token 和 Secret

2. **建立測試資料**
   - [ ] 在資料庫建立測試 LINE 使用者
   - [ ] 使用測試電話號碼建立訂單

3. **執行端對端測試**
   - [ ] 測試訂單建立通知
   - [ ] 測試訂單狀態變更通知
   - [ ] 測試價格變動通知
   - [ ] 測試客戶接受/取消回應

4. **監控和日誌**
   - [ ] 查看 Railway API 服務日誌
   - [ ] 確認所有通知正常發送
   - [ ] 檢查資料庫記錄完整性

---

**重要提醒**：
- LINE Bot 功能依賴於 `LINE_CHANNEL_ACCESS_TOKEN` 環境變數
- 測試前請確保所有環境變數已正確設定在 Railway
- 建議先在測試環境完成驗證再進入生產環境
