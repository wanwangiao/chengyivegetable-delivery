-- 新增 ProductOption.isActive 欄位
ALTER TABLE "ProductOption"
ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;

-- 確認欄位已新增
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'ProductOption' AND column_name = 'isActive';
