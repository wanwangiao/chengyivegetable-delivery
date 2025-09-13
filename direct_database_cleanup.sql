-- 直接清理資料庫中的測試訂單
-- 在Railway資料庫控制台執行

-- 1. 先查看現有訂單
SELECT 
    id, 
    contact_name, 
    contact_phone, 
    status, 
    total_amount,
    created_at
FROM orders 
ORDER BY created_at DESC 
LIMIT 20;

-- 2. 查看訂單明細
SELECT 
    o.id as order_id,
    o.contact_name,
    oi.name as item_name,
    oi.quantity,
    oi.price
FROM orders o 
LEFT JOIN order_items oi ON o.id = oi.order_id 
ORDER BY o.created_at DESC;

-- 3. 清除測試訂單（根據常見測試名稱）
-- 先刪除訂單明細
DELETE FROM order_items 
WHERE order_id IN (
    SELECT id FROM orders 
    WHERE contact_name LIKE '%測試%'
    OR contact_name LIKE '%王小明%'
    OR contact_name LIKE '%李小華%'
    OR contact_name LIKE '%張小美%'
    OR contact_name LIKE '%陳大明%'
    OR contact_name LIKE '%林淑芬%'
    OR contact_name LIKE '%黃志偉%'
    OR contact_phone LIKE '%0912345%'
    OR contact_phone LIKE '%0923456%'
    OR contact_phone LIKE '%0934567%'
);

-- 再刪除訂單主記錄
DELETE FROM orders 
WHERE contact_name LIKE '%測試%'
OR contact_name LIKE '%王小明%'
OR contact_name LIKE '%李小華%'
OR contact_name LIKE '%張小美%'
OR contact_name LIKE '%陳大明%'
OR contact_name LIKE '%林淑芬%'
OR contact_name LIKE '%黃志偉%'
OR contact_phone LIKE '%0912345%'
OR contact_phone LIKE '%0923456%'
OR contact_phone LIKE '%0934567%';

-- 4. 如果需要清除所有訂單（謹慎使用）
-- DELETE FROM order_items;
-- DELETE FROM orders;
-- ALTER SEQUENCE orders_id_seq RESTART WITH 1;
-- ALTER SEQUENCE order_items_id_seq RESTART WITH 1;

-- 5. 驗證清理結果
SELECT COUNT(*) as total_orders FROM orders;
SELECT COUNT(*) as total_order_items FROM order_items;

-- 6. 最終確認
SELECT * FROM orders ORDER BY created_at DESC;