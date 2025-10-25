# 誠憶鮮蔬線上系統 (Cheng Yi Vegetable Platform)

> 完整的蔬菜電商平台，包含客戶商城、管理後台、外送員 App、LINE Bot 整合

[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-14-black)](https://nextjs.org/)
[![Prisma](https://img.shields.io/badge/Prisma-5.22-darkgreen)](https://www.prisma.io/)
[![pnpm](https://img.shields.io/badge/pnpm-9.9-yellow)](https://pnpm.io/)

**目錄**: [系統概覽](#-系統概覽) | [技術架構](#-技術架構) | [快速開始](#-快速開始) | [部署資訊](#-部署資訊) | [相關文檔](#-相關文檔)

---

## 📋 系統概覽

### 功能模組

| 模組 | 說明 | 技術棧 | 部署位置 |
|------|------|--------|----------|
| **客戶商城** | 線上下單、商品瀏覽、訂單追蹤 | Next.js 14, React 18 | Railway (Web) |
| **管理後台** | 商品管理、訂單管理、外送員管理 | Next.js 14 (Admin Pages) | Railway (Web) |
| **外送員 App** | 接單、配送、拍照、狀態更新 | Expo + React Native Web | Railway (Driver) |
| **REST API** | 統一後端 API、資料存取層 | Express + Prisma | Railway (API) |
| **LINE Bot** | 訂單通知、客戶互動 | LINE Messaging API | Railway (API) |
| **資料庫** | PostgreSQL 交易資料庫 | PostgreSQL 16 | Railway (Managed) |
| **圖片存儲** | 商品圖片雲端存儲 | Cloudinary | Cloud Service |

### 系統特色

✅ **Monorepo 架構** - 使用 pnpm workspaces 管理多個應用
✅ **TypeScript 全棧** - 前後端皆使用 TypeScript 確保類型安全
✅ **DDD 分層設計** - Domain-Driven Design 清晰的業務邏輯分層
✅ **事件驅動通知** - 使用 EventBus 解耦通知服務
✅ **LINE 深度整合** - 訂單狀態即時通知到 LINE
✅ **高解析度圖片** - Cloudinary 自動優化，支援 WebP 格式
✅ **程式碼品質保護** - Git Hooks + ESLint + Prettier + Commitlint

---

## 🏗️ 技術架構

### 專案結構

```
chengyivegetable/
├── apps/
│   ├── api/                 # Express REST API (主要後端)
│   │   ├── src/
│   │   │   ├── application/    # 應用層 (Controllers, Routes, Subscribers)
│   │   │   ├── domain/         # 領域層 (Business Logic, Services)
│   │   │   ├── infrastructure/ # 基礎設施層 (Prisma, LINE, Storage)
│   │   │   └── config/         # 配置文件
│   │   └── prisma/             # Prisma Schema & Migrations
│   │
│   ├── web/                 # Next.js 前端 (客戶商城 + 管理後台)
│   │   ├── src/
│   │   │   ├── app/            # Next.js 13+ App Router
│   │   │   ├── components/     # React 組件
│   │   │   └── lib/            # 工具函數
│   │   └── public/             # 靜態資源
│   │
│   └── driver/              # Expo 外送員 App
│       ├── src/
│       │   ├── app/            # Expo Router
│       │   ├── components/     # React Native 組件
│       │   └── services/       # API 服務
│       └── assets/             # App 資源
│
├── packages/
│   ├── config/              # 環境變數管理 (Zod 驗證)
│   ├── domain/              # 共享領域模型 (訂單狀態、事件定義)
│   └── lib/                 # 共享工具庫 (Logger, EventBus)
│
├── docs/                    # 詳細技術文檔
│   ├── DEPLOYMENT.md        # 部署與運維指南
│   ├── DEVELOPMENT.md       # 開發指南
│   └── TESTING_HISTORY.md   # 測試報告歸檔
│
├── archive/                 # 歷史文檔歸檔
│
└── src/
    └── server.js            # Railway 部署入口點
```

### 技術堆疊

#### 後端 (API)
- **框架**: Express.js
- **ORM**: Prisma (PostgreSQL)
- **驗證**: Zod
- **認證**: JWT + Session
- **通知**: LINE Messaging API
- **存儲**: Cloudinary (圖片)
- **日誌**: Pino

#### 前端 (Web)
- **框架**: Next.js 14 (App Router)
- **UI**: React 18 + Bootstrap + Material-UI
- **狀態管理**: SWR (Data Fetching)
- **表單**: React Hook Form + Zod
- **樣式**: CSS Modules + Legacy CSS

#### 外送員 App (Driver)
- **框架**: Expo (React Native)
- **路由**: Expo Router
- **API**: Fetch + JWT
- **部署**: Expo Web (PWA)

#### 共享工具
- **類型檢查**: TypeScript 5.6
- **程式碼檢查**: ESLint 9
- **格式化**: Prettier 3
- **Commit 規範**: Commitlint + Husky
- **包管理**: pnpm 9.9

---

## 🚀 快速開始

### 1. 環境準備

```bash
# 安裝 Node.js 20+
node --version  # v20.x.x

# 安裝 pnpm
npm install -g pnpm@9.9.0

# 確認 pnpm 版本
pnpm --version  # 9.9.0
```

### 2. 克隆專案

```bash
git clone <repository-url>
cd chengyivegetable
```

### 3. 安裝依賴

```bash
# 安裝所有 workspace 依賴
pnpm install
```

### 4. 設定環境變數

```bash
# 複製範例環境變數檔案
cp .env.example .env

# 編輯 .env 填入必要變數
# DATABASE_URL=postgresql://...
# SESSION_SECRET=...
# JWT_SECRET=...
# LINE_CHANNEL_ID=...
# CLOUDINARY_CLOUD_NAME=...
```

**必要環境變數**:
- `DATABASE_URL` - PostgreSQL 連線字串
- `SESSION_SECRET` - Session 加密金鑰 (至少 32 字元)
- `JWT_SECRET` - JWT 簽署金鑰 (至少 32 字元)
- `LINE_CHANNEL_ID` - LINE Bot Channel ID
- `LINE_CHANNEL_SECRET` - LINE Bot Channel Secret
- `LINE_CHANNEL_ACCESS_TOKEN` - LINE Bot Access Token
- `CLOUDINARY_CLOUD_NAME` - Cloudinary 雲端名稱
- `CLOUDINARY_API_KEY` - Cloudinary API Key
- `CLOUDINARY_API_SECRET` - Cloudinary API Secret

### 5. 初始化資料庫

```bash
# 執行 Prisma 遷移
pnpm --filter api prisma migrate dev

# 生成 Prisma Client
pnpm --filter api prisma generate

# (可選) 導入測試資料
cd apps/api
DATABASE_URL="..." npx tsx ../../import-products.ts
```

### 6. 啟動開發環境

```bash
# 啟動所有服務 (API + Web + Driver)
pnpm dev

# 或分別啟動
pnpm --filter api dev          # API: http://localhost:3000
pnpm --filter web dev          # Web: http://localhost:3001
pnpm --filter driver dev       # Driver: http://localhost:8081
```

### 7. 建立管理員帳號

```bash
cd apps/api
DATABASE_URL="..." npx tsx create-admin.ts
```

---

## 🌐 部署資訊

### 生產環境 (Railway)

| 服務 | URL | 說明 |
|------|-----|------|
| **Web** | https://chengyivegetable-production.up.railway.app/ | 客戶商城 + 管理後台 |
| **API** | https://chengyivegetable-api-production.up.railway.app/ | REST API + LINE Bot |
| **Driver** | https://chengyivegetable-driver-production.up.railway.app/ | 外送員 App (PWA) |

### 重要 API 端點

- **Health Check**: `GET /api/v1/health`
- **LINE Webhook**: `POST /api/v1/line/webhook`
- **商品列表**: `GET /api/v1/products?onlyAvailable=true`
- **管理員登入**: `POST /api/v1/admin/login`
- **訂單建立**: `POST /api/v1/orders`

### Railway 環境變數配置

每個服務都需要設定 `RAILWAY_BUILD_TARGET`:

- **API 服務**: `RAILWAY_BUILD_TARGET=api`
- **Web 服務**: `RAILWAY_BUILD_TARGET=web`
- **Driver 服務**: `RAILWAY_BUILD_TARGET=driver`

詳細部署流程請參閱 [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md)

---

## 🛠️ 開發指令

### 程式碼品質

```bash
# 類型檢查
pnpm type-check              # 檢查所有專案
pnpm type-check:api          # 只檢查 API
pnpm type-check:web          # 只檢查 Web
pnpm type-check:driver       # 只檢查 Driver

# 代碼檢查與修復
pnpm lint                    # 檢查所有專案
pnpm lint:fix                # 自動修復問題

# 代碼格式化
pnpm format                  # 格式化所有文件
pnpm format:check            # 檢查格式但不修改
```

### 測試

```bash
# 執行測試
pnpm test                    # 所有測試
pnpm test:api                # API 測試
pnpm test:web                # Web 測試
pnpm test:driver             # Driver 測試
```

### 資料庫管理

```bash
# Prisma Studio (資料庫視覺化介面)
pnpm --filter api prisma studio

# 創建新遷移
pnpm --filter api prisma migrate dev --name <migration-name>

# 部署遷移到生產環境
pnpm --filter api prisma migrate deploy

# 重置資料庫 (開發用)
pnpm --filter api prisma migrate reset
```

---

## 📚 相關文檔

### 核心文檔

- **[docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md)** - 完整部署與運維指南
- **[docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md)** - 開發環境設定與工作流程
- **[docs/TESTING_HISTORY.md](./docs/TESTING_HISTORY.md)** - 測試報告與問題追蹤歷史

### 技術細節

- **[docs/architecture.md](./docs/architecture.md)** - 系統架構與設計原則
- **[docs/notifications.md](./docs/notifications.md)** - LINE 通知機制說明
- **[docs/delivery-routing.md](./docs/delivery-routing.md)** - 外送路線規劃

### API 文檔

- **Rate Limiting**: [apps/api/RATE_LIMITING.md](./apps/api/RATE_LIMITING.md)
- **Prisma Schema**: [apps/api/prisma/schema.prisma](./apps/api/prisma/schema.prisma)

---

## 🔒 安全性

- ✅ JWT 認證 + Session 管理
- ✅ 環境變數加密存儲
- ✅ Rate Limiting (防止 API 濫用)
- ✅ Zod 輸入驗證 (防止 SQL 注入)
- ✅ CORS 配置
- ✅ LINE Signature 驗證

---

## 📝 Git 工作流程

### Commit 規範

使用 Conventional Commits:

```bash
feat: 新增功能
fix: 修復錯誤
docs: 文檔更新
style: 代碼格式調整
refactor: 重構
test: 測試相關
chore: 雜項更新
```

### Pre-commit Hooks

專案已設定以下自動檢查:

- ✅ **ESLint** - 代碼品質檢查
- ✅ **Prettier** - 代碼格式化
- ✅ **Commitlint** - Commit 訊息規範檢查
- ✅ **TypeScript** - 類型檢查

---

## 👥 團隊協作

### 接手指南

1. **閱讀此 README** - 了解系統概覽
2. **設定開發環境** - 依照「快速開始」步驟
3. **閱讀 docs/DEVELOPMENT.md** - 了解開發流程與規範
4. **閱讀 docs/DEPLOYMENT.md** - 了解部署流程
5. **檢視 Prisma Schema** - 了解資料庫結構
6. **瀏覽 docs/architecture.md** - 了解系統架構設計

### 常見問題

**Q: 如何新增一個 API 端點?**
A: 參閱 [docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md) 的「新增 API 端點」章節

**Q: 如何修改資料庫結構?**
A: 修改 `apps/api/prisma/schema.prisma` 後執行 `pnpm --filter api prisma migrate dev`

**Q: 如何測試 LINE Bot?**
A: 參閱 [docs/notifications.md](./docs/notifications.md) 的「測試 LINE Bot」章節

**Q: 圖片如何上傳到 Cloudinary?**
A: 參閱 [docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md) 的「圖片上傳」章節

---

## 📊 系統監控

### Health Check

```bash
# API 健康檢查
curl https://chengyivegetable-api-production.up.railway.app/api/v1/health

# 預期回應
{
  "status": "ok",
  "timestamp": "2025-10-23T...",
  "service": "api",
  "version": "0.1.0"
}
```

### 日誌

- **Railway Logs**: Railway Dashboard → 選擇服務 → Logs
- **Pino 結構化日誌**: JSON 格式便於查詢
- **錯誤追蹤**: 可整合 Sentry (未來規劃)

---

## 🎯 未來規劃

- [ ] 整合 Sentry 錯誤追蹤
- [ ] 加入 Redis 快取層
- [ ] 實作訂單統計報表
- [ ] LINE LIFF 前端整合
- [ ] 外送員 App 原生版本 (iOS/Android)
- [ ] 自動化測試涵蓋率提升
- [ ] CI/CD Pipeline 完整化
- [ ] Docker Compose 本地開發環境

---

## 📞 聯絡資訊

- **專案負責人**: [填入資訊]
- **技術支援**: [填入資訊]
- **Repository**: [填入 GitHub URL]

---

## 📄 授權

Private - All Rights Reserved

---

**最後更新**: 2025-10-23
**文檔版本**: 1.0.0
