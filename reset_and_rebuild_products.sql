-- ========================================
-- 清空並重建商品選項系統
-- 刪除現有資料，建立全新的商品選項架構
-- ========================================

-- 清空現有資料
DELETE FROM order_items;
DELETE FROM orders;
DELETE FROM products;

-- 重置序列
ALTER SEQUENCE orders_id_seq RESTART WITH 1;
ALTER SEQUENCE products_id_seq RESTART WITH 1;

-- 升級產品表架構
ALTER TABLE products ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS has_options BOOLEAN DEFAULT false;
ALTER TABLE products ADD COLUMN IF NOT EXISTS option_groups JSON;

-- 新增全新商品資料，依照商品特性設計合理選項

-- 1. 葉菜類 - 有機高麗菜
INSERT INTO products (name, price, unit, is_priced_item, description, has_options, option_groups, category_id, image_url) VALUES 
(
    '有機高麗菜',
    45,
    '斤',
    true,
    '有機栽培，無農藥殘留，清脆甜美，適合炒食、煮湯',
    true,
    JSON_OBJECT(
        'groups', JSON_ARRAY(
            JSON_OBJECT(
                'group_id', 1,
                'group_name', '規格選擇',
                'group_type', 'single',
                'required', true,
                'options', JSON_ARRAY(
                    JSON_OBJECT('option_id', 1, 'name', '小顆(約1斤)', 'price_modifier', 0, 'is_default', true, 'stock', 30),
                    JSON_OBJECT('option_id', 2, 'name', '中顆(約1.5斤)', 'price_modifier', 0, 'is_default', false, 'stock', 25),
                    JSON_OBJECT('option_id', 3, 'name', '大顆(約2斤)', 'price_modifier', 0, 'is_default', false, 'stock', 15)
                )
            ),
            JSON_OBJECT(
                'group_id', 2,
                'group_name', '加購蔬菜包',
                'group_type', 'multiple',
                'required', false,
                'options', JSON_ARRAY(
                    JSON_OBJECT('option_id', 4, 'name', '有機胡蘿蔔 半斤', 'price_modifier', 35, 'is_default', false, 'stock', 20),
                    JSON_OBJECT('option_id', 5, 'name', '有機白蘿蔔 半斤', 'price_modifier', 30, 'is_default', false, 'stock', 18)
                )
            )
        )
    ),
    1,
    '🥬'
),

-- 2. 根莖類 - 紅蘿蔔
(
    '新鮮紅蘿蔔',
    35,
    '斤',
    true,
    '橙紅飽滿，富含胡蘿蔔素，清甜爽脆，營養豐富',
    true,
    JSON_OBJECT(
        'groups', JSON_ARRAY(
            JSON_OBJECT(
                'group_id', 1,
                'group_name', '重量選擇',
                'group_type', 'single',
                'required', true,
                'options', JSON_ARRAY(
                    JSON_OBJECT('option_id', 1, 'name', '半斤裝', 'price_modifier', -15, 'is_default', false, 'stock', 40),
                    JSON_OBJECT('option_id', 2, 'name', '一斤裝', 'price_modifier', 0, 'is_default', true, 'stock', 50),
                    JSON_OBJECT('option_id', 3, 'name', '兩斤裝', 'price_modifier', 0, 'is_default', false, 'stock', 25)
                )
            )
        )
    ),
    1,
    '🥕'
),

-- 3. 水果類 - 蜜蘋果
(
    '紐西蘭蜜蘋果',
    120,
    '盒',
    false,
    '一天一蘋果，醫生遠離我！紐西蘭進口，香甜多汁',
    true,
    JSON_OBJECT(
        'groups', JSON_ARRAY(
            JSON_OBJECT(
                'group_id', 1,
                'group_name', '包裝規格',
                'group_type', 'single',
                'required', true,
                'options', JSON_ARRAY(
                    JSON_OBJECT('option_id', 1, 'name', '3顆裝', 'price_modifier', 0, 'is_default', true, 'stock', 30),
                    JSON_OBJECT('option_id', 2, 'name', '5顆裝', 'price_modifier', 80, 'is_default', false, 'stock', 20),
                    JSON_OBJECT('option_id', 3, 'name', '10顆家庭裝', 'price_modifier', 180, 'is_default', false, 'stock', 15)
                )
            )
        )
    ),
    2,
    '🍎'
),

-- 4. 番茄
(
    '溫室牛番茄',
    55,
    '斤',
    true,
    '溫室栽培，皮薄多汁，酸甜適中，富含茄紅素',
    true,
    JSON_OBJECT(
        'groups', JSON_ARRAY(
            JSON_OBJECT(
                'group_id', 1,
                'group_name', '重量選擇',
                'group_type', 'single',
                'required', true,
                'options', JSON_ARRAY(
                    JSON_OBJECT('option_id', 1, 'name', '半斤裝(約3-4顆)', 'price_modifier', -25, 'is_default', false, 'stock', 35),
                    JSON_OBJECT('option_id', 2, 'name', '一斤裝(約6-8顆)', 'price_modifier', 0, 'is_default', true, 'stock', 45)
                )
            )
        )
    ),
    1,
    '🍅'
),

-- 5. 季節蔬菜 - 桂竹筍
(
    '拉拉山桂竹筍',
    140,
    '斤',
    true,
    '拉拉山當季限定！鮮嫩清甜，纖維細緻，適合涼拌、炒食',
    true,
    JSON_OBJECT(
        'groups', JSON_ARRAY(
            JSON_OBJECT(
                'group_id', 1,
                'group_name', '數量選擇',
                'group_type', 'single',
                'required', true,
                'options', JSON_ARRAY(
                    JSON_OBJECT('option_id', 1, 'name', '2支裝', 'price_modifier', 0, 'is_default', false, 'stock', 20),
                    JSON_OBJECT('option_id', 2, 'name', '3支裝', 'price_modifier', 0, 'is_default', true, 'stock', 25),
                    JSON_OBJECT('option_id', 3, 'name', '5支裝', 'price_modifier', 0, 'is_default', false, 'stock', 15)
                )
            ),
            JSON_OBJECT(
                'group_id', 2,
                'group_name', '料理建議加購',
                'group_type', 'multiple',
                'required', false,
                'options', JSON_ARRAY(
                    JSON_OBJECT('option_id', 4, 'name', '梅子粉調味包', 'price_modifier', 25, 'is_default', false, 'stock', 10),
                    JSON_OBJECT('option_id', 5, 'name', '芝麻醬包', 'price_modifier', 30, 'is_default', false, 'stock', 8)
                )
            )
        )
    ),
    1,
    '🎋'
),

-- 6. 菇類
(
    '有機杏鮑菇',
    60,
    '包',
    false,
    '有機認證，肉質厚實，口感類似鮑魚，適合燒烤、炒食',
    true,
    JSON_OBJECT(
        'groups', JSON_ARRAY(
            JSON_OBJECT(
                'group_id', 1,
                'group_name', '包裝規格',
                'group_type', 'single',
                'required', true,
                'options', JSON_ARRAY(
                    JSON_OBJECT('option_id', 1, 'name', '小包裝(約200g)', 'price_modifier', 0, 'is_default', true, 'stock', 40),
                    JSON_OBJECT('option_id', 2, 'name', '大包裝(約400g)', 'price_modifier', 40, 'is_default', false, 'stock', 25)
                )
            )
        )
    ),
    1,
    '🍄'
),

-- 7. 有機蔬菜 - 菠菜
(
    '有機波菜',
    40,
    '把',
    false,
    '有機栽培，葉片鮮綠，富含鐵質，適合汆燙、炒食',
    true,
    JSON_OBJECT(
        'groups', JSON_ARRAY(
            JSON_OBJECT(
                'group_id', 1,
                'group_name', '數量選擇',
                'group_type', 'single',
                'required', true,
                'options', JSON_ARRAY(
                    JSON_OBJECT('option_id', 1, 'name', '1把', 'price_modifier', 0, 'is_default', true, 'stock', 50),
                    JSON_OBJECT('option_id', 2, 'name', '2把', 'price_modifier', 35, 'is_default', false, 'stock', 30),
                    JSON_OBJECT('option_id', 3, 'name', '3把家庭裝', 'price_modifier', 65, 'is_default', false, 'stock', 20)
                )
            )
        )
    ),
    1,
    '🥬'
),

-- 8. 特色商品 - 玉米筍
(
    '鮮甜玉米筍',
    80,
    '斤',
    true,
    '當季現採，鮮甜嫩脆，適合清炒、涼拌，營養價值高',
    true,
    JSON_OBJECT(
        'groups', JSON_ARRAY(
            JSON_OBJECT(
                'group_id', 1,
                'group_name', '重量選擇',  
                'group_type', 'single',
                'required', true,
                'options', JSON_ARRAY(
                    JSON_OBJECT('option_id', 1, 'name', '半斤裝', 'price_modifier', -35, 'is_default', false, 'stock', 25),
                    JSON_OBJECT('option_id', 2, 'name', '一斤裝', 'price_modifier', 0, 'is_default', true, 'stock', 35)
                )
            ),
            JSON_OBJECT(
                'group_id', 2,
                'group_name', '處理方式',
                'group_type', 'single', 
                'required', true,
                'options', JSON_ARRAY(
                    JSON_OBJECT('option_id', 3, 'name', '帶葉原裝', 'price_modifier', 0, 'is_default', true, 'stock', 30),
                    JSON_OBJECT('option_id', 4, 'name', '去葉清洗', 'price_modifier', 10, 'is_default', false, 'stock', 25)
                )
            )
        )
    ),
    1,
    '🌽'
);

-- 更新所有商品為啟用狀態
UPDATE products SET has_options = true WHERE option_groups IS NOT NULL;

-- 提交變更
COMMIT;

-- ========================================
-- 商品特色說明
-- ========================================

/*
已建立 8 項精選商品，每項都有合理的選項設計：

葉菜類：
- 有機高麗菜：規格選擇(小中大) + 加購蔬菜包
- 有機波菜：數量選擇(1-3把)

根莖類：
- 紅蘿蔔：重量選擇(半斤/一斤/兩斤)
- 玉米筍：重量選擇 + 處理方式(帶葉/去葉)

水果類：
- 紐西蘭蜜蘋果：包裝規格(3顆/5顆/10顆)

其他：
- 溫室牛番茄：重量選擇(半斤/一斤)
- 拉拉山桂竹筍：數量選擇 + 料理建議加購
- 有機杏鮑菇：包裝規格(小包/大包)

每項商品都有：
- 詳細說明
- 合理的選項設計
- 庫存管理
- 價格修正機制
*/