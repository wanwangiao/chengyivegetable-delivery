module.exports = (req, res) => {
  res.status(200).json({
    message: '測試端點正常運行',
    timestamp: new Date().toISOString(),
    path: req.url,
    method: req.method
  });
};