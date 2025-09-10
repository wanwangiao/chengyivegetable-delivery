-- 快速修復：一鍵添加 payment_method 欄位
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'cash';
UPDATE orders SET payment_method = 'cash' WHERE payment_method IS NULL;
CREATE INDEX IF NOT EXISTS idx_orders_payment_method ON orders(payment_method);