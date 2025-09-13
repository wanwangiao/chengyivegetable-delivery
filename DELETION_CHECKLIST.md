# 🗑️ 文件刪除確認清單

> **請您逐項確認每個文件是否可以刪除**

## 📋 **分類說明**
- ✅ **建議刪除** - SUB AGENT認為可安全刪除
- ⚠️ **需要確認** - 用途不明確，需要您確認
- 🔒 **絕對保留** - 核心文件，不可刪除

---

## 🔧 **重複測試腳本** (建議刪除 30個)

### ✅ 建議刪除的check_*系列腳本:
```
check_admin_orders_source.js          - 檢查後台訂單來源
check_all_possible_urls.js           - 檢查所有可能的URLs  
check_and_fix_orders.js              - 檢查並修復訂單
check_backend_orders.js               - 檢查後台訂單
check_bracket_structure.js           - 檢查括號結構
check_database_content.js            - 檢查資料庫內容
check_database_orders.js             - 檢查資料庫訂單
check_demo_mode_status.js            - 檢查demo模式狀態
check_migration_status.js            - 檢查遷移狀態
check_railway_database.js            - 檢查Railway資料庫
check_railway_orders.js              - 檢查Railway訂單
check_railway_status.js              - 檢查Railway狀態
```

**❓ 您確認這些check_*腳本都可以刪除嗎？**

### ✅ 建議刪除的test_*系列腳本:
```
test_complete_business_flow.js       - 測試完整業務流程
test_live_demomode.js                - 測試線上demo模式
test_database_connection.js          - 測試資料庫連接
correct_api_test.js                  - 正確的API測試
```

**❓ 您確認這些測試腳本都可以刪除嗎？**

---

## 🛠️ **修復和清理腳本** (建議刪除 25個)

### ✅ 建議刪除的fix_*系列腳本:
```
auto_fix_driver_db.js                - 自動修復外送員資料庫
comprehensive_backend_fix.js         - 綜合後端修復
fix_driver_orders_complete.js        - 修復外送員訂單完成
clean_test_orders.js                 - 清理測試訂單
cleanup_using_existing_api.js        - 使用現有API清理
complete_database_cleanup.js         - 完整資料庫清理
reset_database.js                    - 重置資料庫
force_check_demomode.js              - 強制檢查demo模式
debug_api_response.js                - 調試API回應
```

**❓ 您確認這些修復腳本都可以刪除嗎？**

---

## 📊 **重複SQL文件** (建議刪除 15個)

### ✅ 建議刪除的重複SQL:
```
add_new_products.sql                 - 添加新產品 (重複)
add_payment_method.sql               - 添加支付方式 (重複)
add_payment_method_column.sql        - 添加支付方式欄位 (重複)
add_potato_with_size_options.sql     - 添加馬鈴薯尺寸選項 (重複)
add_product_image_support.sql        - 添加產品圖片支援 (重複)
create_11_test_orders.sql            - 創建11個測試訂單 (測試用)
direct_database_cleanup.sql          - 直接資料庫清理 (重複)
```

**❓ 您確認這些SQL文件都可以刪除嗎？**

---

## 📝 **過時文檔** (建議刪除 10個)

### ✅ 建議刪除的文檔:
```
AUTO_DEPLOY_TEST.md                  - 自動部署測試
DRIVER_ORDER_ISSUE_COMPLETE_ANALYSIS.md - 外送員訂單問題分析
FINAL_SYSTEM_STATUS_REPORT.md       - 最終系統狀態報告  
RAILWAY_REPAIR_REPORT.md             - Railway修復報告
SYSTEM_TEST_REPORT_2025_09_13.md    - 系統測試報告
final_verification_guide.md         - 最終驗證指南
```

**❓ 您確認這些文檔都可以刪除嗎？**

---

## 🔒 **絕對保留的核心文件** (25個)

### 系統核心:
```
src/server.js                       - 主服務器 🔒
package.json                        - 專案配置 🔒
.env                                - 環境變數 🔒
.gitignore                          - Git忽略規則 🔒
```

### 當前使用的模板:
```
views/index_new_design.ejs          - 當前前台版本 🔒
views/admin_orders.ejs              - 後台訂單管理 🔒  
views/driver_dashboard_simplified.ejs - 外送員界面 🔒
```

### 重要SQL:
```
basic_settings_schema.sql           - 基本設定架構 🔒
price_history_schema.sql            - 價格歷史架構 🔒
```

---

## ⚠️ **需要您確認的文件** (10個)

```
每日進度記錄.md                      - ❓ 是否還需要？
API接口文檔.md                       - ❓ 是否還在使用？
SYSTEM_OVERVIEW.md                   - ❓ 我們剛建立的，要保留嗎？
MODIFICATION_SAFETY_CHECKLIST.md    - ❓ 我們剛建立的，要保留嗎？
```

---

## 📊 **刪除統計**

- **建議刪除**: 80個文件
- **絕對保留**: 25個文件  
- **需要確認**: 10個文件
- **整理後總數**: 約35-45個文件

**❓ 請您確認：**
1. 上述建議刪除的文件是否都可以刪除？
2. 有哪些文件您認為應該保留？
3. 需要確認的文件您希望如何處理？