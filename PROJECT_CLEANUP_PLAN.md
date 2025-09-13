# 📂 專案資料夾整理計劃

## 🚨 **目前問題**
- 根目錄有**136個**腳本和文檔文件
- 文件類型混雜，無法快速找到需要的文件
- 大量臨時性修復腳本散落各處
- 核心文件被淹沒在海量臨時文件中

## 🎯 **整理目標**
1. **根目錄只保留核心文件**
2. **按功能分類存放文件**
3. **清理過時和重複文件**
4. **建立清晰的文件索引**

## 📁 **建議的新目錄結構**

```
誠憶鮮蔬線上系統/
├── src/                          # 核心源碼 (保持現狀)
├── views/                        # 前端模板 (保持現狀)  
├── public/                       # 靜態文件 (保持現狀)
├── docs/                         # 現有文檔目錄
├── scripts/                      # 🆕 所有腳本文件
│   ├── database/                 # 資料庫相關腳本
│   │   ├── migrations/          # SQL遷移文件
│   │   ├── seeds/               # 資料填充腳本
│   │   └── repairs/             # 資料庫修復腳本
│   ├── testing/                  # 測試和驗證腳本
│   ├── deployment/               # 部署相關腳本
│   └── maintenance/              # 維護和清理腳本
├── temp/                         # 🆕 臨時文件和實驗性腳本
├── archive/                      # 已有，存放過時文件
├── package.json                  # 核心配置文件
├── .env                         # 環境變數
├── README.md                    # 主要說明文件
├── SYSTEM_OVERVIEW.md           # 系統概覽 (新建)
└── MODIFICATION_SAFETY_CHECKLIST.md  # 修改安全檢查 (新建)
```

## 🗂️ **文件分類整理**

### 📊 **資料庫文件** → `scripts/database/`
- 所有 `*.sql` 文件
- 資料庫修復腳本 (`fix_*_db.js`)
- 遷移腳本 (`*_migration.js`)

### 🔧 **測試腳本** → `scripts/testing/`
- `check_*.js` 檢查腳本
- `test_*.js` 測試腳本  
- `verify_*.js` 驗證腳本

### 🚀 **部署腳本** → `scripts/deployment/`
- Railway相關腳本
- 自動部署腳本
- 環境設置腳本

### 🧹 **維護腳本** → `scripts/maintenance/`
- 清理腳本
- 備份腳本
- 系統維護腳本

### 📄 **臨時文件** → `temp/`
- 今天新建的實驗性腳本
- 一次性使用的測試文件
- 待整理的文件

## ⚠️ **需要保留在根目錄的文件**
```
package.json
package-lock.json
.env
.gitignore
README.md
SYSTEM_OVERVIEW.md
MODIFICATION_SAFETY_CHECKLIST.md
MISSING_CRITICAL_FEATURES.md
```

## 🗑️ **可能需要刪除的文件**
- 重複的檢查腳本
- 過時的修復腳本  
- 實驗性的測試文件
- 已經整合到系統中的功能腳本

## 📋 **整理步驟**

### 第一步：創建新目錄結構
### 第二步：按分類移動文件
### 第三步：清理重複和過時文件
### 第四步：更新文件索引和說明
### 第五步：測試整理後的系統

---

**這樣整理後，專案會更易於維護和開發**