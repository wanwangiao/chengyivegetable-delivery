# Railway 外送員系統修復指南

## 📋 概述

這個修復包含兩個主要腳本，用於修復 Railway 平台上的外送員系統資料庫問題：

1. `railway_driver_fix.js` - 主要修復腳本
2. `test_railway_fix.js` - 驗證修復結果

## 🚀 執行步驟

### 步驟 1: 在 Railway 上執行修復

在 Railway 控制台中，執行以下指令：

```bash
node railway_driver_fix.js
```

這個腳本會：
- ✅ 自動偵測並使用 Railway 的 DATABASE_URL 環境變數
- ✅ 執行 `fix_driver_database.sql` 中的所有修復指令
- ✅ 建立外送員系統所需的所有表格和欄位
- ✅ 插入測試資料供開發使用
- ✅ 生成詳細的執行報告

### 步驟 2: 驗證修復結果

```bash
node test_railway_fix.js
```

這個腳本會檢查：
- 📋 表格結構是否正確建立
- 📊 資料完整性
- 🔍 索引是否正確建立
- 👤 測試帳號是否存在

## 🔧 修復內容詳情

### 資料庫表格修復

1. **orders 表擴充**
   - 新增 `locked_by` 欄位（外送員鎖定功能）
   - 新增 `locked_at` 欄位（鎖定時間）
   - 新增 `lock_expires_at` 欄位（鎖定到期時間）
   - 建立相關索引提升查詢效能

2. **offline_queue 表**
   - 離線操作佇列，支援外送員離線功能
   - 包含動作類型、資料負載、檔案路徑等欄位

3. **delivery_photos 表**
   - 配送照片存儲
   - 支援多種照片類型和檔案管理

4. **delivery_problems 表**
   - 配送問題記錄
   - 支援問題分類、優先級和狀態管理

5. **drivers 表**
   - 外送員基本資料
   - 包含測試外送員帳號

### 測試資料

修復腳本會自動建立：
- 👤 測試外送員帳號：`0912345678`
- 📦 3筆測試訂單（TEST001, TEST002, TEST003）

## 🐛 常見問題排除

### 問題 1: 連線失敗
```
❌ 無法建立資料庫連接
```

**解決方案：**
1. 確認 Railway 專案中的 DATABASE_URL 環境變數已設定
2. 檢查資料庫服務是否正常運行
3. 確認網路連線正常

### 問題 2: 權限錯誤
```
❌ 權限不足，無法建立表格
```

**解決方案：**
1. 確認資料庫使用者具有 CREATE、ALTER 權限
2. 檢查 Railway 資料庫服務的權限設定

### 問題 3: 表格已存在
```
⚠️ 表格已存在，跳過建立
```

**這是正常情況**，腳本會自動檢查並跳過已存在的表格。

## 📊 修復完成後的驗證

執行修復後，你應該看到：

```
🎉 外送員系統資料庫修復完成！
📋 已建立表格：orders(新增欄位), offline_queue, delivery_photos, delivery_problems, drivers
🚚 已插入測試外送員：0912345678
📦 已插入3筆測試訂單供外送員測試使用
```

## 🔄 後續步驟

1. **部署應用程式**
   ```bash
   railway up
   ```

2. **測試外送員登入**
   - 使用測試帳號 `0912345678` 登入

3. **驗證 API 功能**
   - 訂單列表：`/api/driver-simplified/order-counts`
   - 接取訂單：`/api/driver-simplified/take-orders`
   - 我的訂單：`/api/driver-simplified/my-orders`

## 📞 技術支援

如果修復過程中遇到問題：

1. 查看 Railway 部署日誌
2. 執行 `test_railway_fix.js` 獲得詳細診斷
3. 檢查環境變數設定
4. 確認資料庫服務狀態

## 📝 重要注意事項

- ⚠️ 此腳本設計為安全執行，不會覆蓋已存在的資料
- ✅ 所有 SQL 操作都使用 `IF NOT EXISTS` 確保冪等性
- 🔒 自動處理 SSL 連線設定
- 📊 提供詳細的執行日誌和錯誤報告