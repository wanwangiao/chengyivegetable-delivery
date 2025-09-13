# 🧹 服務模組確定清理方案

根據您的明確指示：

## ✅ **確定保留的服務** (12個)

### 系統核心 (4個)
1. `BasicSettingsService.js` - 系統基本設定
2. `PriceChangeNotificationService.js` - 價格變動通知 ⭐
3. `LineNotificationService.js` - LINE通知 ⭐
4. `LineBotService.js` - LINE Bot整合

### LINE相關 (2個)
5. `LineUserService.js` - LINE用戶管理
6. `OrderNotificationHook.js` - 訂單通知鉤子

### 外送員路線功能 (4個) 
7. `GoogleMapsService.js` - Google地圖基本服務
8. `RouteOptimizationService.js` - 路線優化 ⭐ (外送員先路線優化再導航)
9. `SmartRouteService.js` - 智能路線規劃
10. `DriverLocationService.js` - 外送員位置追蹤

### 訂單相關 (2個)
11. `OrderNotificationService.js` - 訂單通知
12. `DeliveryEstimationService.js` - 配送時間估算

---

## ❌ **確定刪除的服務** (11個)

### Mapbox相關 (您明確不要)
- `mapboxService.js` ❌

### 監控服務 (您明確不要)  
- `GoogleMapsMonitoringService.js` ❌

### 聊天室功能 (您從不需要)
- `WebSocketManager.js` ❌
- `RoomManager.js` ❌
- `SSENotificationService.js` ❌

### 重複的Google地圖服務
- `EnhancedGoogleMapsService.js` ❌ (與基本版重複)
- `GoogleMapsProxyService.js` ❌ (不必要的代理)

### 重複的地理服務
- `GeoClustering.js` ❌ (與地理聚類服務重複)
- `GeographicClusteringService.js` ❌

### 過於複雜的優化
- `TSPOptimizer.js` ❌ (旅行銷售員算法，太複雜)
- `MessageRouter.js` ❌ (您不需要複雜訊息路由)

---

## 📊 **清理結果**

**原有**: 23個服務模組
**保留**: 12個核心服務  
**刪除**: 11個不需要的服務
**減少**: 約48%的服務複雜度

---

## 🎯 **保留的服務功能完整涵蓋**

✅ **價格通知系統** - 核心商業功能
✅ **LINE整合** - 客戶通知渠道
✅ **外送員路線優化** - 先優化再導航
✅ **基本地圖功能** - Google Maps導航
✅ **訂單通知** - 系統通知機制

## ❌ **刪除的都是不需要的功能**

❌ **Mapbox** - 您明確不需要
❌ **監控服務** - 您明確不需要  
❌ **聊天室** - 您從未需要
❌ **重複服務** - 功能重疊
❌ **過度複雜** - 超出實際需求

---

**這樣的清理方案是否符合您的需求？**