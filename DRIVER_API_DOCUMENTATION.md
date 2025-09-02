# 外送員系統API擴展文件

## 概述

本文件說明外送員系統新增的照片上傳、問題回報、離線暫存功能。

### 新增功能
- 📷 配送照片上傳（自動壓縮至 800x600）
- 🚨 問題回報系統（自動通知管理員）
- 📱 自動發送照片到客戶 LINE
- 💾 離線暫存和重傳機制
- 🔄 批次處理離線任務

---

## 環境需求

### 新增依賴套件
```bash
npm install sharp --save
```

### 環境變數設定
```env
# LINE Bot 設定（現有）
LINE_CHANNEL_ACCESS_TOKEN=your_channel_access_token
LINE_CHANNEL_SECRET=your_channel_secret

# 新增：管理員 LINE ID（用於接收問題回報）
ADMIN_LINE_ID=your_admin_line_user_id
LINE_ADMIN_USER_ID=your_admin_line_user_id

# 網站基礎 URL（用於生成照片連結）
BASE_URL=https://yourdomain.com
```

---

## 資料庫建置

### 執行資料庫建立腳本
```bash
# 連接到 PostgreSQL
psql -U your_username -d your_database -f driver_extensions_schema.sql
```

此腳本會建立以下資料表：
- `delivery_photos` - 配送照片記錄
- `delivery_problems` - 問題回報記錄  
- `offline_queue` - 離線任務佇列
- `driver_sessions` - 外送員會話管理

---

## API 端點

### 1. 照片上傳 API

**端點**: `POST /api/driver/upload-delivery-photo`

**用途**: 上傳配送照片並自動發送給客戶

**請求格式**:
```http
POST /api/driver/upload-delivery-photo
Content-Type: multipart/form-data

orderId: 123
photoType: delivery
description: 已送達客戶手中
photos: [file1.jpg, file2.jpg, ...]
```

**參數說明**:
- `orderId` (必填): 訂單ID
- `photoType` (選填): 照片類型
  - `delivery` - 配送完成照片（預設）
  - `before_delivery` - 配送前照片
  - `packaging` - 商品包裝照片
- `description` (選填): 照片描述
- `photos` (必填): 照片檔案陣列（最多5張，每張最大10MB）

**成功回應**:
```json
{
  "success": true,
  "message": "成功上傳 2 張照片",
  "photos": [
    {
      "id": 123,
      "filename": "compressed_driver_1_order_456_1693737600000_a1b2c3d4.jpg",
      "url": "https://yourdomain.com/uploads/delivery_photos/compressed/compressed_driver_1_order_456_1693737600000_a1b2c3d4.jpg",
      "size": 85432,
      "originalSize": 234567,
      "type": "delivery",
      "uploadedAt": "2025-09-02T14:30:00.000Z"
    }
  ],
  "lineSent": true,
  "orderId": 456
}
```

**錯誤回應**:
```json
{
  "success": false,
  "message": "請提供訂單ID",
  "error": "Missing required parameter"
}
```

---

### 2. 問題回報 API

**端點**: `POST /api/driver/report-problem`

**用途**: 回報配送問題並通知管理員

**請求格式**:
```json
{
  "orderId": 123,
  "problemType": "customer_not_home",
  "description": "客戶不在家，已聯繫無回應",
  "priority": "medium",
  "attachedPhotos": [1, 2, 3],
  "location": {
    "lat": 24.9375,
    "lng": 121.3697
  }
}
```

**參數說明**:
- `orderId` (必填): 訂單ID
- `problemType` (必填): 問題類型
  - `customer_not_home` - 客戶不在家
  - `address_not_found` - 地址找不到
  - `payment_issue` - 付款問題
  - `damaged_goods` - 商品損壞
  - `other` - 其他問題
- `description` (選填): 詳細描述
- `priority` (選填): 優先級 (low/medium/high/urgent，預設: medium)
- `attachedPhotos` (選填): 相關照片ID陣列
- `location` (選填): GPS座標

**成功回應**:
```json
{
  "success": true,
  "message": "問題回報已送出，管理員將盡快處理",
  "problem": {
    "id": 789,
    "orderId": 123,
    "problemType": "customer_not_home",
    "description": "客戶不在家，已聯繫無回應",
    "priority": "medium",
    "status": "reported",
    "reportedAt": "2025-09-02T14:30:00.000Z"
  },
  "adminNotified": true,
  "orderStatusChanged": true
}
```

---

### 3. 離線佇列處理 API

**端點**: `POST /api/driver/process-offline-queue`

**用途**: 處理離線暫存的任務（照片上傳、問題回報等）

**請求格式**:
```json
{}
```

**成功回應**:
```json
{
  "success": true,
  "message": "處理完成 3 個離線任務",
  "processed": 3,
  "demo": false
}
```

---

### 4. 獲取訂單照片 API

**端點**: `GET /api/driver/order-photos/:orderId`

**用途**: 查看指定訂單的所有照片

**成功回應**:
```json
{
  "success": true,
  "photos": [
    {
      "id": 123,
      "filename": "compressed_photo.jpg",
      "url": "https://yourdomain.com/uploads/delivery_photos/compressed/compressed_photo.jpg",
      "type": "delivery",
      "size": 85432,
      "uploadedAt": "2025-09-02T14:30:00.000Z",
      "lineSentAt": "2025-09-02T14:30:05.000Z",
      "status": "line_sent",
      "metadata": {
        "description": "配送完成照片",
        "originalSize": 234567
      }
    }
  ],
  "count": 1
}
```

---

## 使用流程

### 1. 基本配送照片流程
```javascript
// 1. 拍攝照片並上傳
const formData = new FormData();
formData.append('orderId', '123');
formData.append('photoType', 'delivery');
formData.append('description', '已送達客戶手中');
formData.append('photos', photoFile);

const response = await fetch('/api/driver/upload-delivery-photo', {
  method: 'POST',
  body: formData
});

// 2. 照片會自動：
//    - 壓縮至 800x600
//    - 儲存到伺服器
//    - 發送到客戶 LINE
//    - 記錄到資料庫
```

### 2. 問題回報流程
```javascript
// 1. 回報問題
const problemData = {
  orderId: 123,
  problemType: 'customer_not_home',
  description: '客戶不在家，門鈴無回應',
  priority: 'medium'
};

const response = await fetch('/api/driver/report-problem', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(problemData)
});

// 2. 系統會自動：
//    - 更新訂單狀態為 'problem_reported'
//    - 發送通知到管理員 LINE
//    - 記錄問題詳情到資料庫
```

### 3. 離線模式處理
```javascript
// 當網路恢復時，自動處理離線任務
const response = await fetch('/api/driver/process-offline-queue', {
  method: 'POST'
});

// 系統會自動重試所有失敗的任務
```

---

## 錯誤處理

### 常見錯誤情況
1. **網路連接問題**: 自動加入離線佇列
2. **檔案過大**: 自動壓縮處理
3. **LINE發送失敗**: 不影響照片上傳成功
4. **訂單不存在**: 回傳404錯誤

### 離線模式
- 所有失敗的操作會自動加入離線佇列
- 支援最多3次重試
- 重試間隔遞增（5分鐘 × 重試次數）

---

## 測試方式

### 1. 照片上傳測試
```bash
# 使用 curl 測試照片上傳
curl -X POST http://localhost:3000/api/driver/upload-delivery-photo \
  -F "orderId=123" \
  -F "photoType=delivery" \
  -F "description=測試照片" \
  -F "photos=@test_photo.jpg"
```

### 2. 問題回報測試
```bash
# 使用 curl 測試問題回報
curl -X POST http://localhost:3000/api/driver/report-problem \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": 123,
    "problemType": "customer_not_home",
    "description": "測試問題回報",
    "priority": "medium"
  }'
```

### 3. 查看訂單照片
```bash
curl -X GET http://localhost:3000/api/driver/order-photos/123
```

---

## 安全性考量

### 檔案安全
- 只允許上傳圖片檔案（JPG, PNG）
- 檔案大小限制 10MB
- 自動生成安全的檔案名稱
- 照片自動壓縮避免空間浪費

### API 安全
- 需要外送員登入認證
- 支援 CORS 設定
- 輸入參數驗證
- SQL injection 防護

### 隱私保護
- 照片僅限相關人員存取
- 問題回報包含敏感資訊保護
- 離線佇列資料加密存儲

---

## 效能優化

### 照片處理
- 使用 Sharp 進行高效能圖片壓縮
- 分別儲存原圖和壓縮圖
- 壓縮參數：最大 800x600，品質 80%

### 資料庫優化
- 建立適當索引提升查詢效能
- 定期清理過期的離線佇列資料
- 使用 JSONB 存儲元資料

### 離線機制
- 智能重試機制避免系統負載
- 批次處理離線任務提升效率
- 失敗任務自動標記避免無限重試

---

## 監控和日誌

### 系統日誌
- 照片上傳成功/失敗記錄
- LINE 發送狀態追蹤
- 問題回報完整記錄
- 離線任務處理狀態

### 效能監控
- 照片處理時間統計
- API 回應時間監控
- 離線佇列處理效率
- 系統資源使用狀況

---

## 故障排除

### 常見問題

1. **Sharp 套件安裝失敗**
   ```bash
   npm install --platform=win32 --arch=x64 sharp
   ```

2. **照片上傳失敗**
   - 檢查上傳目錄權限
   - 確認磁碟空間充足
   - 驗證檔案格式正確

3. **LINE 發送失敗**
   - 檢查環境變數設定
   - 確認 LINE Channel 設定正確
   - 驗證客戶 LINE ID 綁定

4. **離線佇列處理異常**
   - 檢查資料庫連線狀態
   - 確認離線任務資料完整性
   - 重啟服務清理異常狀態

---

*文件版本: 1.0*  
*最後更新: 2025-09-02*