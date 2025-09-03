# Google Maps API 優化實施指南

## 快速開始

### 1. 資料庫初始化

首先執行監控系統的資料庫結構：

```bash
# 進入系統目錄
cd /path/to/誠憶鮮蔬線上系統

# 執行監控結構部署
psql -U your_username -d your_database -f google_maps_monitoring_schema.sql

# 如果需要，也可以單獨執行
psql -U your_username -d your_database -f geocoding_cache_schema.sql
```

### 2. 環境變數設定

在 `.env` 檔案中添加以下設定：

```env
# === Google Maps API 設定 ===
GOOGLE_MAPS_API_KEY=AIzaSyBRwW-NMUDGMXaDhvl3oYJs_OqjfXWTTNE
GOOGLE_MAPS_FRONTEND_KEY=your-restricted-frontend-key-here

# === 內部 API 安全設定 ===
INTERNAL_API_KEYS=secure-key-1,secure-key-2,secure-key-3

# === 郵件通知設定（可選）===
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@yourdomain.com

# === 系統控制設定 ===
GOOGLE_MAPS_EMERGENCY_DISABLED=false
NODE_ENV=production
```

### 3. 服務集成

更新 `src/server.js`，添加安全地圖服務：

```javascript
// 在現有的 require 語句後添加
const { router: secureGoogleMapsRoutes, setDatabasePool: setSecureMapsDatabasePool } = require('./routes/google_maps_secure_api');

// 在創建資料庫連線池後添加
if (pool) {
  // 現有的資料庫連線設定...
  setSecureMapsDatabasePool(pool);
}

// 在現有路由後添加
app.use('/api/secure-maps', secureGoogleMapsRoutes);
```

### 4. 前端代碼更新

更新需要使用地圖功能的前端頁面：

```html
<!-- 在 <head> 中添加 -->
<script src="/js/secure-google-maps.js"></script>

<!-- 在頁面腳本中 -->
<script>
// 初始化安全地圖客戶端
const secureClient = new SecureGoogleMapsClient({
  baseUrl: '/api/secure-maps',
  cacheEnabled: true
});

// 使用安全地理編碼
async function geocodeAddress(address) {
  try {
    const result = await secureClient.geocodeAddress(address);
    if (result.success) {
      console.log('地理編碼成功:', result);
      // 處理結果...
    } else {
      console.error('地理編碼失敗:', result.error);
    }
  } catch (error) {
    console.error('請求錯誤:', error);
  }
}
</script>
```

## 詳細配置

### API 限制設定

可以在 `src/routes/google_maps_secure_api.js` 中調整限制：

```javascript
// 地理編碼限制
const geocodingLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分鐘
  max: 100, // 每IP每15分鐘100次請求
});

// 成本控制設定
const dailyLimit = 15.00; // 每日$15 USD
const monthlyLimit = 180.00; // 每月$180 USD
```

### 快取參數調整

在 `src/services/EnhancedGoogleMapsService.js` 中調整快取設定：

```javascript
this.cacheConfig = {
  defaultTTL: 30,                    // 預設30天過期
  highUsageTTL: 90,                  // 高頻地址90天過期
  maxCacheSize: 100000,              // 最大10萬條快取
  cleanupInterval: 24 * 60 * 60 * 1000, // 24小時清理間隔
  preloadCommonAddresses: true,      // 預載常用地址
  batchSize: 50                      // 批次處理大小
};
```

## 測試驗證

### 1. 基本功能測試

```bash
# 測試地理編碼
curl -X POST http://localhost:3000/api/secure-maps/geocode \
  -H "Content-Type: application/json" \
  -H "X-API-Key: secure-key-1" \
  -d '{"address": "台北市信義區市府路1號"}'

# 測試批量地理編碼
curl -X POST http://localhost:3000/api/secure-maps/batch-geocode \
  -H "Content-Type: application/json" \
  -H "X-API-Key: secure-key-1" \
  -d '{
    "addresses": [
      "台北市中正區中山南路5號",
      "新北市板橋區中山路一段161號"
    ]
  }'
```

### 2. 監控功能測試

```bash
# 檢查系統健康狀態
curl http://localhost:3000/api/secure-maps/health

# 獲取使用統計
curl -H "X-API-Key: secure-key-1" \
  http://localhost:3000/api/secure-maps/usage-stats

# 獲取快取統計
curl -H "X-API-Key: secure-key-1" \
  http://localhost:3000/api/secure-maps/cache-stats
```

### 3. 成本報告測試

```bash
# 獲取30天成本報告
curl -H "X-API-Key: secure-key-1" \
  "http://localhost:3000/api/secure-maps/cost-report?start_date=2025-08-01&end_date=2025-08-31"
```

## 常見使用場景

### 場景1: 訂單地理編碼

```javascript
// 在處理新訂單時
async function processNewOrder(orderData) {
  try {
    // 使用安全地理編碼
    const geocodeResult = await secureClient.geocodeAddress(orderData.address);
    
    if (geocodeResult.success) {
      // 更新訂單座標
      await updateOrderCoordinates(orderData.id, {
        lat: geocodeResult.lat,
        lng: geocodeResult.lng,
        formatted_address: geocodeResult.formatted_address,
        accuracy_score: geocodeResult.accuracy_score
      });
    }
  } catch (error) {
    console.error('訂單地理編碼失敗:', error);
    // 使用備用邏輯或記錄錯誤
  }
}
```

### 場景2: 批量地址處理

```javascript
// 處理大量地址時
async function processBulkAddresses(addresses) {
  const batchSize = 25;
  const results = [];
  
  for (let i = 0; i < addresses.length; i += batchSize) {
    const batch = addresses.slice(i, i + batchSize);
    
    try {
      const batchResult = await secureClient.batchGeocodeAddresses(batch);
      if (batchResult.success) {
        results.push(...batchResult.results);
      }
    } catch (error) {
      console.error(`批次 ${Math.floor(i/batchSize) + 1} 處理失敗:`, error);
    }
    
    // 批次間延遲
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  return results;
}
```

### 場景3: 智慧地址輸入

```html
<div class="address-input-container">
  <input type="text" id="delivery-address" placeholder="請輸入送貨地址">
</div>

<script>
const addressInput = new SmartAddressInput(
  document.getElementById('delivery-address'),
  {
    useSecureApi: true,
    onSelect: function(place) {
      console.log('選擇的地點:', place);
      
      // 更新隱藏欄位
      document.getElementById('lat').value = place.lat;
      document.getElementById('lng').value = place.lng;
      document.getElementById('formatted_address').value = place.formatted_address;
      
      // 更新地圖顯示
      if (window.map) {
        window.map.setCenter(place.lat, place.lng);
        window.map.addMarker({ lat: place.lat, lng: place.lng });
      }
    }
  }
);
</script>
```

## 監控和維護

### 日常監控

創建監控腳本 `scripts/check_maps_health.js`:

```javascript
const axios = require('axios');

async function checkMapsHealth() {
  try {
    // 檢查服務健康狀態
    const healthResponse = await axios.get('http://localhost:3000/api/secure-maps/health');
    console.log('服務狀態:', healthResponse.data.status);
    
    // 檢查今日使用量
    const statsResponse = await axios.get('http://localhost:3000/api/secure-maps/usage-stats', {
      headers: { 'X-API-Key': process.env.INTERNAL_API_KEYS.split(',')[0] }
    });
    
    const todayStats = statsResponse.data.data.today;
    console.log('今日統計:', {
      totalCost: todayStats.totalCost,
      cacheHitRate: todayStats.cacheHitRate,
      totalOperations: todayStats.operations.length
    });
    
  } catch (error) {
    console.error('監控檢查失敗:', error.message);
  }
}

// 執行檢查
checkMapsHealth();
```

### 定期維護任務

創建 cron job 或定期任務：

```bash
# 每日 02:00 執行清理和統計更新
0 2 * * * cd /path/to/your/app && node scripts/daily_maintenance.js

# 每週日 03:00 執行深度清理
0 3 * * 0 cd /path/to/your/app && node scripts/weekly_maintenance.js
```

維護腳本 `scripts/daily_maintenance.js`:

```javascript
const { Pool } = require('pg');

async function dailyMaintenance() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  try {
    // 更新每日統計
    await pool.query('SELECT update_google_maps_daily_stats()');
    console.log('✅ 每日統計已更新');
    
    // 清理過期快取
    const cleanupResult = await pool.query('SELECT cleanup_expired_geocoding_cache()');
    const deletedCount = cleanupResult.rows[0]?.cleanup_expired_geocoding_cache || 0;
    console.log(`🧹 清理了 ${deletedCount} 個過期快取項目`);
    
    // 檢查成本預警
    const alertsResult = await pool.query('SELECT * FROM check_google_maps_cost_alerts()');
    if (alertsResult.rows.length > 0) {
      console.log('⚠️ 發現成本預警:', alertsResult.rows);
    }
    
  } catch (error) {
    console.error('每日維護失敗:', error);
  } finally {
    await pool.end();
  }
}

dailyMaintenance();
```

## 故障排除

### 常見問題

#### 1. API Key 錯誤

**症狀**: 請求返回 401 或 403 錯誤

**解決方案**:
```bash
# 檢查環境變數
echo $GOOGLE_MAPS_API_KEY

# 測試 API Key
curl "https://maps.googleapis.com/maps/api/geocode/json?address=台北&key=$GOOGLE_MAPS_API_KEY"

# 檢查 Google Cloud Console 中的 API 限制設定
```

#### 2. 快取效能問題

**症狀**: 快取命中率低，回應時間長

**解決方案**:
```sql
-- 檢查快取統計
SELECT * FROM geocoding_cache_stats;

-- 檢查最常用地址
SELECT address, hit_count, last_used_at 
FROM geocoding_cache 
ORDER BY hit_count DESC 
LIMIT 20;

-- 手動清理無效快取
DELETE FROM geocoding_cache WHERE hit_count = 0 AND created_at < NOW() - INTERVAL '7 days';
```

#### 3. 成本超標

**症狀**: 收到成本預警或 API 請求被拒絕

**解決方案**:
```javascript
// 緊急停用 API
const response = await axios.post('http://localhost:3000/api/secure-maps/admin/emergency-disable', {}, {
  headers: { 'X-API-Key': 'your-admin-key' }
});

// 檢查當前使用量
const stats = await axios.get('http://localhost:3000/api/secure-maps/usage-stats');
console.log('當前成本:', stats.data.data.today.totalCost);
```

#### 4. 資料庫連線問題

**症狀**: 快取功能無法正常工作

**解決方案**:
```bash
# 檢查資料庫連線
psql -d your_database -c "SELECT NOW();"

# 檢查表結構是否正確
psql -d your_database -c "\d geocoding_cache"
psql -d your_database -c "\d google_maps_usage_log"

# 重新執行結構更新
psql -d your_database -f google_maps_monitoring_schema.sql
```

## 效能優化建議

### 1. 快取策略優化

```javascript
// 根據使用模式調整 TTL
const addressPatterns = {
  business: 90,    // 商業地址90天
  residential: 60, // 住宅地址60天
  temporary: 7     // 臨時地址7天
};

function calculateOptimalTTL(address, usageHistory) {
  // 根據地址類型和使用頻率動態調整
  const baseScore = getAddressTypeScore(address);
  const usageScore = calculateUsageScore(usageHistory);
  return Math.min(baseScore + usageScore, 180); // 最大180天
}
```

### 2. 批次處理優化

```javascript
// 智慧批次大小調整
function calculateOptimalBatchSize(totalAddresses, systemLoad) {
  if (systemLoad > 0.8) return 10; // 高負載時減少批次大小
  if (totalAddresses < 50) return Math.ceil(totalAddresses / 2);
  return totalAddresses > 200 ? 25 : 20;
}
```

### 3. 預測式快取

```javascript
// 基於歷史數據預測熱門地址
async function predictPopularAddresses() {
  const predictions = await pool.query(`
    SELECT 
      address,
      COUNT(*) as frequency,
      EXTRACT(hour FROM created_at) as hour_pattern
    FROM google_maps_usage_log 
    WHERE created_at >= NOW() - INTERVAL '30 days'
    GROUP BY address, EXTRACT(hour FROM created_at)
    HAVING COUNT(*) >= 3
    ORDER BY frequency DESC
  `);
  
  // 在預期高峰時段前預載這些地址
  return predictions.rows;
}
```

## 安全性檢查清單

- [ ] API Key 已從前端代碼移除
- [ ] 環境變數安全設定完成
- [ ] 內部 API Key 已配置
- [ ] 請求頻率限制已啟用
- [ ] IP 白名單機制已設定（如需要）
- [ ] 郵件通知功能已測試
- [ ] 緊急停用功能已驗證
- [ ] 日誌記錄功能正常
- [ ] 成本預警機制已啟用
- [ ] 資料庫權限最小化配置

## 上線檢查清單

- [ ] 資料庫結構已部署
- [ ] 環境變數已設定
- [ ] 服務代碼已集成
- [ ] 前端代碼已更新
- [ ] 基本功能測試通過
- [ ] 監控功能測試通過
- [ ] 成本控制測試通過
- [ ] 錯誤處理測試通過
- [ ] 效能基準測試完成
- [ ] 備份和恢復計劃已制定
- [ ] 監控和警報已設定
- [ ] 文檔已更新
- [ ] 團隊培訓已完成

---

完成以上步驟後，您的 Google Maps API 優化系統將成功運行。如有任何問題，請參考故障排除章節或查看詳細的技術報告。