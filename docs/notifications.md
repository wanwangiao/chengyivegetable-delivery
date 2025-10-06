# 通知服務說明

## 架構總覽
- 事件來源：訂單相關 Domain Service 透過 `@chengyi/lib` 的 `eventBus` 發佈事件。
- 監聽註冊：`apps/api/src/application/subscribers/order-events.ts` 在應用啟動時呼叫 `NotificationService.register`。
- 通知執行：`NotificationService` 會讀取 `LineUserRepository` 與 `DriverRepository`，再透過 `LineNotifier` 觸發 LINE Messaging API。

## 支援事件
| 事件 | 觸發時機 | 行為 |
| --- | --- | --- |
| `order.created` | 新訂單建立成功 | 找出綁定電話的 LINE 使用者並推播建立通知 |
| `order.status-changed` | 訂單狀態更新 | 推播狀態變更與備註，並於日誌記錄外送員指派情況 |

## LINE 設定需求
- 需於 `.env` 設定 `LINE_CHANNEL_ACCESS_TOKEN`（其餘 ID / SECRET 視後續擴充而定）。
- 若未設定金鑰：系統將記錄 WARN 紀錄並略過實際呼叫，確保本機開發不受影響。
- `LineNotifier` 會自動截斷超過 2000 字的訊息，避免觸發 LINE 長度限制。

## LineUser 綁定
- `LineUser` 資料表儲存 `lineUserId` 與電話，`NotificationService` 會以訂單聯絡電話作為對應。
- 若尚未綁定 LINE，通知會被跳過並在 logger 中以 DEBUG 等級記錄。
- 後續可加入 LINE LIFF 綁定流程或匯入既有會員資料。

## 擴充方向
- **多渠道通知**：可在 `NotificationService` 中額外注入 Email / Web Push / SMS 實作。
- **可靠投遞**：若要支援重試，可將事件改為寫入 Redis Stream 或 Message Queue 再處理。
- **訂閱管理**：延伸 `LineUserRepository`，加入訂閱偏好設定與退訂機制。
- **監控與告警**：將通知結果寫入資料庫或導入 APM（如 Grafana Loki）追蹤配送效率。

---
如需進一步整合 LINE Bot（例如查詢訂單、主動推播），可在 API 層新增 webhook 與權限驗證機制。
