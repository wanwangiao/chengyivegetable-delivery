-- 為商品表添加稱重商品定價支援欄位
-- 2025-08-29: 支援稱重商品的單價和單位設定

-- 添加稱重商品相關欄位
ALTER TABLE products ADD COLUMN IF NOT EXISTS weight_price_per_unit DECIMAL(10,2) DEFAULT NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS weight_unit VARCHAR(20) DEFAULT '斤';
ALTER TABLE products ADD COLUMN IF NOT EXISTS weight_display_unit VARCHAR(20) DEFAULT '公克';

-- 添加註解
COMMENT ON COLUMN products.weight_price_per_unit IS '稱重商品每單位價格(如每斤45元)';
COMMENT ON COLUMN products.weight_unit IS '定價單位(如斤、公斤)';
COMMENT ON COLUMN products.weight_display_unit IS '客戶選擇的顯示單位(如公克、克)';

-- 更新現有的計價商品設定稱重定價
-- 馬鈴薯設定為每斤45元
UPDATE products 
SET weight_price_per_unit = 45.00, 
    weight_unit = '斤',
    weight_display_unit = '公克'
WHERE name LIKE '%馬鈴薯%' AND is_priced_item = true;

-- 其他計價商品設定預設價格
UPDATE products 
SET weight_price_per_unit = CASE 
    WHEN name LIKE '%番茄%' THEN 55.00
    WHEN name LIKE '%洋蔥%' THEN 35.00  
    WHEN name LIKE '%胡蘿蔔%' THEN 40.00
    WHEN name LIKE '%高麗菜%' THEN 30.00
    ELSE 50.00
END,
    weight_unit = '斤',
    weight_display_unit = '公克'
WHERE is_priced_item = true AND weight_price_per_unit IS NULL;

-- 創建索引以提高查詢效能
CREATE INDEX IF NOT EXISTS idx_products_is_priced_weight ON products(is_priced_item, weight_price_per_unit) WHERE is_priced_item = true;