# 部署前檢查清單

## 1. 程式與測試
- [ ] `pnpm test:api`
- [ ] `pnpm test:driver`
- [ ] `pnpm --dir apps/web test:e2e`
- [ ] （可選）`k6 run tests/k6/orders-smoke.js`
- [ ] 確認 Prisma schema 已版本控管並完成 peer review。

## 2. Secrets / Config
- [ ] GitHub Secrets：`DATABASE_URL`、`RAILWAY_TOKEN`（或其他平台金鑰）。
- [ ] Environment Variables：`K6_ENABLED`、`K6_API_BASE_URL` 是否設定符合需求。
- [ ] `.env` / 託管設定完成（SESSION/JWT/LINE 等密鑰）。
- [ ] S3 或檔案儲存配置完成（若採用外部儲存）。

## 3. 資料庫與備援
- [ ] 目標環境 PostgreSQL/Redis 已建置並通過連線測試。
- [ ] 建立自動備份排程與手動回復演練。
- [ ] 影像處理依賴（libvips）／ uploads 目錄權限確認。

## 4. 監控與告警
- [ ] Sentry / Error Tracking 啟用。
- [ ] 指標監控（Grafana/Prometheus 或平台內建）啟用。
- [ ] 日誌集中化管道（ELK、Cloud Logging 等）設定完成。
- [ ] 告警通知（Slack/Email/SMS）串接。

## 5. 部署流程
- [ ] GitHub Actions `ci-deploy.yml` 佔位部署指令已替換為實際 CLI 或 API。
- [ ] Terraform modules 完成並通過 `terraform fmt/validate/plan`。
- [ ] READY → STAGING → PRODUCTION 流程確認，包含手動覆核步驟。
- [ ] Prisma migrate deploy 指令測試（可在 staging 環境演練）。

## 6. 運維 SOP
- [ ] 訂單異常、通知失敗的回報與補救流程。
- [ ] 緊急回滾策略（資料庫備份＋部署回滾）。
- [ ] LINE 通知 webhook、網域白名單與重試策略。
- [ ] 版本標記與部署紀錄（Git tag / Release notes）。

完成以上項目後，方可進入正式部署階段並持續監控。若出現任何阻塞，請回到 `docs/ops-roadmap.md` 重新評估優先順序。
