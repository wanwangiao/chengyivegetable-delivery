# 🍅 誠憶鮮蔬線上系統

## 📁 專案結構

```
誠憶鮮蔬線上系統/
├── 📂 src/                    # 🚀 後端核心代碼
│   ├── 📂 agents/             # 🤖 智能代理系統
│   ├── 📂 config/             # ⚙️ 系統配置
│   ├── 📂 middleware/         # 🔒 中間件
│   ├── 📂 routes/             # 🛣️ API路由
│   ├── 📂 services/           # 🔧 業務邏輯服務
│   ├── 📂 utils/              # 🛠️ 工具函數
│   └── 📄 server.js           # 🌐 主服務器
│
├── 📂 views/                  # 🎨 前端模板檔案
│   ├── 📄 index_revolutionary.ejs    # 🚀 革命性前端
│   ├── 📄 driver_dashboard_simplified.ejs # 🚚 外送端介面
│   └── 📄 admin_*.ejs         # 👨‍💼 管理後台模板
│
├── 📂 public/                 # 🌐 靜態資源檔案
│   ├── 📂 css/                # 🎨 樣式檔案
│   ├── 📂 js/                 # ⚡ JavaScript檔案
│   ├── 📄 manifest.json       # 📱 PWA配置
│   └── 📄 sw.js               # 🔄 Service Worker
│
├── 📂 database/               # 🗄️ 資料庫相關檔案
│   ├── 📄 *.sql               # 📊 SQL腳本
│   └── 📄 schema.sql          # 🏗️ 資料庫架構
│
├── 📂 docs/                   # 📚 文檔和報告
│   ├── 📄 *測試報告*.md       # 🧪 測試報告
│   ├── 📄 *升級*.md           # ⬆️ 升級記錄
│   ├── 📄 *部署*.md           # 🚀 部署指南
│   └── 📄 *GUIDE*.md          # 📖 使用指南
│
├── 📂 config/                 # ⚙️ 配置和測試檔案
│   ├── 📄 *.js                # 🔧 配置腳本
│   └── 📄 *.html              # 🌐 測試頁面
│
├── 📂 functions/              # ☁️ 雲端函數
│   ├── 📄 index.js            # 🌐 Firebase Functions
│   └── 📄 package.json        # 📦 函數依賴
│
├── 📄 package.json            # 📦 專案依賴配置
├── 📄 package-lock.json       # 🔒 依賴版本鎖定
├── 📄 vercel.json             # ☁️ Vercel部署配置
├── 📄 docker-compose.yml      # 🐳 Docker配置
├── 📄 render.yaml             # 🎯 Render部署配置
└── 📄 README.md               # 📖 專案說明文檔
```

## 🚀 系統特色

### 🎯 革命性前端設計
- **設計系統**: SUB AGENT團隊革命性設計
- **視覺效果**: 動態玻璃效果、85%地圖設計
- **技術棧**: PWA支援、響應式設計
- **用戶體驗**: 現代化互動介面

### 🚚 外送端系統
- **工作台**: 簡化外送員操作介面  
- **路線優化**: 智能配送路徑規劃
- **即時統計**: 訂單數量和收益追蹤
- **GPS整合**: Google Maps導航支援

### 🤖 智能代理系統
- **OrderAgent**: 訂單處理自動化
- **InventoryAgent**: 庫存管理自動化
- **心跳檢查**: 系統健康監控
- **通訊規則**: Agent間協作機制

### 🔧 技術架構
- **後端**: Node.js + Express
- **前端**: EJS模板 + 現代CSS
- **資料庫**: PostgreSQL (Supabase)
- **部署**: Vercel + Render雙平台
- **API**: RESTful設計
- **即時通訊**: WebSocket支援

## 🌐 部署網址

### 📱 系統入口
- **前台**: https://chengyivegetable.vercel.app/
- **管理後台**: https://chengyivegetable.vercel.app/admin

### 🚚 外送端系統
- **登入頁面**: https://chengyivegetable.vercel.app/driver/login
- **工作台**: https://chengyivegetable.vercel.app/driver/dashboard
- **API端點**: https://chengyivegetable.vercel.app/api/driver/*

## 🛠️ 本地開發

### 環境需求
- Node.js 18+
- npm 或 yarn
- PostgreSQL (可選，有示範模式)

### 安裝與啟動
```bash
# 進入專案目錄
cd 誠憶鮮蔬線上系統

# 安裝依賴
npm install

# 啟動開發服務器
npm start
# 或
node src/server.js

# 訪問網址
# 前台: http://localhost:3000
# 外送端: http://localhost:3000/driver
# 管理後台: http://localhost:3000/admin
```

## 📊 系統功能

### ✅ 已完成功能
1. **革命性前端設計**: 現代化使用者介面
2. **外送員工作系統**: 完整接單到配送流程
3. **管理後台**: 訂單、產品、庫存管理
4. **智能路線優化**: Google Maps API整合
5. **即時通知系統**: WebSocket通訊
6. **PWA支援**: 可安裝的網頁應用程式
7. **多平台部署**: Vercel + Render

### 🔮 持續改進
- 資料庫連線優化
- 效能監控系統
- 用戶體驗改善
- 功能擴展開發

## 📞 技術支援

如有任何問題或建議，請參考 `docs/` 目錄中的相關文檔。

---

**🎉 誠憶鮮蔬線上系統 - 革命性蔬果外送平台**  
**🚀 Generated with Claude Code**

---
*最後更新: 2025/9/4 下午12:00:37*
*狀態: 通用智能部署系統自動更新*
*專案: chengyivegetable-delivery-db*
