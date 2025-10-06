# 開發環境設定

## 1. 系統需求
- Node.js 18 LTS（建議使用 `corepack enable` 啟用預設 pnpm）
- pnpm 9.x
- PostgreSQL 16（預設資料庫名稱 `chengyi`）
- Redis 7（用於即時與排程需求，可視情況關閉）
- Git、OpenSSL（用於產生 JWT / Session secret）

## 2. 準備專案
```bash
git clone <repo-url> chengyivegetable
cd chengyivegetable
corepack enable
pnpm install
```

> Windows 使用者若使用 PowerShell，建議以系統管理員身分執行 `Set-ExecutionPolicy RemoteSigned` 確保 Husky 可以運作。

## 3. 設定環境變數
1. 複製 `.env.example` 為 `.env`。
2. 調整以下重點：
   - `DATABASE_URL`：指向本機或雲端 PostgreSQL。
   - `REDIS_URL`：若暫無 Redis，可留空；通知服務會自動降階。
   - `SESSION_SECRET`、`JWT_SECRET`：請使用至少 32 字元亂數。
   - `LINE_CHANNEL_*`：需呼叫 LINE API 時再填入。
   - `FILE_STORAGE_PATH`：若要自訂上傳路徑，可設定絕對路徑。

## 4. 初始化資料庫
```bash
# 建立 schema 與產生 Prisma Client
pnpm --filter api prisma migrate dev

# 匯入預設帳號與種子資料
pnpm --filter api prisma:seed
```

預設帳號：
- 管理員：`admin@chengyi.tw` / `Admin123456`
- 外送員：`driver@chengyi.tw` / `Driver123456`

## 5. 啟動服務
```bash
# 同步啟動 API / Web / Driver watcher
pnpm dev

# 或分別啟動
pnpm --filter api dev
pnpm --filter web dev
pnpm --filter driver dev
```

前台預設網址：http://localhost:3001  
API 基底網址：http://localhost:3000/api/v1  
Driver Expo Web 預覽：http://localhost:8081（依 Expo 設定而定）

## 6. Docker Compose（選用）
```bash
docker compose -f infra/docker-compose.yml up --build
```
啟動後將自動架設 PostgreSQL / Redis 並連結至 API、Web 服務。

## 7. 常見問題
- **`pnpm --filter api test` 卡住**：已改為使用 `vitest run`，若仍等待過久，可加上 `--runInBand` 或 `--reporter verbose` 觀察輸出。
- **`next lint` 啟動互動式設定**：專案目前尚未接入 Next ESLint 預設檔，若需執行請先新增專用的 `eslint.config.js`。
- **上傳目錄不存在**：`FILE_STORAGE_PATH` 未設定時預設為 `<repo>/uploads`，請確認有權限寫入。

---
完成以上步驟後即可進入架構與測試文件了解更深入的開發流程。
