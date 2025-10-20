# 誠憶鮮蔬線上系統 - 測試文件

## 📚 測試套件概覽

本專案包含完整的端到端集成測試，用於驗證系統核心功能。

### 測試類型
- ✅ API 端點測試
- ✅ 業務流程測試 (E2E)
- ✅ 錯誤處理測試
- ✅ 權限控制測試

---

## 📂 文件結構

```
tests/
├── integration/
│   ├── package.json              # 測試套件配置
│   ├── test-utils.js             # 測試工具模組
│   ├── product-management.test.js # 商品管理測試
│   ├── order-management.test.js   # 訂單管理測試
│   ├── e2e-flow.test.js          # E2E 流程測試
│   └── run-all-tests.js          # 測試執行器
└── README.md                      # 本文件
```

---

## 🚀 快速開始

### 前置條件

1. **啟動 API 服務器**
   ```bash
   cd apps/api
   pnpm run dev
   ```

2. **確認 API 服務運行**
   ```bash
   curl http://localhost:3000/api/v1/health
   # 應返回: {"status":"ok","service":"api"}
   ```

### 執行測試

#### 方法 1: 執行所有測試
```bash
cd tests/integration
node run-all-tests.js
```

#### 方法 2: 執行單一測試套件
```bash
cd tests/integration

# 商品管理測試
node product-management.test.js

# 訂單管理測試
node order-management.test.js

# E2E 流程測試
node e2e-flow.test.js
```

#### 方法 3: 使用 npm scripts
```bash
cd tests/integration

# 執行所有測試
npm test

# 執行特定測試
npm run test:product
npm run test:order
npm run test:e2e
```

---

## 📋 測試內容

### 1. 商品管理測試 (product-management.test.js)

測試 16 個場景，包含：

#### 核心功能
- ✅ 新增固定價格商品
- ✅ 新增秤重計價商品
- ✅ 新增含選項的商品
- ✅ 更新商品資訊
- ✅ 商品上架/下架

#### 批次操作
- ⚠️ 批次更新商品
- ⚠️ 商品排序
- ⚠️ 同步隔日價格

#### 查詢功能
- ✅ 管理員查詢商品列表
- ✅ 客戶端查詢可用商品
- ✅ 依分類篩選
- ✅ 關鍵字搜尋

#### 錯誤處理
- ⚠️ 缺少必填欄位
- ⚠️ 固定價商品未提供價格
- ⚠️ 秤重商品未提供單位價格
- ⚠️ 未授權訪問

**執行時間**: ~15 秒
**通過率**: 50% (8/16)

---

### 2. 訂單管理測試 (order-management.test.js)

測試 17 個場景，包含：

#### 基本訂單操作
- 建立訂單
- 查詢訂單詳情
- 依電話搜尋訂單
- 查詢訂單歷史

#### 訂單狀態流程
- pending → preparing
- preparing → ready
- ready → delivering (司機接單)
- delivering → delivered

#### 庫存整合
- 訂單建立時扣減庫存
- 庫存不足時拒絕訂單

#### 驗證機制
- 價格驗證
- 運費計算驗證
- 總金額驗證
- 狀態轉換驗證

**狀態**: ⏳ 待執行

---

### 3. E2E 流程測試 (e2e-flow.test.js)

測試 6 個完整業務流程：

#### Flow 1: 商品上架流程
```
新增商品 → 設定選項 → 設定庫存 → 上架 → 驗證客戶可見
```

#### Flow 2: 客戶下單流程
```
瀏覽商品 → 選擇商品 → 計算金額 → 提交訂單 → 驗證庫存扣減
```

#### Flow 3: 訂單處理流程
```
管理員確認 → 備貨 → 司機接單 → 配送 → 送達 → 驗證歷史記錄
```

#### Flow 4: 庫存管理流程
```
檢查庫存 → 下單扣減 → 驗證更新 → 補充庫存 → 驗證補充
```

#### Flow 5: 多商品訂單流程
```
選擇多商品 → 計算總額 → 提交訂單 → 驗證所有庫存扣減
```

#### Flow 6: 訂單查詢流程
```
建立訂單 → 電話搜尋 → 查詢詳情 → 查詢歷史 → 驗證一致性
```

**狀態**: ⏳ 待執行

---

## 🔧 測試工具 (test-utils.js)

### 核心功能

#### HTTP 請求
```javascript
import { request } from './test-utils.js';

const response = await request('POST', '/orders', {
  headers: { Authorization: `Bearer ${token}` },
  body: { /* 資料 */ }
});
```

#### 登入
```javascript
import { login } from './test-utils.js';

const adminToken = await login('admin@chengyi.tw', 'Admin123456');
const driverToken = await login('driver@chengyi.tw', 'Driver123456');
```

#### 斷言
```javascript
import { Assert } from './test-utils.js';

Assert.assertEquals(actual, expected, 'Message');
Assert.assertTrue(value, 'Message');
Assert.assertNotNull(value, 'Message');
Assert.assertContains(array, item, 'Message');
```

#### 測試執行
```javascript
import { runTest } from './test-utils.js';

await runTest('Test name', async () => {
  // 測試邏輯
  Assert.assertEquals(result, expected);
});
```

---

## 📊 測試報告

測試執行後會生成以下報告：

### 主要報告
- **全功能測試報告**: `../../20251019_全功能測試報告.md`
  - 測試執行總覽
  - API 端點覆蓋情況
  - 業務流程測試結果
  - 性能分析
  - 上線準備度評估

### 問題清單
- **發現的問題清單**: `../../20251019_發現的問題清單.md`
  - Bug 詳細描述
  - 重現步驟
  - 修復建議
  - 優先級排序

---

## 🐛 已知問題

執行測試時可能遇到以下問題：

### 1. 連接失敗
**症狀**: `Request failed: fetch failed`

**解決方案**:
- 確認 API 服務器在 http://localhost:3000 運行
- 檢查防火牆設定
- 確認 `.env` 配置正確

### 2. 驗證錯誤
**症狀**: 測試預期錯誤但收到連接失敗

**原因**: API 錯誤處理機制需要改進（見 BUG-005）

**暫時解決**: 先執行其他測試，待 Bug 修復後再測試錯誤處理

### 3. Admin API 格式問題
**症狀**: "Products should be an array" 錯誤

**原因**: Admin Products List API 返回格式不一致（見 BUG-001）

**暫時解決**: 跳過相關測試，待 Bug 修復

---

## 🎯 測試數據

### 預設測試帳號

#### 管理員
- Email: `admin@chengyi.tw`
- Password: `Admin123456`
- 權限: 完整管理權限

#### 司機
- Email: `driver@chengyi.tw`
- Password: `Driver123456`
- 權限: 訂單配送管理

#### 客戶
- 不需要登入即可下單
- 使用電話號碼查詢訂單

### 測試商品
測試會自動建立以下類型的商品：
- 固定價格商品
- 秤重計價商品
- 含規格選項商品

測試結束後會自動清理（設為不可用）。

---

## 💡 最佳實踐

### 撰寫新測試

1. **遵循現有結構**
   ```javascript
   async function testNewFeature() {
     // Arrange
     const data = { /* 測試資料 */ };

     // Act
     const response = await request('POST', '/endpoint', { body: data });

     // Assert
     Assert.assertEquals(response.status, 201);
     Assert.assertNotNull(response.data.id);
   }
   ```

2. **測試名稱清晰**
   ```javascript
   await runTest('Create order with valid data', testCreateOrder);
   await runTest('Reject order with invalid price [FAIL]', testInvalidPrice);
   ```

3. **清理測試資料**
   ```javascript
   async function cleanup() {
     for (const id of createdIds) {
       await deleteOrDisable(id);
     }
   }
   ```

### 除錯技巧

1. **查看完整錯誤**
   ```javascript
   try {
     await testFunction();
   } catch (error) {
     console.error('Full error:', error);
     throw error;
   }
   ```

2. **增加日誌輸出**
   ```javascript
   console.log('Request body:', JSON.stringify(data, null, 2));
   console.log('Response:', JSON.stringify(response, null, 2));
   ```

3. **單獨執行失敗的測試**
   - 註解其他測試
   - 只執行特定測試函數

---

## 📈 效能基準

基於目前測試結果的平均響應時間：

| 操作 | 平均時間 | 評級 |
|------|----------|------|
| 商品建立 | 870ms | ⚠️ |
| 商品更新 | 1060ms | ⚠️ |
| 商品查詢 | 700ms | ⚠️ |
| 商品上下架 | 1676ms | ❌ |
| 價格同步 | 4313ms | ❌ |

評級標準：
- ✅ < 500ms (優秀)
- ⚠️ 500ms - 2000ms (可接受)
- ❌ > 2000ms (需優化)

---

## 🔄 持續改進

### 短期計劃
- [ ] 修復所有 High 等級 Bug
- [ ] 完成訂單管理測試執行
- [ ] 完成 E2E 流程測試執行
- [ ] 提升測試覆蓋率至 80%+

### 中期計劃
- [ ] 增加自動化回歸測試
- [ ] 建立 CI/CD 整合
- [ ] 增加性能測試套件
- [ ] 建立測試資料工廠

### 長期計劃
- [ ] 實作視覺回歸測試
- [ ] 增加壓力測試
- [ ] 建立測試報告儀表板
- [ ] 自動化測試數據分析

---

## 📞 支援與回饋

如有問題或建議，請聯絡：
- QA Team: qa@chengyi.tw
- 開發團隊: dev@chengyi.tw

或在專案中提交 Issue。

---

**文件版本**: v1.0
**最後更新**: 2025-10-19
