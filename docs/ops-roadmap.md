# 運維風險與待辦

## 立即優先事項
- **Secrets 管理**：統一使用 GitHub Secrets、Railway Variables 或 Vault；禁止 `.env` 直接上傳正式金鑰。
- **資料庫備份**：啟用每日快照與手動回復演練；紀錄 RPO/RTO 目標。
- **監控告警**：導入 Sentry（錯誤）、Grafana/Prometheus（指標）、集中式日誌（ELK/Cloud Logging），並設定通知管道。
- **部署腳本落地**：將 `ci-deploy.yml` 中佔位指令替換為實際 Railway / K8s CLI，並保存部署紀錄。
- **LINE 通知設定**：完成 webhook、網域白名單與失敗重試機制。

## 短期待辦（1~2 週）
- 填補 Terraform modules（API/Web/Database）實際內容，設定 remote backend。
- 實作 Prisma schema 版本控管流程與回滾腳本。
- 整合 Playwright 測試於 staging 環境、引入 mock API 以提高穩定性。
- 規劃檔案儲存備援（S3、版本化），並制定清理策略。
- 制定營運 SOP（客服、訂單異常處理、通知重送）。

## 中期規劃（3~6 週）
- 建立性能監測（k6 長時間壓力測試、APM 指標收集）。
- 引入藍綠部署或紅黑部署策略，減少停機風險。
- 強化安全性：安全掃描、依賴漏洞檢查、定期憑證更新流程。
- 擴充通知通道（Email/Web Push）與權限稽核紀錄。
- 建立 SLA/SLI/SLO 指標與報表工具。

## 長期考量
- 多區域備援與災難復原演練。
- 自動化成本監控與資源調整政策。
- 形成資料洞察與 BI 儀表板（銷售、配送效率等）。
- 導入權限分層（RBAC）、審計軌跡與合規流程。
