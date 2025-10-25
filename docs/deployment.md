# 部署與運維指南

> 完整的 Railway 部署流程與系統維護指南
>
> **最後更新**: 2025-10-23

## 📋 目錄

- [生產環境概覽](#生產環境概覽)
- [Railway 部署](#railway-部署)
- [環境變數配置](#環境變數配置)
- [資料庫管理](#資料庫管理)
- [Cloudinary 圖片管理](#cloudinary-圖片管理)
- [部署流程](#部署流程)
- [故障排除](#故障排除)

---

## 🌐 生產環境概覽

### 服務架構

| 服務 | 平台 | URL | 用途 |
|------|------|-----|------|
| **API** | Railway | https://chengyivegetable-api-production.up.railway.app | REST API + LINE Bot |
| **Web** | Railway | https://chengyivegetable-production-7b4a.up.railway.app | 客戶商城 + 管理後台 |
| **Driver** | Railway | https://chengyivegetable-driver-production.up.railway.app | 外送員 App (PWA) |
| **Database** | Railway (Managed) | 內部連線 | PostgreSQL 16 |
| **Images** | Cloudinary | Cloud Service | 商品圖片存儲 |

---

## 🚂 Railway 部署

### 1. 建置流程

Railway 使用 `src/server.js` 作為統一入口點，透過 `RAILWAY_BUILD_TARGET` 決定啟動哪個服務。

**關鍵文件**:
- `src/server.js` - Railway 啟動腳本  
- `nixpacks.toml` - Nixpacks 建置配置
- `package.json` - pnpm workspace 配置

**server.js 工作流程**:
1. 檢查 node_modules 是否存在
2. 如不存在，執行 `pnpm install --frozen-lockfile`
3. 根據 `RAILWAY_BUILD_TARGET` 建置共享套件 (config, domain, lib)
4. 執行 `prisma generate` (API only)
5. 啟動對應服務

### 2. 服務配置

#### API 服務

**Environment Variables**:
\`\`\`bash
RAILWAY_BUILD_TARGET=api
NODE_ENV=production
DATABASE_URL=postgresql://...
SESSION_SECRET=<32-char-secret>
JWT_SECRET=<32-char-secret>
LINE_CHANNEL_ID=<line-channel-id>
LINE_CHANNEL_SECRET=<line-secret>
LINE_CHANNEL_ACCESS_TOKEN=<line-token>
CLOUDINARY_CLOUD_NAME=<cloud-name>
CLOUDINARY_API_KEY=<api-key>
CLOUDINARY_API_SECRET=<api-secret>
\`\`\`

**Start Command**: `pnpm run start`

#### Web 服務

**Environment Variables**:
\`\`\`bash
RAILWAY_BUILD_TARGET=web
NODE_ENV=production
NEXT_PUBLIC_API_URL=https://chengyivegetable-api-production.up.railway.app
DATABASE_URL=postgresql://...
SESSION_SECRET=<32-char-secret>
JWT_SECRET=<32-char-secret>
\`\`\`

#### Driver 服務

**Environment Variables**:
\`\`\`bash
RAILWAY_BUILD_TARGET=driver
NODE_ENV=production
EXPO_PUBLIC_API_BASE=https://chengyivegetable-api-production.up.railway.app
PORT=3000
\`\`\`

---

## ⚙️ 環境變數配置

### 核心環境變數

| 變數名稱 | 必要性 | 說明 | 範例 |
|---------|--------|------|------|
| `RAILWAY_BUILD_TARGET` | ✅ | 指定要建置的服務 | `api`, `web`, `driver` |
| `NODE_ENV` | ✅ | 執行環境 | `production` |
| `DATABASE_URL` | ✅ | PostgreSQL 連線字串 | `postgresql://user:pass@host:5432/db` |
| `SESSION_SECRET` | ✅ | Session 加密金鑰 | 至少 32 字元隨機字串 |
| `JWT_SECRET` | ✅ | JWT 簽署金鑰 | 至少 32 字元隨機字串 |

### 生成安全密鑰

\`\`\`bash
# 生成 32 字元隨機密鑰
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 或使用 openssl
openssl rand -hex 32
\`\`\`

---

## 🗄️ 資料庫管理

### Prisma 遷移

#### 開發環境

\`\`\`bash
# 創建新遷移
pnpm --filter api prisma migrate dev --name <migration-name>

# 生成 Prisma Client
pnpm --filter api prisma generate

# 重置資料庫 (慎用！)
pnpm --filter api prisma migrate reset
\`\`\`

#### 生產環境

\`\`\`bash
# 部署遷移到生產環境
DATABASE_URL="..." pnpm --filter api prisma migrate deploy

# 查看遷移狀態
DATABASE_URL="..." pnpm --filter api prisma migrate status
\`\`\`

### Prisma Studio

\`\`\`bash
# 開啟資料庫視覺化介面
DATABASE_URL="..." pnpm --filter api prisma studio
\`\`\`

---

## 🖼️ Cloudinary 圖片管理

### 帳號資訊

- **Cloud Name**: `dpxsgwvmf`
- **Dashboard**: https://cloudinary.com/console

### 圖片配置

目前使用的圖片設定:

\`\`\`javascript
{
  folder: 'chengyi-vegetables/products',
  transformation: [
    { width: 1200, height: 1200, crop: 'limit' },  // 不裁切，保持比例
    { quality: 'auto:best' },                      // 最佳品質
    { fetch_format: 'auto' }                       // 自動 WebP
  ]
}
\`\`\`

**特點**:
- ✅ 最大解析度: 1200x1200px
- ✅ 保持原始比例 (不強制裁切為正方形)
- ✅ 自動轉換為 WebP (節省頻寬)
- ✅ 最佳品質壓縮

### 圖片遷移腳本

**位置**: `migrate-images-to-cloudinary.ts`

\`\`\`bash
# 執行圖片遷移
DATABASE_URL="..." \
CLOUDINARY_CLOUD_NAME="..." \
CLOUDINARY_API_KEY="..." \
CLOUDINARY_API_SECRET="..." \
npx tsx migrate-images-to-cloudinary.ts
\`\`\`

---

## 🚀 部署流程

### 完整部署步驟

#### 1. 本地測試

\`\`\`bash
# 1. 確保所有測試通過
pnpm test

# 2. 類型檢查
pnpm type-check

# 3. Lint 檢查
pnpm lint

# 4. 本地建置測試
pnpm build
\`\`\`

#### 2. 資料庫遷移 (如有變更)

\`\`\`bash
# 創建遷移
pnpm --filter api prisma migrate dev --name <migration-name>

# 部署到生產環境
DATABASE_URL="<production-url>" pnpm --filter api prisma migrate deploy
\`\`\`

#### 3. 提交代碼

\`\`\`bash
# 提交變更
git add .
git commit -m "feat: <description>"

# 推送到 GitHub
git push origin main
\`\`\`

#### 4. Railway 自動部署

Railway 會自動:
1. 檢測到 Git Push
2. 觸發建置流程
3. 安裝依賴
4. 建置應用
5. 重啟服務

#### 5. 驗證部署

\`\`\`bash
# 檢查 API 健康狀態
curl https://chengyivegetable-api-production.up.railway.app/api/v1/health

# 預期回應
{
  "status": "ok",
  "timestamp": "2025-10-23T...",
  "service": "api"
}
\`\`\`

---

## 🔧 故障排除

### 常見問題

#### 1. 部署失敗: "Cannot find package 'cloudinary'"

**原因**: Railway 跳過了 build 階段，dependencies 未安裝

**解決方案**: `src/server.js` 已加入自動檢查機制，會在啟動時自動安裝缺失的依賴

#### 2. 資料庫連線失敗

**檢查項目**:
- ✅ `DATABASE_URL` 環境變數是否正確
- ✅ Railway PostgreSQL 服務是否正常運行
- ✅ 網路連線是否正常

**測試連線**:
\`\`\`bash
DATABASE_URL="..." pnpm --filter api prisma db execute --stdin <<< "SELECT 1"
\`\`\`

#### 3. LINE Webhook 無回應

**檢查項目**:
- ✅ LINE Channel 設定的 Webhook URL 是否正確
- ✅ LINE_CHANNEL_* 環境變數是否設定
- ✅ API 服務是否正常運行

**測試 Webhook**:
\`\`\`bash
curl -X POST https://chengyivegetable-api-production.up.railway.app/api/v1/line/webhook \
  -H "Content-Type: application/json" \
  -H "x-line-signature: test" \
  -d '{"events": []}'
\`\`\`

#### 4. 圖片無法顯示

**檢查項目**:
- ✅ Cloudinary 環境變數是否正確
- ✅ 圖片 URL 是否有效
- ✅ CORS 設定是否正確

#### 5. 502 Bad Gateway

**可能原因**:
- 應用啟動超時
- 記憶體不足 (OOM)
- Port 配置錯誤

**解決方案**:
1. 檢查 Railway Logs
2. 增加服務記憶體配額
3. 確認 `PORT` 環境變數設定

---

## 📊 監控與維護

### 健康檢查

**API Health Check**:
\`\`\`bash
curl https://chengyivegetable-api-production.up.railway.app/api/v1/health
\`\`\`

### 定期維護

#### 每週

- [ ] 檢查 Railway Logs 是否有異常
- [ ] 檢查 API 回應時間
- [ ] 檢查資料庫連線數

#### 每月

- [ ] 檢查 Cloudinary 使用量
- [ ] 資料庫備份
- [ ] 更新依賴套件

#### 每季

- [ ] 檢查安全性更新
- [ ] 效能優化
- [ ] 資料庫維護 (VACUUM, ANALYZE)

---

## ✅ 部署檢查清單

### 首次部署

- [ ] 設定所有必要環境變數
- [ ] 執行資料庫遷移
- [ ] 設定 LINE Webhook URL
- [ ] 測試 API 端點
- [ ] 測試 Web 應用
- [ ] 測試圖片上傳
- [ ] 建立管理員帳號
- [ ] 匯入商品資料

### 日常部署

- [ ] 本地測試通過
- [ ] 代碼審查完成
- [ ] 執行資料庫遷移 (如需要)
- [ ] 推送代碼到 GitHub
- [ ] 驗證 Railway 部署狀態
- [ ] 檢查 Health Check
- [ ] 監控應用 Logs

---

**文檔版本**: 1.0.0  
**最後更新**: 2025-10-23
