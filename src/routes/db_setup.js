/**
 * 資料庫設置路由
 * 用於初始化basic_settings表和相關設定
 * 僅供管理員一次性使用
 */

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

// 管理員驗證中間件
function ensureAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) {
    return next();
  }
  res.status(401).json({ success: false, message: '需要管理員權限' });
}

// 資料庫初始化頁面
router.get('/setup', ensureAdmin, (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>資料庫初始化設置</title>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; margin: 40px; }
        .container { max-width: 800px; margin: 0 auto; }
        button { 
          background: #22c55e; color: white; border: none; 
          padding: 12px 24px; border-radius: 6px; cursor: pointer; 
          margin: 10px 5px; font-size: 14px;
        }
        button:hover { background: #16a34a; }
        .danger { background: #ef4444; }
        .danger:hover { background: #dc2626; }
        .result { 
          margin: 20px 0; padding: 15px; border-radius: 6px; 
          white-space: pre-wrap; font-family: monospace; 
        }
        .success { background: #dcfce7; border: 1px solid #22c55e; }
        .error { background: #fef2f2; border: 1px solid #ef4444; }
        .warning { background: #fffbeb; border: 1px solid #f59e0b; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🔧 資料庫初始化設置</h1>
        <p><strong>⚠️ 警告:</strong> 這些操作只應在系統首次部署時執行一次。</p>
        
        <div>
          <h3>步驟 1: 檢查資料庫狀態</h3>
          <button onclick="checkDatabase()">🔍 檢查資料庫連接</button>
          <button onclick="checkTables()">📋 檢查表格狀態</button>
        </div>

        <div>
          <h3>步驟 2: 初始化 basic_settings 表</h3>
          <button onclick="initBasicSettings()">🗄️ 建立 basic_settings 表</button>
          <button onclick="insertDefaultData()">📝 插入預設資料</button>
        </div>

        <div>
          <h3>步驟 3: 測試功能</h3>
          <button onclick="testSettings()">🧪 測試設定載入</button>
          <button onclick="testUpdate()">💾 測試設定更新</button>
        </div>

        <div>
          <h3>⚠️ 危險操作</h3>
          <button class="danger" onclick="dropBasicSettings()">🗑️ 刪除 basic_settings 表</button>
          <button class="danger" onclick="resetAllSettings()">🔄 重設所有設定</button>
        </div>

        <div id="result"></div>
      </div>

      <script>
        function showResult(data, type = 'success') {
          const result = document.getElementById('result');
          result.className = 'result ' + type;
          result.textContent = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
        }

        async function apiCall(endpoint, method = 'GET', data = null) {
          try {
            const options = {
              method,
              headers: { 'Content-Type': 'application/json' }
            };
            if (data) options.body = JSON.stringify(data);
            
            const response = await fetch('/api/db-setup/' + endpoint, options);
            const result = await response.json();
            
            showResult(result, response.ok ? 'success' : 'error');
            return result;
          } catch (error) {
            showResult('網路錯誤: ' + error.message, 'error');
            return null;
          }
        }

        function checkDatabase() { apiCall('check-db'); }
        function checkTables() { apiCall('check-tables'); }
        function initBasicSettings() { apiCall('init-basic-settings', 'POST'); }
        function insertDefaultData() { apiCall('insert-defaults', 'POST'); }
        function testSettings() { apiCall('test-settings'); }
        function testUpdate() { 
          apiCall('test-update', 'POST', { 
            website_content_store_name: '測試商店名稱',
            theme_primary_color: '#ff6600'
          }); 
        }
        function dropBasicSettings() {
          if (confirm('⚠️ 確定要刪除 basic_settings 表嗎？這將清除所有設定！')) {
            apiCall('drop-basic-settings', 'POST');
          }
        }
        function resetAllSettings() {
          if (confirm('⚠️ 確定要重設所有設定為預設值嗎？')) {
            apiCall('reset-all', 'POST');
          }
        }
      </script>
    </body>
    </html>
  `);
});

module.exports = router;