# 配送路線規劃說明

本文整理新導入的配送設定／路線規劃功能，以便後續部署與驗證。

## 基本設定
- **環境變數**：若要啟用自動地理編碼與 Google 距離矩陣，請在 `.env` 中新增 `GOOGLE_MAPS_API_KEY`。
- **取貨點維護**：透過後台 API `PUT /api/v1/admin/delivery/settings` 更新固定取貨點名稱、地址與座標。
- **預設批次參數**：同一設定接口可調整建議批次最小／最大訂單數量，系統會依此產生建議。

## 路線規劃 API
- `POST /api/v1/admin/delivery/plan-route`
  - 請以 `orderIds: string[]` 傳入待配送訂單 ID。
  - 系統會先確認取貨點是否已設定，再依照目前座標以「最近鄰」演算法排出送貨順序。
  - 若訂單尚未寫入座標且環境提供 Google Maps API Key，系統會自動執行地理編碼並儲存。
  - 回應包含各站點的順序、預估距離（公尺）、預估時間（秒）及整體統計。
- `GET /api/v1/admin/delivery/map-snapshot`
  - 用於後台地圖即時監控，回應含當前外送員位置、準備中／配送中訂單清單與推薦輪詢秒數。
  - 伺服器端內建 60 秒快取，可透過查詢參數 `force=true` 或 `ttlMs` 自訂。

## 異常與提示
- **PICKUP_LOCATION_NOT_CONFIGURED**：請確認已完成 `settings` API 設定且座標不為 0。
- **ORDER_COORDINATES_MISSING**：環境未配置 Google API Key，且訂單沒有既有座標；請手動補齊或設定金鑰。
- **GOOGLE_MAPS_API_KEY_NOT_CONFIGURED**：需要使用 Google 距離矩陣時會丟出，請補上金鑰或改用內建估算。

## 後續工作（提醒）
- 規畫外送員端批次領單與彈窗流程仍待實作；本次僅提供後台設定與路線規劃骨架。
- 若要減少外部 API 成本，可在未提供金鑰時改為人工輸入座標，系統仍會以哈弗辛距離估算路線。
