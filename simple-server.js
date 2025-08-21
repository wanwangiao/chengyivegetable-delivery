const express = require('express');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3002;

// 基本中間件
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 健康檢查
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'simple-vegdelivery-server'
  });
});

// LINE Webhook - 超簡化版本
app.post('/api/line/webhook', (req, res) => {
  console.log('📱 LINE Webhook 收到請求');
  console.log('🔧 環境變數:', {
    LINE_CHANNEL_ID: process.env.LINE_CHANNEL_ID || 'MISSING',
    LINE_CHANNEL_SECRET: !!process.env.LINE_CHANNEL_SECRET,
    NODE_ENV: process.env.NODE_ENV
  });
  
  // 總是返回 200
  res.status(200).json({
    status: 'OK',
    message: 'LINE Webhook received successfully',
    timestamp: new Date().toISOString(),
    env_check: {
      channelId: !!process.env.LINE_CHANNEL_ID,
      channelSecret: !!process.env.LINE_CHANNEL_SECRET
    }
  });
});

// 啟動伺服器
app.listen(port, () => {
  console.log(`🚀 簡化伺服器啟動: http://localhost:${port}`);
  console.log('📱 LINE Webhook: /api/line/webhook');
  console.log('❤️ 健康檢查: /health');
});

module.exports = app;