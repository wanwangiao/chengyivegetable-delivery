// 極簡 Vercel API 測試
export default function handler(req, res) {
  res.status(200).json({
    message: '極簡 API 測試成功！',
    timestamp: new Date().toISOString(),
    method: req.method,
    url: req.url
  });
}