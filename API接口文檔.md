# 🔗 API接口文檔

**系統名稱**: 誠憶鮮蔬外送系統  
**API版本**: v2.0  
**最後更新**: 2025-09-10

---

## 🏠 前台客戶API

### 📱 商品相關
```javascript
GET  /                          // 首頁，商品展示
GET  /products                  // 商品列表API
GET  /products/:id              // 商品詳情
GET  /search                    // 商品搜尋
```

### 🛒 購物車相關
```javascript
POST /api/cart/add              // 添加商品到購物車
GET  /api/cart                  // 獲取購物車內容
PUT  /api/cart/update/:id       // 更新購物車商品
DELETE /api/cart/remove/:id     // 移除購物車商品
DELETE /api/cart/clear          // 清空購物車
```

### 📦 訂單相關
```javascript
POST /api/orders                // 創建訂單
GET  /api/orders/:id            // 訂單詳情
GET  /api/orders/track/:id      // 訂單追蹤
POST /api/orders/:id/cancel     // 取消訂單
```

### 👤 客戶相關
```javascript
GET  /api/customer/profile      // 客戶資料
PUT  /api/customer/profile      // 更新客戶資料
GET  /api/customer/orders       // 客戶訂單歷史
```

---

## 🏢 後台管理API

### 🔐 管理員登入
```javascript
GET  /admin                     // 管理員登入頁面
POST /admin/login               // 管理員登入驗證
POST /admin/logout              // 管理員登出
GET  /admin/dashboard           // 管理後台首頁
```

### 📦 訂單管理
```javascript
GET  /admin/orders              // 所有訂單列表
GET  /admin/orders/:id          // 訂單詳情管理
PUT  /admin/orders/:id/status   // 更新訂單狀態
GET  /admin/orders/stats        // 訂單統計數據
POST /admin/orders/search       // 訂單搜尋
```

### 🥕 商品管理
```javascript
GET  /admin/products            // 商品管理頁面
POST /admin/products            // 新增商品
PUT  /admin/products/:id        // 編輯商品
DELETE /admin/products/:id      // 刪除商品
POST /admin/products/upload     // 商品圖片上傳
```

### 📊 庫存管理
```javascript
GET  /admin/inventory           // 庫存管理頁面
PUT  /admin/inventory/:id       // 更新商品庫存
GET  /admin/inventory/alerts    // 低庫存警告
POST /admin/inventory/restock   // 補貨記錄
```

### 🗺️ 配送管理
```javascript
GET  /admin/delivery            // 配送管理頁面
GET  /admin/map                 // 配送地圖
POST /admin/route-optimization  // 路線優化
GET  /admin/drivers             // 外送員管理
PUT  /admin/drivers/:id/status  // 外送員狀態更新
```

### 📈 統計報表
```javascript
GET  /admin/reports             // 報表首頁
GET  /admin/reports/sales       // 銷售報表
GET  /admin/reports/inventory   // 庫存報表
GET  /admin/reports/customers   // 客戶分析
GET  /admin/reports/export      // 報表匯出
```

---

## 🚗 外送員系統API

### 👤 外送員登入
```javascript
GET  /driver                    // 外送員登入頁面
POST /driver/login              // 外送員登入
POST /driver/logout             // 外送員登出
GET  /driver/dashboard          // 外送員工作台
```

### 📱 訂單處理
```javascript
GET  /api/driver/orders/pending // 待接訂單列表
GET  /api/driver/orders/active  // 進行中訂單
POST /api/driver/orders/:id/accept // 接受訂單
POST /api/driver/orders/:id/pickup // 取貨確認
POST /api/driver/orders/:id/deliver // 送達確認
PUT  /api/driver/orders/:id/status  // 更新訂單狀態
```

### 📍 位置與導航
```javascript
POST /api/driver/location       // 更新位置
GET  /api/driver/navigation/:id // 獲取導航資訊
GET  /api/driver/route          // 最佳路線規劃
```

### 📊 績效統計
```javascript
GET  /api/driver/stats/today    // 今日績效
GET  /api/driver/stats/history  // 歷史記錄
GET  /api/driver/earnings       // 收入統計
```

---

## 🤖 LINE Bot API

### 📱 LINE整合
```javascript
POST /webhook/line              // LINE Webhook
GET  /api/line/profile/:userId  // 獲取LINE用戶資料
POST /api/line/notify           // 發送LINE通知
GET  /liff/binding              // LIFF綁定頁面
```

### 🔔 通知系統
```javascript
POST /api/notifications/order   // 訂單通知
POST /api/notifications/status  // 狀態更新通知
POST /api/notifications/promo   // 促銷訊息
```

---

## 🌐 即時通訊 WebSocket

### 📡 Socket.IO 事件
```javascript
// 客戶端事件
connection                      // 建立連接
order-status-update            // 訂單狀態更新
driver-location-update         // 外送員位置更新
new-order-notification         // 新訂單通知

// 伺服器事件  
join-room                      // 加入房間
leave-room                     // 離開房間
broadcast-update               // 廣播更新
```

---

## 🔧 系統工具API

### ⚡ 系統狀態
```javascript
GET  /health                    // 健康檢查
GET  /api/version               // 系統版本
GET  /api/status                // 系統狀態
```

### 🔍 測試接口
```javascript
GET  /test/database             // 資料庫連接測試
GET  /test/line                 // LINE Bot測試
GET  /test/maps                 // Google Maps測試
```

---

## 📝 API回應格式

### ✅ 成功回應
```json
{
  "success": true,
  "data": { /* 數據內容 */ },
  "message": "操作成功",
  "timestamp": "2025-09-10T15:30:00Z"
}
```

### ❌ 錯誤回應
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "錯誤描述",
    "details": { /* 詳細資訊 */ }
  },
  "timestamp": "2025-09-10T15:30:00Z"
}
```

---

## 🔐 認證說明

### 🎫 Session認證
- **管理員**: Express-session + cookie
- **外送員**: 手機號碼 + 密碼驗證

### 🔑 API金鑰
- **LINE Bot**: Bearer token認證
- **Google Maps**: API key參數

---

**📞 技術支援**: 如API異常，請檢查 `ENVIRONMENT_VARS.md` 和伺服器日誌