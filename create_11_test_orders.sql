
-- 創建11筆測試訂單來模擬用戶報告的情況
-- 這些訂單將會顯示在外送員系統中

-- 首先清理可能存在的測試訂單
DELETE FROM orders WHERE customer_name LIKE '測試客戶%';

-- 創建三峽區訂單 (4筆)
INSERT INTO orders (customer_name, customer_phone, address, status, driver_id, total_amount, delivery_fee, payment_method, created_at) VALUES
('測試客戶1', '0912345001', '新北市三峽區中山路123號', 'packed', NULL, 150, 50, 'cash', NOW() - INTERVAL '2 hours'),
('測試客戶2', '0912345002', '新北市三峽區民權街45號', 'packed', NULL, 185, 50, 'linepay', NOW() - INTERVAL '1.5 hours'),
('測試客戶3', '0912345003', '新北市三峽區復興路67號', 'packed', NULL, 210, 50, 'transfer', NOW() - INTERVAL '1 hour'),
('測試客戶4', '0912345004', '新北市三峽區和平街89號', 'packed', NULL, 165, 50, 'cash', NOW() - INTERVAL '45 minutes');

-- 創建樹林區訂單 (3筆)
INSERT INTO orders (customer_name, customer_phone, address, status, driver_id, total_amount, delivery_fee, payment_method, created_at) VALUES
('測試客戶5', '0912345005', '新北市樹林區中正路234號', 'packed', NULL, 140, 50, 'linepay', NOW() - INTERVAL '40 minutes'),
('測試客戶6', '0912345006', '新北市樹林區民生街56號', 'packed', NULL, 175, 50, 'cash', NOW() - INTERVAL '35 minutes'),
('測試客戶7', '0912345007', '新北市樹林區文化路78號', 'packed', NULL, 195, 50, 'transfer', NOW() - INTERVAL '30 minutes');

-- 創建鶯歌區訂單 (2筆)
INSERT INTO orders (customer_name, customer_phone, address, status, driver_id, total_amount, delivery_fee, payment_method, created_at) VALUES
('測試客戶8', '0912345008', '新北市鶯歌區中山路345號', 'packed', NULL, 160, 50, 'cash', NOW() - INTERVAL '25 minutes'),
('測試客戶9', '0912345009', '新北市鶯歌區育英街67號', 'packed', NULL, 180, 50, 'linepay', NOW() - INTERVAL '20 minutes');

-- 創建土城區訂單 (1筆)
INSERT INTO orders (customer_name, customer_phone, address, status, driver_id, total_amount, delivery_fee, payment_method, created_at) VALUES
('測試客戶10', '0912345010', '新北市土城區中央路456號', 'packed', NULL, 170, 50, 'transfer', NOW() - INTERVAL '15 minutes');

-- 創建北大特區訂單 (1筆)
INSERT INTO orders (customer_name, customer_phone, address, status, driver_id, total_amount, delivery_fee, payment_method, created_at) VALUES
('測試客戶11', '0912345011', '新北市三峽區大學路123號', 'packed', NULL, 190, 50, 'cash', NOW() - INTERVAL '10 minutes');

-- 為每筆訂單創建訂單項目
INSERT INTO order_items (order_id, product_id, name, quantity, price) 
SELECT 
    o.id,
    1, -- 假設product_id=1是高麗菜
    '高麗菜',
    1,
    30
FROM orders o 
WHERE o.customer_name LIKE '測試客戶%' AND o.id NOT IN (SELECT DISTINCT order_id FROM order_items WHERE order_id = o.id);

INSERT INTO order_items (order_id, product_id, name, quantity, price) 
SELECT 
    o.id,
    2, -- 假設product_id=2是白蘿蔔
    '白蘿蔔',
    2,
    25
FROM orders o 
WHERE o.customer_name LIKE '測試客戶%' AND o.id NOT IN (SELECT DISTINCT order_id FROM order_items WHERE order_id = o.id AND product_id = 2);

-- 驗證創建的訂單
SELECT 
    '訂單創建驗證' as info,
    COUNT(*) as total_orders,
    COUNT(CASE WHEN status = 'packed' AND driver_id IS NULL THEN 1 END) as available_orders
FROM orders 
WHERE customer_name LIKE '測試客戶%';

-- 驗證地區分佈
SELECT 
    CASE 
        WHEN address LIKE '%三峽%' THEN '三峽區'
        WHEN address LIKE '%樹林%' THEN '樹林區'
        WHEN address LIKE '%鶯歌%' THEN '鶯歌區'
        WHEN address LIKE '%土城%' THEN '土城區'
        WHEN address LIKE '%北大%' THEN '北大特區'
        ELSE '其他區域'
    END as area,
    COUNT(*) as count
FROM orders 
WHERE customer_name LIKE '測試客戶%' AND status = 'packed' AND driver_id IS NULL
GROUP BY 1
ORDER BY count DESC;

COMMIT;
