// 簡單的 Vercel 無伺服器函數測試
module.exports = (req, res) => {
  // 設置 CORS 標頭
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // 處理 OPTIONS 請求
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // 基本的健康檢查響應
  res.status(200).json({
    success: true,
    message: '🚀 誠憶鮮蔬系統運行正常',
    timestamp: new Date().toISOString(),
    method: req.method,
    url: req.url,
    headers: {
      'user-agent': req.headers['user-agent'] || 'unknown'
    },
    system: 'Vercel Serverless Function',
    version: '2.0'
  });
};