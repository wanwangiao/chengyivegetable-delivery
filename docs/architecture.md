# 系統架構概述

## 技術堆疊
- **API**：Express + Prisma + Zod，採用分層設計（controllers → routes → domain → infrastructure）。
- **前台 / 後台**：Next.js 13 App Router，整合 SWR、Bootstrap 與自訂 Legacy 樣式。
- **外送員 App**：Expo + React Native，透過 REST API 與 JWT 驗證溝通。
- **資料庫**：PostgreSQL 為主要交易資料庫，Prisma schema 說明所有實體。
- **即時與通知**：事件匯流排（`@chengyi/lib`）配合 LINE API 實作訂單通知。

## 模組分工
| 區塊 | 內容 | 特色 |
| --- | --- | --- |
| `apps/api` | REST API、管理員與外送員後台 API | 使用 Zod 驗證輸入，Prisma 操作資料庫，並發佈事件給共用匯流排 |
| `apps/web` | 客戶商城、後台管理介面 | 以 Server Components + 客戶端互動混合模式開發 |
| `apps/driver` | 外送員 PWA / App | 支援接單、完成配送、上傳照片、問題回報 |
| `packages/domain` | 訂單模型、狀態流轉、事件定義 | 保障狀態轉換合法性，集中共享邏輯 |
| `packages/lib` | Logger、EventBus | 封裝 Pino 與 Node 內建 EventEmitter |
| `packages/config` | 環境變數載入 | 使用 Zod 校驗，提供預設值與測試模式 |

## 請求流程
1. 前端（或 Driver App）透過 `NEXT_PUBLIC_API_BASE` / `EXPO_PUBLIC_API_BASE` 呼叫 REST API。
2. Express Controller 使用 Zod 驗證輸入後，委派 Domain Service 執行商業邏輯。
3. Domain Service 與 Prisma Repository 互動（CRUD、交易、統計）。
4. 成功後觸發事件（例如 `order.created`、`order.status-changed`）。
5. `NotificationService` 監聽事件，透過 `LineNotifier` 將訊息推播給綁定之 LINE 使用者，或記錄到 logger。

## 事件匯流排
- 建立於 `@chengyi/lib` 的 `EventBus`（基於 `EventEmitter`）。
- API 啟動時由 `apps/api/src/application/subscribers/order-events.ts` 註冊通知服務。
- 後續可延伸更多訂閱者（例如 Email、Web Push、Slack）。

## 資料模型重點
- **Order**：主檔與 `OrderStatusHistory` 記錄分離，支援狀態查詢與合法轉換。
- **Product**：提供選項（`ProductOption`），支援多單位與權重計價。
- **Driver**：透過 `DriverRepository` 產生統計、位置更新與接單流程。
- **LineUser**：儲存 LINE 綁定資訊，供通知服務查詢。

## 擴充建議
- 引入 CQRS / 事件儲存可改善報表需求。
- 以 Redis Stream 或 message queue 替代 in-process event bus 以支援多實例部署。
- 將 Next.js 前端逐步改寫成完全元件化，清除 `legacy` 樣式並引入 Design Token。

---
更多細節請參考 `setup.md` 與 `notifications.md`，了解各模組運作與部署評估。
