# 部署指南

## 1. 環境需求
- Node.js 20（若使用 pnpm on-host 部署）。
- PostgreSQL 16 與 Redis 7。
- Linux 環境需安裝 `libvips` 以支援 `sharp`。
- 上傳目錄：預設 `/var/app/uploads`，可於 `.env` 透過 `FILE_STORAGE_PATH` 覆寫。

## 2. 推薦架構
- **API**：獨立 Node container，提供 REST / WebSocket。
- **Web**：Next.js container（可切換 SSR 或靜態輸出）。
- **Database**：託管 PostgreSQL（Railway、Neon、RDS……）。
- **Redis**：快取／排程佇列。
- **檔案儲存**：本地磁碟或 S3 兼容儲存服務。

## 3. 環境變數
- 參考 `infra/environments/staging.env.example` 與 `production.env.example` 建置。
- 部署前務必設定：
  - `SESSION_SECRET`、`JWT_SECRET` → 至少 32 字元亂數。
  - `LINE_CHANNEL_*` → 置於秘密管理系統。
  - `PUBLIC_APP_URL`、`EXPO_PUBLIC_API_BASE` → 對應實際網域。

## 4. 建置流程
### 4.1 Docker 映像
```bash
# API
docker build -f infra/dockerfiles/api.Dockerfile -t chengyi-api:latest .

# Web
docker build -f infra/dockerfiles/web.Dockerfile -t chengyi-web:latest .
```

### 4.2 Compose（單機或本地）
```bash
cp infra/environments/production.env.example .env
docker compose -f infra/docker-compose.yml up --build -d
```

> 若在雲端單機使用 compose，建議改用託管的 PostgreSQL / Redis，並調整 compose 服務。

## 5. 部署腳本
- `package.json` 新增 `pnpm test:api` / `test:web` / `test:driver` 便於分別驗證。
- 資料庫遷移：`pnpm --filter api prisma migrate deploy`。
- 建議 CI 流程：安裝依賴 → 執行測試 → 構建 Docker → 推送 Registry → 觸發平台部署。

## 6. GitHub Actions Secrets & Variables
- Secrets 建議至少設定：
  - `DATABASE_URL`：Production 資料庫連線字串（供 Prisma migrate deploy 使用）。
  - `RAILWAY_TOKEN`（或其他平台 Token）：部署時使用。
- Repository / Environment variables（可選）：
  - `K6_ENABLED`（`true/false`）：是否執行 k6 煙霧測試。
  - `K6_API_BASE_URL`：k6 指向的 API URL。
  - `PLAYWRIGHT_SKIP_TEST` 等自訂開關。

## 7. 資料庫遷移
```bash
pnpm --filter api prisma migrate deploy
# 或容器環境
docker exec <api-container> pnpm --filter api prisma migrate deploy
```

## 8. 健康檢查與監控
- 健康檢查：`/api/v1/health`。
- 推薦整合：Sentry（錯誤）、Grafana/Prometheus（指標）、ELK/OpenSearch（日誌）。

## 9. 更新流程
1. 建立功能分支並通過 CI。
2. 合併 main 後觸發部署工作流程。
3. 部署腳本：
   - 執行測試 (`pnpm test:api`, `pnpm test:driver`, `pnpm --filter web test:e2e`)。
   - `pnpm --filter api prisma migrate deploy`。
   - 滾動更新服務（Railway、Fly.io 或 K8s）。
4. 部署完成後監控指標並確認通知。

## 10. 後續待辦
- Terraform 模組尚未建立，可依最終平台補齊。
- 撰寫備援 / 備份策略（資料庫快照、檔案備份）。
- 針對 LINE 通知設定網域白名單與 webhook。

---
若導入 GitHub Actions，可於 `.github/workflows/deploy.yml` 中新增實際部署指令（Docker login、推送、平台 CLI 部署等），再搭配上方流程完成自動化。
