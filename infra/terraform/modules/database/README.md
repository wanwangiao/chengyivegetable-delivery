# Database Module Skeleton

負責建立 PostgreSQL、Redis 或其他持久化資源。

目前透過 `null_resource` 佔位紀錄輸入參數；待選定供應商（RDS、Cloud SQL、Railway 等）後再替換為實際資源。

建議輸入：
- `name`
- `engine`
- `instance_size`
- `enable_redis`
