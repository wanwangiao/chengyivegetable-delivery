# 誠憶鮮蔬線上系統 - 安全設置指南

## 🔒 環境變數安全設置

### 必要環境變數

在部署前，請確保設置以下環境變數：

#### 1. 資料庫設定
```
DATABASE_URL=your_secure_database_connection_string
```

#### 2. 管理員帳號設定
```
ADMIN_EMAIL=your_admin_email@example.com
ADMIN_PASSWORD=your_very_secure_password_here
```
**注意**: 請使用強密碼，包含大小寫字母、數字和特殊字元，至少12字元

#### 3. Session 安全設定
```
SESSION_SECRET=your_random_32_char_secret_key_here
```
**注意**: 請使用至少32字元的隨機字串，可使用以下指令生成：
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

#### 4. LINE Bot 設定
```
LINE_CHANNEL_ID=your_line_channel_id
LINE_CHANNEL_SECRET=your_line_channel_secret
LINE_CHANNEL_ACCESS_TOKEN=your_line_channel_access_token
LINE_LIFF_ID=your_line_liff_id
```

#### 5. Google Maps API 設定
```
GOOGLE_MAPS_API_KEY=your_google_maps_api_key
```

### Railway 部署設定

1. 在 Railway Dashboard 中，進入專案設定
2. 點擊 "Variables" 頁籤
3. 逐一新增上述環境變數

### 本地開發設定

1. 複製 `.env.example` 為 `.env`
2. 填入實際的環境變數值
3. 確保 `.env` 檔案已加入 `.gitignore`

## 🛡️ 安全功能

### 已實施的安全措施

1. **移除硬編碼敏感資訊**
   - 所有 API 密鑰、密碼、連線字串已移至環境變數
   - 系統啟動時會驗證必要環境變數

2. **Session 安全強化**
   - 使用環境變數中的 SESSION_SECRET
   - 生產環境啟用 HTTPS-only cookies
   - 縮短 session 有效期至4小時
   - 使用32位元組隨機 session ID

3. **管理員認證強化**
   - 移除預設密碼
   - 強制要求設置 ADMIN_PASSWORD 環境變數
   - 密碼驗證失敗時提供適當錯誤處理

4. **環境變數驗證**
   - 系統啟動時自動檢查必要變數
   - SESSION_SECRET 長度驗證
   - 缺少變數時停止啟動並顯示錯誤

## ⚠️ 重要注意事項

1. **絕對不要** 在原始碼中硬編碼敏感資訊
2. **定期更換** SESSION_SECRET 和管理員密碼
3. **確保** .env 檔案不會被提交到版本控制
4. **使用強密碼** 保護所有帳號
5. **定期審查** 環境變數設定

## 📋 檢查清單

在部署前，請確認：

- [ ] 所有環境變數已正確設置
- [ ] SESSION_SECRET 至少32字元
- [ ] 管理員密碼足夠強
- [ ] .env 檔案已加入 .gitignore
- [ ] Railway 環境變數已設置
- [ ] 系統可正常啟動
- [ ] 管理員登入功能正常

## 🚨 緊急處理

如發現安全漏洞：

1. 立即更換所有受影響的密鑰和密碼
2. 檢查系統日誌是否有異常存取
3. 通知相關人員
4. 更新環境變數
5. 重新部署系統

---

*最後更新：2025-09-22*
*安全修復版本：1.0*