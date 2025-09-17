# LINE 用戶綁定錯誤修復 - 部署指南

## 問題診斷摘要

### 根本原因
- **錯誤訊息**: `there is no unique or exclusion constraint matching the ON CONFLICT specification`
- **根本原因**: `users` 表中的 `line_user_id` 欄位沒有 UNIQUE 約束，但代碼嘗試使用 `ON CONFLICT (line_user_id)`
- **額外問題**: `phone` 欄位有 NOT NULL 約束，但 LINE 用戶可能沒有電話號碼

### 資料庫結構衝突
發現專案中有多個不一致的資料庫結構定義：
1. `schema.sql`: 主要結構，`users` 表以 `phone` 為必填和唯一鍵
2. `basic_settings_schema.sql`: 獨立的 `line_users` 表設計
3. `quick_database_setup.sql`: 與 schema.sql 類似但有細微差異

## 解決方案

### 第一步：執行資料庫約束修復
```bash
# 在 Railway 控制台執行以下 SQL 腳本
psql $DATABASE_URL -f fix_line_user_constraints.sql
```

### 第二步：驗證修復結果
```bash
# 驗證資料庫結構是否正確
psql $DATABASE_URL -f verify_line_user_fix.sql
```

### 第三步：部署更新後的代碼
```bash
# 提交代碼變更
git add .
git commit -m "🔧 修復LINE用戶綁定ON CONFLICT約束錯誤

- 修改資料庫約束：phone允許NULL，line_user_id添加UNIQUE
- 更新server.js使用正確的UPSERT語法
- 添加錯誤處理和備用方案
- 修復LineUserService.js的INSERT邏輯"

# 推送到 Railway
git push origin main
```

## 修復內容詳細說明

### 1. 資料庫結構修改 (`fix_line_user_constraints.sql`)
- ✅ 移除 `users.phone` 的 NOT NULL 約束
- ✅ 為 `users.line_user_id` 添加 UNIQUE 約束
- ✅ 創建索引以提高查詢性能
- ✅ 清理重複數據（如果存在）

### 2. 代碼修改

#### `src/server.js` (第 5745-5775 行)
```javascript
// 修復前：使用無效的 ON CONFLICT (line_user_id)
ON CONFLICT (line_user_id) DO UPDATE SET // ❌ line_user_id 沒有 UNIQUE 約束

// 修復後：正確的 UPSERT 操作 + 備用方案
try {
  await pool.query(`
    INSERT INTO users (line_user_id, line_display_name, name, created_at)
    VALUES ($1, $2, $3, NOW())
    ON CONFLICT (line_user_id) DO UPDATE SET // ✅ 現在有 UNIQUE 約束
      line_display_name = EXCLUDED.line_display_name,
      name = EXCLUDED.name
  `, [lineUserId, displayName, displayName]);
} catch (error) {
  // 備用方案：先查詢再插入
}
```

#### `src/services/LineUserService.js` (第 139-147 行)
```javascript
// 修復前：可能導致重複插入
INSERT INTO users (line_user_id, line_display_name, phone, name, created_at)
VALUES ($1, $2, NULL, $3, CURRENT_TIMESTAMP) // ❌ 沒有處理重複

// 修復後：安全的 UPSERT 操作
INSERT INTO users (line_user_id, line_display_name, name, created_at)
VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
ON CONFLICT (line_user_id) DO UPDATE SET // ✅ 處理重複情況
  line_display_name = EXCLUDED.line_display_name,
  name = EXCLUDED.name
```

## 驗證步驟

### 1. 檢查資料庫約束
```sql
-- 檢查 phone 是否允許 NULL
SELECT is_nullable FROM information_schema.columns 
WHERE table_name = 'users' AND column_name = 'phone';
-- 應該返回: YES

-- 檢查 line_user_id 是否有 UNIQUE 約束
SELECT constraint_name FROM information_schema.table_constraints 
WHERE table_name = 'users' AND constraint_type = 'UNIQUE' 
AND constraint_name LIKE '%line_user_id%';
-- 應該返回: uk_users_line_user_id
```

### 2. 測試 LINE 用戶綁定
1. 打開 LIFF 頁面
2. 登入 LINE 帳號
3. 執行用戶綁定操作
4. 檢查不應該再出現 "ON CONFLICT specification" 錯誤

## 緊急回滾方案

如果修復後出現問題，可以執行以下回滾：

```sql
-- 回滾資料庫約束修改
ALTER TABLE users ALTER COLUMN phone SET NOT NULL; -- 注意：這可能失敗如果有 NULL 值
ALTER TABLE users DROP CONSTRAINT IF EXISTS uk_users_line_user_id;
DROP INDEX IF EXISTS idx_users_line_user_id;
```

然後回滾代碼到之前的 commit。

## 預期結果
- ✅ LINE 用戶可以成功綁定
- ✅ 不再出現 "ON CONFLICT specification" 錯誤
- ✅ 支持沒有電話號碼的 LINE 用戶
- ✅ 避免重複用戶記錄
- ✅ 提高資料庫查詢性能

## 檔案清單
1. `fix_line_user_constraints.sql` - 資料庫約束修復腳本
2. `verify_line_user_fix.sql` - 驗證腳本
3. `src/server.js` - 更新的 API 端點代碼
4. `src/services/LineUserService.js` - 更新的服務代碼
5. `LINE_USER_FIX_DEPLOYMENT_GUIDE.md` - 本部署指南