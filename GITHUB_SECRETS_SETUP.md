# 🔐 GitHub Secrets 設置指南

為了實現完全自動部署，需要在 GitHub Repository 中設置以下 Secrets：

## 📋 需要設置的 Secrets

### 1. VERCEL_TOKEN
- **用途**: Vercel API 認證令牌
- **獲取方式**:
  1. 前往 [Vercel Dashboard](https://vercel.com/account/tokens)
  2. 點擊 "Create Token"
  3. 輸入名稱（如：GitHub Actions Deploy）
  4. 選擇到期時間（建議選擇較長時間）
  5. 複製生成的令牌

### 2. VERCEL_ORG_ID
- **值**: `team_IRQFTx2OUhzXgn312q7S4m5u`
- **說明**: 您的 Vercel 組織 ID（已從專案設定中提取）

### 3. VERCEL_PROJECT_ID  
- **值**: `prj_V6aqv1W197iHfy9yw3Or0fZ9e1mm`
- **說明**: 專案 ID（已從專案設定中提取）

## 🛠️ 如何設置 GitHub Secrets

1. **前往 GitHub Repository**:
   - 開啟您的 GitHub 專案頁面
   - https://github.com/wanwangiao/chengyivegetable-delivery

2. **進入 Settings**:
   - 點擊專案頁面上方的 "Settings" 標籤

3. **找到 Secrets and variables**:
   - 在左側選單中找到 "Secrets and variables"
   - 點擊 "Actions"

4. **新增 Secrets**:
   - 點擊 "New repository secret"
   - 依次新增以下三個 secrets：
     
     **Secret 1:**
     - Name: `VERCEL_TOKEN`
     - Value: [從 Vercel Dashboard 取得的令牌]
     
     **Secret 2:**
     - Name: `VERCEL_ORG_ID`
     - Value: `team_IRQFTx2OUhzXgn312q7S4m5u`
     
     **Secret 3:**
     - Name: `VERCEL_PROJECT_ID`
     - Value: `prj_V6aqv1W197iHfy9yw3Or0fZ9e1mm`

## ✅ 完成後的效果

設置完成後，每次您執行：
```bash
git add .
git commit -m "更新功能"
git push
```

系統會自動：
1. 🔍 檢測到 master 分支有新推送
2. 🚀 自動觸發 GitHub Actions
3. 📦 安裝依賴並準備部署
4. 🌐 自動部署到 Vercel Production 環境
5. ✅ 確保線上版本與本地版本完全一致

## 🎯 測試自動部署

設置完成後，可以進行測試：
1. 修改任意檔案
2. 提交並推送到 master
3. 在 GitHub 的 Actions 標籤查看部署進度
4. 確認 https://veg-delivery-platform.vercel.app 已更新

---
*設置完成後請刪除此檔案以保持專案整潔*