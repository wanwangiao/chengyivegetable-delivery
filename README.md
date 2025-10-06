# 誠憶鮮蔬智慧營運平台

Monorepo 架構整合 API、前台、後台與外送員 App，採用 TypeScript、Prisma、Zod
與事件驅動的通知模組，提供一致的營運體驗。

## 專案概覽
- **應用程式**：Express REST API、Next.js 13 App Router、Expo（React Native）外送員應用。
- **共用套件**：環境設定、網域模型、事件匯流排／記錄器均封裝於 `packages/`。
- **資料存取**：Prisma 操作 PostgreSQL，Redis 視需求提供快取與佇列能力。
- **測試**：以 Vitest 撰寫單元測試，可在 CI 或本機快速執行。

## 目錄結構
```
apps/
  api/      # Express + Prisma REST API
  web/      # Next.js 13 前台／後台網頁
  driver/   # Expo Router 外送員 App
packages/
  config/   # 環境變數 Schema 與載入工具
  domain/   # 共用 Domain 模型與事件
  lib/      # 事件匯流排、Pino Logger 等工具
infra/
  docker-compose.yml    # 本機一鍵啟動（API / Web / PostgreSQL / Redis）
  dockerfiles/          # API、Web 映像檔建置腳本
docs/                   # 架構、環境、測試等補充文件
```

## 角色與功能
- **客戶前台**：瀏覽商品、建立訂單、追蹤配送狀態。
- **後台管理**：商品／訂單／使用者／配送區域等維運介面。
- **外送員 App**：待接訂單、配送流程、狀態更新與問題回報。
- **系統服務**：事件匯流排、LINE 通知、司機統計、庫存與訂單服務等。

## 前置需求
- Node.js 18 LTS（`corepack enable` 後可使用 pnpm）
- pnpm 9.x
- PostgreSQL 16（預設使用資料庫：`chengyi`）
- Redis 7（非必要，但建議啟用以支援佇列 / 快取）
- LINE Messaging API channel（若需啟用通知）

## 快速開始
1. 複製環境設定：`cp .env.example .env`，依需求填入連線與密鑰。
2. 安裝依賴：`pnpm install`
3. 準備資料庫並種子：
   ```bash
   pnpm --filter api prisma migrate dev
   pnpm --filter api prisma:seed
   ```
4. 啟動所有應用（API / Web / Driver watcher）：`pnpm dev`
5. 也可使用 Docker Compose 一鍵啟動：`docker compose -f infra/docker-compose.yml up --build`

## 常用指令
- `pnpm --filter api dev`：僅啟動 API。
- `pnpm --filter web dev`：啟動 Next.js 前台 / 後台。
- `pnpm --filter driver dev`：啟動 Expo 外送員 App。
- `pnpm --filter api test`：執行 API 單元測試。
- `pnpm --filter api test:watch`：監看模式執行測試。
- `pnpm --filter api prisma:generate`：重新產生 Prisma Client。

## 測試
- API 透過 Vitest 覆蓋授權、訂單、商品、使用者與外送員服務。
- `pnpm --filter api test` 已改成非互動模式 (`vitest run`)，避免卡住流程。
- 建議補強：Web 端整合測試（Playwright）與 Driver App UI 測試。

## 主要環境變數
| 變數 | 說明 |
| --- | --- |
| `DATABASE_URL` | PostgreSQL 連線字串（包含資料庫名稱）。 |
| `REDIS_URL` | Redis 連線字串，未設定時部分功能（如通知排程）將停用。 |
| `SESSION_SECRET` | Express Session 加密金鑰，至少 32 字元。 |
| `JWT_SECRET` / `JWT_EXPIRES_IN` | JWT 簽章與存活時間。 |
| `LINE_CHANNEL_ID` / `LINE_CHANNEL_SECRET` / `LINE_CHANNEL_ACCESS_TOKEN` | 啟用 LINE Bot 通知所需金鑰。 |
| `FILE_STORAGE_PATH` | 上傳檔案儲存路徑，預設為專案根目錄的 `uploads/`。 |
| `EXPO_PUBLIC_API_BASE` | Driver App 存取 API 的 base URL。 |
| `EXPO_PUBLIC_DRIVER_EMAIL` / `EXPO_PUBLIC_DRIVER_PASSWORD` | Driver App 自動登入用帳號。

## 文件與資源
- `docs/setup.md`：本機開發與環境設定指南。
- `docs/architecture.md`：系統架構、資料流程與模組拆解。
- `docs/testing.md`：測試策略與指令清單。
- `docs/notifications.md`：事件匯流排與 LINE 通知流程。

## 後續工作（不含部署）
- 補齊 Web / Driver 端自動化測試與 E2E 流程。
- 擴充後台作業流程（例如配送區域調整、統計報表匯出）。
- 將通知服務延伸至 Email / Web Push，並加入失敗重試機制。
- 進一步清理前端 legacy 樣式與共用元件設計規範。

> 若需了解部署與 CI/CD，請先完成上述待辦後再行規劃，或以 `infra/` 與 `.github/workflows/` 為基礎延伸。
