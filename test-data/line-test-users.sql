-- ============================================================
-- LINE Bot 測試資料 SQL 腳本
-- 專案：誠憶鮮蔬線上系統
-- 建立日期：2025-10-15
-- ============================================================

-- 說明：
-- 1. 此腳本用於建立 LINE Bot 測試所需的測試資料
-- 2. 請在 Railway PostgreSQL 資料庫中執行
-- 3. 執行前請確認資料庫連線正常

-- ============================================================
-- 建立測試 LINE 使用者
-- ============================================================

-- 測試用戶 1：一般客戶
INSERT INTO "LineUser" (
  id,
  "lineUserId",
  "displayName",
  phone,
  "createdAt",
  "updatedAt"
) VALUES (
  gen_random_uuid(),
  'Utest123456789abcdef0123456789ab',  -- 測試用 LINE User ID（必須是 32 字元）
  '測試客戶一號',
  '0912345678',                         -- 測試電話號碼
  NOW(),
  NOW()
)
ON CONFLICT ("lineUserId") DO NOTHING;  -- 如果已存在則跳過

-- 測試用戶 2：另一位客戶（可選）
INSERT INTO "LineUser" (
  id,
  "lineUserId",
  "displayName",
  phone,
  "createdAt",
  "updatedAt"
) VALUES (
  gen_random_uuid(),
  'Utest987654321fedcba9876543210cd',  -- 另一個測試用 LINE User ID
  '測試客戶二號',
  '0987654321',                         -- 另一個測試電話號碼
  NOW(),
  NOW()
)
ON CONFLICT ("lineUserId") DO NOTHING;

-- ============================================================
-- 查詢確認
-- ============================================================

-- 查詢所有測試 LINE 使用者
SELECT
  id,
  "lineUserId",
  "displayName",
  phone,
  "createdAt"
FROM "LineUser"
WHERE "lineUserId" LIKE 'Utest%'
ORDER BY "createdAt" DESC;

-- ============================================================
-- 測試訂單資料（可選）
-- ============================================================

-- 如果需要建立測試訂單，請使用以下範例：
-- 注意：請先確認有可用的商品資料

/*
-- 建立測試預訂單（明日配送）
INSERT INTO "Order" (
  id,
  "contactName",
  "contactPhone",
  address,
  status,
  subtotal,
  "deliveryFee",
  "totalAmount",
  "paymentMethod",
  notes,
  "deliveryDate",
  "isPreOrder",
  "createdAt",
  "updatedAt"
) VALUES (
  gen_random_uuid(),
  '測試客戶一號',
  '0912345678',                         -- 對應 LINE 使用者的電話號碼
  '台北市測試區測試路123號',
  'pending',
  250.00,
  0.00,
  250.00,
  'cash',
  '這是測試訂單',
  (CURRENT_DATE + INTERVAL '1 day'),    -- 明日配送
  true,                                 -- 是預訂單
  NOW(),
  NOW()
);
*/

-- ============================================================
-- 清理測試資料（謹慎使用）
-- ============================================================

-- 如果需要清理測試資料，請執行以下 SQL：
-- 警告：這會刪除所有測試資料，請確認後再執行

/*
-- 刪除測試 LINE 使用者
DELETE FROM "LineUser" WHERE "lineUserId" LIKE 'Utest%';

-- 刪除測試訂單（如果有建立）
DELETE FROM "Order" WHERE "contactPhone" IN ('0912345678', '0987654321');
*/

-- ============================================================
-- 測試 LINE 使用者註冊的替代方法
-- ============================================================

-- 方法 1：使用簡單的 UUID
-- 這個方法產生隨機的測試 LINE User ID

/*
INSERT INTO "LineUser" (
  id,
  "lineUserId",
  "displayName",
  phone,
  "createdAt",
  "updatedAt"
) VALUES (
  gen_random_uuid(),
  'Utest' || replace(gen_random_uuid()::text, '-', ''),  -- 自動產生
  '自動測試客戶',
  '0900000000',
  NOW(),
  NOW()
)
ON CONFLICT ("lineUserId") DO NOTHING;
*/

-- ============================================================
-- 驗證 LINE 整合所需的系統配置
-- ============================================================

-- 檢查系統配置
SELECT
  "lineNotificationEnabled",
  "priceChangeThreshold",
  "priceConfirmTimeout"
FROM "SystemConfig"
WHERE id = 'system-config';

-- 如果系統配置不存在或需要更新，請執行：
/*
INSERT INTO "SystemConfig" (
  id,
  "storeName",
  "lineNotificationEnabled",
  "priceChangeThreshold",
  "priceConfirmTimeout",
  "createdAt",
  "updatedAt"
) VALUES (
  'system-config',
  '誠憶鮮蔬',
  true,                                 -- 啟用 LINE 通知
  10.0,                                 -- 價格變動閾值 10%
  30,                                   -- 確認逾時 30 分鐘
  NOW(),
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  "lineNotificationEnabled" = true,
  "priceChangeThreshold" = 10.0,
  "priceConfirmTimeout" = 30;
*/

-- ============================================================
-- 完成
-- ============================================================

-- 執行完成後，您應該：
-- 1. 確認測試 LINE 使用者已建立
-- 2. 記下測試電話號碼（0912345678）
-- 3. 在前端使用此電話號碼建立訂單進行測試
-- 4. 檢查 Railway API 服務日誌確認 LINE 通知發送狀況
