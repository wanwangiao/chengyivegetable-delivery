# Web Module Skeleton

用於管理 Next.js / 靜態檔案部署（Vercel、Railway、Cloud Run、S3 + CloudFront…）。

目前為 `null_resource` 佔位，僅保留輸入參數。待決定平台後替換為真正的 provider。

建議參數：
- `service_name`
- `artifact`（Docker image / 靜態檔案來源）
- `domain`
- `environment_variables`
