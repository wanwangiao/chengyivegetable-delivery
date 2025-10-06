# 測試指南

## 覆蓋範圍
- **API 單元測試**：使用 Vitest 覆蓋授權、訂單、商品、使用者、外送員等服務層。
- **靜態分析**：ESLint 尚未完成 Next.js 預設設定，需在 `apps/web`、`apps/driver` 分別補齊後才能啟用。
- **其他層級**：尚未導入整合測試與 E2E 測試，建議在正式上線前補足。

## 指令速查
```bash
# API 測試（非互動，適用 CI）
pnpm test:api

# 監看模式
pnpm --filter api test:watch

# Web E2E 測試（需先 build Next.js）
pnpm --filter web build
pnpm --dir apps/web test:e2e

# Driver 測試
pnpm test:driver

# 指定 API 單一測試檔案
pnpm --filter api test -- tests/order.service.test.ts --runInBand
```

## 推薦後續工作
- **API**：補齊控制器層與錯誤處理測試，可利用 Supertest 模擬 REST 互動。
- **前端 / 後台**：導入 Playwright 或 Cypress 覆蓋購物流程、後台操作與訂單追蹤。
- **Driver App**：使用 React Native Testing Library 擴充更多畫面與流程測試（目前已加入基本 smoke 版）。
- **效能**：`tests/k6/orders-smoke.js` 提供煙霧測試，可延伸為長時間壓力測試或設定多階段負載。

## k6 壓力測試
- 腳本位置：`tests/k6/orders-smoke.js`
- 快速執行：
  ```bash
  API_BASE_URL=http://localhost:3000/api/v1 k6 run tests/k6/orders-smoke.js
  ```
- 可透過環境變數調整參數：
  ```bash
  K6_VUS=50 K6_DURATION=5m API_BASE_URL=https://api.example.com/api/v1 \
  k6 run tests/k6/orders-smoke.js
  ```

## 小技巧
- 本地測試 Playwright 時，可於外部先執行 `pnpm --filter web build && pnpm --dir apps/web test:e2e`；
  若已有既存伺服器，可設定 `E2E_SKIP_SERVER=true` 讓 Playwright 只連既有服務。
- Driver 測試預設以 mock `fetch` 方式運行，如需串接真實 API，移除 `vitest.setup.ts` 中的 mock 即可。
- 若 `pnpm --filter …` 啟動過久，可使用 `pnpm --dir <path>` 直接在子專案執行指令。
