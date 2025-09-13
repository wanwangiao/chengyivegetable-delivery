# 🎨 訂單狀態顏色整合方案

## 📋 **正確的訂單狀態與顏色對應**

### 🟡 **待確認** (pending)
- **顏色**: `#faad14` (黃色)
- **用途**: 客戶下單後，等待每日7:30價格確認
- **說明**: 黃色表示等待處理狀態

### 🔵 **準備中** (preparing)  
- **顏色**: `#1890ff` (藍色)
- **用途**: 價格確認完成，開始備貨
- **說明**: 藍色表示正在處理中

### 🟢 **包裝完成** (packed)
- **顏色**: `#52c41a` (綠色)
- **用途**: 包裝員完成包裝，等待外送員接單
- **說明**: 綠色表示準備就緒

### 🟠 **配送中** (delivering)
- **顏色**: `#fa8c16` (橘色) 
- **用途**: 外送員已接單，正在配送
- **說明**: 橘色表示運送中

### ✅ **已完成** (delivered)
- **顏色**: `#237804` (深綠色)
- **用途**: 外送員完成配送
- **說明**: 深綠色表示成功完成

### ❌ **已取消** (cancelled)
- **顏色**: `#f5222d` (紅色)
- **用途**: 客戶取消或其他原因取消
- **說明**: 紅色表示取消狀態

---

## 🔧 **需要修改的代碼**

### 1. 後台地圖 (`views/admin_map.ejs`)

**當前錯誤的狀態定義**:
```javascript
const statusColors = {
  placed: '#888888',           // ❌ 錯誤狀態
  quoted: '#2f54eb',          // ❌ 錯誤狀態  
  paid: '#52c41a',            // ❌ 錯誤狀態
  out_for_delivery: '#fa8c16', // ❌ 錯誤狀態
  delivered: '#237804',        // ✅ 這個是對的
  canceled: '#f5222d'          // ❌ 拼寫錯誤 (應該是cancelled)
};
```

**應該修改為**:
```javascript
const statusColors = {
  pending: '#faad14',      // 待確認 - 黃色
  preparing: '#1890ff',    // 準備中 - 藍色
  packed: '#52c41a',       // 包裝完成 - 綠色
  delivering: '#fa8c16',   // 配送中 - 橘色
  delivered: '#237804',    // 已完成 - 深綠色
  cancelled: '#f5222d'     // 已取消 - 紅色
};
```

**對應的狀態名稱**:
```javascript
const statusNames = {
  pending: '待確認',
  preparing: '準備中',
  packed: '包裝完成', 
  delivering: '配送中',
  delivered: '已完成',
  cancelled: '已取消'
};
```

### 2. 後台訂單管理 (`views/admin_orders.ejs`)

**狀態篩選選項**:
```html
<select id="statusFilter">
  <option value="">所有狀態</option>
  <option value="pending">待確認</option>
  <option value="preparing">準備中</option>
  <option value="packed">包裝完成</option>
  <option value="delivering">配送中</option>
  <option value="delivered">已完成</option>
  <option value="cancelled">已取消</option>
</select>
```

### 3. 地圖圖例更新

```html
<div class="legend">
  <h4>訂單狀態圖例</h4>
  <div class="legend-item">
    <div class="legend-color" style="background: #faad14;"></div>
    <span>待確認</span>
  </div>
  <div class="legend-item">
    <div class="legend-color" style="background: #1890ff;"></div>
    <span>準備中</span>
  </div>
  <div class="legend-item">
    <div class="legend-color" style="background: #52c41a;"></div>
    <span>包裝完成</span>
  </div>
  <div class="legend-item">
    <div class="legend-color" style="background: #fa8c16;"></div>
    <span>配送中</span>
  </div>
  <div class="legend-item">
    <div class="legend-color" style="background: #237804;"></div>
    <span>已完成</span>
  </div>
  <div class="legend-item">
    <div class="legend-color" style="background: #f5222d;"></div>
    <span>已取消</span>
  </div>
</div>
```

---

## 🎯 **顏色選擇邏輯**

- **黃色** (待確認) - 警告色，提醒需要處理
- **藍色** (準備中) - 冷靜色，表示穩定處理中
- **綠色** (包裝完成) - 成功色，表示就緒狀態
- **橘色** (配送中) - 活躍色，表示移動中
- **深綠** (已完成) - 成功完成色
- **紅色** (已取消) - 錯誤/停止色

**您確認這個顏色整合方案嗎？我立即修改相關文件。**