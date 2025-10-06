# 基礎設施說明

## Docker Compose
`infra/docker-compose.yml` 提供本機一鍵啟動的環境，包含：
- `api`：以專案根目錄建置映像並啟動 Express 服務（預設埠 3000）。
- `web`：Next.js 服務（預設埠 3001）。
- `postgres`：PostgreSQL 16，預設帳號／密碼皆為 `postgres`。
- `redis`：Redis 7。

使用方式：
```bash
docker compose -f infra/docker-compose.yml up --build
```

停止服務：
```bash
docker compose -f infra/docker-compose.yml down
```

資料庫 Volume 預設掛載於 `postgres-data`，可依需求清除或備份。

## Dockerfiles
`infra/dockerfiles/` 內提供 `api.Dockerfile` 與 `web.Dockerfile`，可作為自建映像（如部署至 Railway、Fly.io 或自架 K8s）的基礎。

## Terraform
目前僅預留目錄，尚未撰寫模組。若後續要建置雲端基礎設施，可在 `infra/terraform` 內新增：
- `modules/`：共用的 PostgreSQL / Redis / App Service 模組。
- `environments/{staging,production}`：環境參數與狀態檔。

實作建議：
1. 先確認目標平台（例：Railway / Fly.io / AWS）。
2. 將密鑰管理放入 Terraform Cloud 或其他秘密管理機制。
3. 搭配 `.github/workflows/deploy.yml` 完成 CI/CD，於部署後執行 `pnpm --filter api prisma migrate deploy`。

---
目前部署流程尚在規劃階段，建議待本機測試與文件完善後再進行自動化部署整合。
