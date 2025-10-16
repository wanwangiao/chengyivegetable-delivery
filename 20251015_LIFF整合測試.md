# LIFF 整合測試指南

> 建立日期：2025-10-15
> 專案：誠憶鮮蔬線上系統
> 功能：自動註冊 LINE 使用者並發送通知

---

## ✅ 已完成的實作

### 1. 前端 LIFF 整合 ✅
- [x] 安裝 `@line/liff` SDK
- [x] 建立 `useLiff` Hook（自動初始化和獲取 LINE Profile）
- [x] 修改 checkout 頁面整合 LIFF
- [x] 訂單提交時自動傳送 `lineUserId` 和 `lineDisplayName`

### 2. 後端自動註冊 ✅
- [x] 修改訂單 API Schema 支援 `lineUserId` 和 `lineDisplayName`
- [x] 訂單建立時自動 upsert LineUser 記錄
- [x] 綁定 LINE User ID + 電話號碼

### 3. 部署 ✅
- [x] Git commit 並 push 到 GitHub
- [x] Railway 自動觸發部署

---

## 🎯 完整測試流程

### 步驟 1：等待 Railway 部署完成（約 3-5 分鐘）

1. **打開 Railway Dashboard**：
   - 進入 https://railway.app/
   - 選擇 `chengyivegetable` 專案
   - 點選 **Web 服務** 和 **API 服務**

2. **確認部署狀態**：
   - 兩個服務都應該顯示綠色勾勾 ✅
   - 最新的 commit 應該是：`feat: integrate LIFF SDK and auto-register LINE users`

---

### 步驟 2：設定 LIFF Endpoint URL

**⚠️ 重要：確認 LIFF App 的 Endpoint URL 已設定**

1. **打開 LINE Developers Console**：
   - 進入 https://developers.line.biz/console/
   - 選擇你的 Messaging API Channel
   - 點選 **LIFF** 標籤

2. **編輯 LIFF App**：
   - 找到 LIFF ID：`2008130399-z1QXZgma`
   - 點擊「Edit」
   - **Endpoint URL** 設定為：
     ```
     https://chengyivegetable-production-7b4a.up.railway.app
     ```
   - 確認 **Scope** 包含：`profile`, `openid`
   - **儲存設定**

---

### 步驟 3：從 LINE 圖文選單進入前端

1. **設定 LINE 圖文選單**（如果還沒設定）：
   - 在 LINE Developers Console → Messaging API
   - 找到「Rich menu」設定
   - 新增一個按鈕，連結設定為：
     ```
     https://liff.line.me/2008130399-z1QXZgma
     ```

2. **用手機打開 LINE Bot**：
   - 點擊圖文選單的按鈕
   - 應該會自動跳轉到誠憶鮮蔬網站
   - LIFF 會自動初始化並獲取你的 LINE Profile

3. **確認 LIFF 正常運作**：
   - 打開瀏覽器開發者工具（如果可以）
   - 檢查 console 是否有錯誤
   - 或者檢查 localStorage 是否有 `lineProfile` 資料

---

### 步驟 4：下單測試

1. **選購商品**：
   - 在商品頁面選擇幾項商品加入購物車
   - 確保總金額超過 $200（測試免運費）

2. **進入結帳頁面**：
   - 點擊購物車
   - 點擊「前往結帳」

3. **確認資料自動填入**：
   - 收件人姓名應該自動填入你的 LINE 顯示名稱
   - 如果之前有下過單，電話和地址也會自動填入

4. **完成表單並提交**：
   - 填寫電話號碼（**很重要！**用你的真實電話，例如 `0983709707`）
   - 填寫配送地址
   - 選擇付款方式
   - 點擊「送出訂單」

5. **確認訂單成功**：
   - 應該看到「✅ 訂單已送出，請留意 LINE 或簡訊通知！」
   - 記下訂單編號的前 8 碼

---

### 步驟 5：驗證 LINE 使用者已自動註冊

**方法 A：查看資料庫**

連線到 Railway PostgreSQL，執行：
```sql
SELECT
  "lineUserId",
  "displayName",
  phone,
  "createdAt"
FROM "LineUser"
WHERE phone = '0983709707'; -- 替換成你的電話
```

應該會看到一筆記錄，包含：
- `lineUserId`：你的真實 LINE User ID（`U` 開頭，33 字元）
- `displayName`：你的 LINE 顯示名稱
- `phone`：你剛才填寫的電話號碼
- `createdAt`：剛才的時間戳記

**方法 B：查看 Railway 日誌**

1. 打開 Railway Dashboard → API 服務 → Logs
2. 搜尋 `LINE user registered/updated`
3. 應該會看到類似這樣的記錄：
   ```json
   {
     "level": "info",
     "msg": "LINE user registered/updated",
     "lineUserId": "U1234567890abcdef...",
     "phone": "0983709707"
   }
   ```

---

### 步驟 6：測試 LINE 通知

**⚠️ 這個步驟會發送真實的 LINE 訊息給你！**

1. **確認訂單已建立**：
   - 你應該已經收到「訂單建立通知」LINE 訊息
   - 訊息內容包含：訂單編號、配送日期、訂單金額

2. **如果沒有收到訊息**：
   - 檢查 Railway API 日誌，搜尋 `LINE message sent`
   - 確認 LINE_CHANNEL_ACCESS_TOKEN 已正確設定
   - 確認 LineUser 記錄已建立且電話號碼正確

3. **測試訂單狀態變更通知**：
   - 登入管理後台：`https://chengyivegetable-production-7b4a.up.railway.app/admin`
   - 找到剛才建立的訂單
   - 更新訂單狀態（例如：pending → preparing）
   - 你應該會收到「訂單狀態更新」LINE 訊息

---

## 🔍 故障排除

### 問題 1：LIFF 初始化失敗

**症狀**：開啟網站後出現錯誤訊息

**解決方法**：
1. 確認 LIFF ID 正確：`2008130399-z1QXZgma`
2. 確認從 LINE 內建瀏覽器開啟（必須從 LINE 圖文選單或聊天室連結進入）
3. 確認 LIFF App 的 Endpoint URL 已設定為 Web 服務網址

### 問題 2：訂單成功但沒有註冊 LineUser

**症狀**：訂單建立成功，但資料庫中沒有 LineUser 記錄

**檢查清單**：
1. 查看 Railway API 日誌，搜尋 `Failed to register LINE user`
2. 確認前端有正確傳送 `lineUserId`（檢查 Network 面板）
3. 確認 LINE User ID 格式正確（`U` 開頭，33 字元）

### 問題 3：收不到 LINE 通知

**症狀**：LineUser 已註冊，但收不到訊息

**檢查清單**：
1. 確認 `LINE_CHANNEL_ACCESS_TOKEN` 已設定在 Railway API 服務
2. 確認 LINE User ID 和電話號碼綁定正確
3. 查看日誌確認訊息發送狀態：
   ```
   LINE message sent successfully
   ```
4. 確認沒有封鎖 LINE Bot

---

## 📊 測試檢查清單

### 部署驗證
- [ ] Railway Web 服務部署成功
- [ ] Railway API 服務部署成功
- [ ] 最新 commit 已部署

### LIFF 設定
- [ ] LIFF Endpoint URL 已設定為 Web 服務網址
- [ ] LIFF Scope 包含 `profile`, `openid`
- [ ] LINE 圖文選單連結已設定為 LIFF URL

### 功能測試
- [ ] 從 LINE 開啟網站，LIFF 正常初始化
- [ ] checkout 頁面顯示 LINE 顯示名稱
- [ ] 提交訂單成功
- [ ] LineUser 記錄已自動建立（資料庫查詢確認）
- [ ] 收到「訂單建立通知」LINE 訊息
- [ ] 更新訂單狀態後收到通知

---

## 🎉 預期結果

**測試成功的標準**：

1. ✅ 客戶從 LINE 圖文選單進入網站
2. ✅ LIFF 自動獲取 LINE User ID 和顯示名稱
3. ✅ 客戶下單時填寫電話號碼和地址
4. ✅ 訂單建立成功
5. ✅ 系統自動建立 LineUser 記錄（綁定 LINE ID + 電話）
6. ✅ 客戶立即收到訂單確認 LINE 訊息
7. ✅ 之後所有訂單狀態變更都會收到 LINE 通知

**這樣客戶就不用手動註冊，下單即自動完成會員綁定！**

---

## 📝 技術實作摘要

### 前端流程
```
LINE 圖文選單
  ↓
LIFF 初始化 (useLiff hook)
  ↓
獲取 LINE User ID & Display Name
  ↓
儲存到 localStorage (lineProfile)
  ↓
checkout 頁面自動讀取並預填姓名
  ↓
提交訂單時一併傳送 lineUserId
```

### 後端流程
```
接收訂單請求 (含 lineUserId)
  ↓
Prisma upsert LineUser 記錄
  ├─ 如果不存在：建立新記錄
  └─ 如果已存在：更新電話和顯示名稱
  ↓
建立訂單
  ↓
觸發 order.created 事件
  ↓
查詢 LineUser (by phone)
  ↓
發送 LINE 通知
```

---

**測試完成後請告訴我結果！**
