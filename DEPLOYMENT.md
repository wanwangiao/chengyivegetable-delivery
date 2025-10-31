# 部署資訊

## Production URLs

### 前台網站
- **URL**: https://chengyivegetable-production-7b4a.up.railway.app/
- **說明**: 客戶購物前台頁面
- **服務**: Web (Next.js)

### 管理後台
- **URL**: https://chengyivegetable-production-7b4a.up.railway.app/admin/login
- **說明**: 管理員登入與系統設定
- **預設帳號**: shnfred555283
- **服務**: Web (Next.js)

### API 服務
- **Base URL**: https://chengyivegetable-api-production.up.railway.app/api/v1
- **說明**: RESTful API 後端服務
- **認證方式**: Bearer Token (JWT)
- **服務**: API (Express + TypeScript)

### 司機配送端
- **URL**: https://chengyivegetable-driver-production.up.railway.app/
- **說明**: 司機配送管理介面
- **服務**: Driver (Vite SPA)

## Railway 部署架構

專案使用 monorepo 架構，透過 `RAILWAY_BUILD_TARGET` 環境變數區分服務：

- `RAILWAY_BUILD_TARGET=web` → Next.js 前台與管理後台
- `RAILWAY_BUILD_TARGET=api` → Express API 後端
- `RAILWAY_BUILD_TARGET=driver` → 司機端 SPA

## 資料庫

- **類型**: PostgreSQL
- **託管**: Railway Postgres
- **ORM**: Prisma

## 圖片儲存

- **服務**: Cloudinary
- **格式**: WebP（自動優化）
- **用途**: 商品圖片、品牌 LOGO

## 環境變數

### Web 服務
```
NEXT_PUBLIC_API_BASE=https://chengyivegetable-api-production.up.railway.app/api/v1
RAILWAY_BUILD_TARGET=web
PORT=3000
```

### API 服務
```
DATABASE_URL=postgresql://...
CLOUDINARY_CLOUD_NAME=dpxsgwvmf
CLOUDINARY_API_KEY=133176862642789
CLOUDINARY_API_SECRET=***
JWT_SECRET=***
RAILWAY_BUILD_TARGET=api
PORT=3000
TZ=Asia/Taipei
```

**重要**：`TZ=Asia/Taipei` 設定台灣時區，確保營業時段判斷正確。詳見 [TIMEZONE_SETUP.md](./TIMEZONE_SETUP.md)

## 部署流程

1. Push 到 GitHub main branch
2. Railway 自動觸發部署
3. 執行 `src/server.js` 統一入口
4. 根據 `RAILWAY_BUILD_TARGET` 決定啟動哪個服務
5. 共享套件（config, domain, lib）會先自動 build

## 最近部署記錄

- **2025-01-28**: 新增 LOGO 上傳裁切功能，移除前台 GET /admin/settings 認證要求
- **2025-01-27**: 修復 Web 服務 404 問題，啟用管理員帳號，整合 Cloudinary 圖片服務
