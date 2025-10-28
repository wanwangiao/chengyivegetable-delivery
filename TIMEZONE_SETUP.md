# 時區設定指南

## 問題說明

Railway 預設使用 **UTC 時區**，但我們的系統需要使用 **台灣時區（Asia/Taipei，UTC+8）**。

如果不設定時區，會導致：
- 營業時段判斷錯誤（差 8 小時）
- 訂單配送日期計算錯誤
- 特殊休假日判斷錯誤

## 解決方案

我們採用**雙重保險**的方式：

### 1. 程式碼層級（已完成✅）

- 使用 `date-fns-tz` 函式庫處理時區轉換
- 所有時間相關的判斷都使用台灣時區
- 即使系統時區錯誤，程式也能正確運作

### 2. 系統層級（需手動設定）

在 Railway 設定環境變數 `TZ=Asia/Taipei`，讓整個系統使用台灣時區。

---

## Railway 環境變數設定步驟

### 方法 A：透過 Railway Dashboard（推薦）

1. 前往 Railway Dashboard：https://railway.app
2. 登入您的帳號
3. 選擇專案：`chengyivegetable`
4. 針對 **API 服務** 和 **Web 服務** 分別設定：

#### API 服務設定
1. 點選 **API** 服務
2. 進入 **Variables** 標籤
3. 點擊 **+ New Variable**
4. 新增環境變數：
   - Variable Name: `TZ`
   - Value: `Asia/Taipei`
5. 點擊 **Add** 儲存
6. 服務會自動重新部署

#### Web 服務設定
1. 點選 **Web** 服務
2. 進入 **Variables** 標籤
3. 點擊 **+ New Variable**
4. 新增環境變數：
   - Variable Name: `TZ`
   - Value: `Asia/Taipei`
5. 點擊 **Add** 儲存
6. 服務會自動重新部署

### 方法 B：透過 Railway CLI

如果您有安裝 Railway CLI，可以使用指令設定：

```bash
# 設定 API 服務
railway link chengyivegetable --service api
railway variables set TZ=Asia/Taipei

# 設定 Web 服務
railway link chengyivegetable --service web
railway variables set TZ=Asia/Taipei
```

---

## 驗證設定

### 1. 檢查環境變數是否生效

部署完成後，在 Railway Logs 中應該可以看到：

```
TZ=Asia/Taipei
```

### 2. 測試營業時段判斷

1. 前往前台：https://chengyivegetable-production-7b4a.up.railway.app/
2. 檢查「營業狀態」區塊顯示的時段是否正確
3. 在不同時段測試（例如：早上 9:00、下午 3:00、晚上 11:00）

### 3. 測試 API 回應

```bash
curl https://chengyivegetable-api-production.up.railway.app/api/v1/business-hours/status
```

應該返回當前正確的營業狀態。

---

## 時區對照表

| 台灣時間 | UTC 時間 | 預期狀態 |
|---------|---------|---------|
| 07:30 | 23:30 (前一天) | 當日訂單開放 |
| 10:00 | 02:00 | 備貨準備中 |
| 14:00 | 06:00 | 隔日預訂開放 |
| 23:59 | 15:59 | 隔日預訂開放 |
| 00:00 | 16:00 (前一天) | 凌晨準備中 |

---

## 常見問題

### Q1: 如果只設定程式碼層級，不設定環境變數會怎樣？
**A:** 程式仍然可以正常運作，因為我們在程式碼中已經處理了時區轉換。但建議兩者都設定，確保萬無一失。

### Q2: 設定後需要重新部署嗎？
**A:** Railway 會在設定環境變數後自動重新部署服務，無需手動觸發。

### Q3: 如何確認時區設定是否生效？
**A:**
1. 查看 Railway Logs 確認環境變數
2. 測試前台營業狀態顯示
3. 在不同時段測試 API 回應

### Q4: 其他服務（如 Driver）也需要設定嗎？
**A:** 如果 Driver 服務也有時間相關的判斷邏輯，建議也設定 `TZ=Asia/Taipei`。

---

## 技術細節

### 使用的時區函式庫
- `date-fns-tz`: 處理時區轉換的工具庫

### 時區轉換函式（apps/api/src/utils/timezone.ts）
- `getTaiwanTime(date)`: 取得台灣時間
- `getTaiwanTimeInMinutes(date)`: 取得台灣時間的分鐘數
- `getTaiwanDayOfWeek(date)`: 取得台灣時間的星期幾

### 已更新的服務
- ✅ BusinessHoursService
- ✅ SystemConfigService
- ✅ OrderService（透過 SystemConfigService）

---

## 相關文件
- [Railway 環境變數文件](https://docs.railway.app/guides/variables)
- [date-fns-tz 文件](https://date-fns.org/docs/Time-Zones)
- [時區列表](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones)
