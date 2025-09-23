/**
 * LINE API 路由
 * 處理所有 LINE 相關的路由配置
 */

const express = require('express');
const router = express.Router();
const LineController = require('../controllers/LineController');

// 初始化 LINE 控制器
let lineController;

function initializeLineController(database) {
  if (!lineController) {
    lineController = new LineController(database);
    console.log('🔗 LINE 控制器已初始化');
  }
  return lineController;
}

// 中間件：確保控制器已初始化
function ensureController(req, res, next) {
  if (!lineController) {
    return res.status(500).json({
      error: 'LINE 控制器未初始化',
      code: 'CONTROLLER_NOT_INITIALIZED'
    });
  }
  next();
}

// ============= LINE 登入與認證路由 =============

// LINE 登入重導向
router.get('/auth/line/login', ensureController, (req, res) => {
  lineController.loginRedirect(req, res);
});

// LINE 登入回調
router.get('/auth/line/callback', ensureController, (req, res) => {
  lineController.loginCallback(req, res);
});

// LINE 連接成功頁面
router.get('/line-connected', ensureController, (req, res) => {
  lineController.connectedPage(req, res);
});

// ============= LIFF 相關路由 =============

// LIFF 入口頁面
router.get('/liff-entry', ensureController, (req, res) => {
  lineController.liffEntryPage(req, res);
});

// LIFF 除錯頁面
router.get('/liff-debug', ensureController, (req, res) => {
  lineController.liffDebugPage(req, res);
});

// LIFF 主頁面重導向
router.get('/liff', ensureController, (req, res) => {
  lineController.liffPage(req, res);
});

// LINE 入口頁面重導向
router.get('/line-entry', ensureController, (req, res) => {
  lineController.lineEntryPage(req, res);
});

// ============= LINE Bot 相關路由 =============

// LINE Bot 測試頁面
router.get('/line-bot-test', ensureController, (req, res) => {
  lineController.botTestPage(req, res);
});

// LINE Webhook 處理
router.post('/api/line/webhook', ensureController, (req, res) => {
  lineController.webhook(req, res);
});

// LINE 除錯資訊
router.get('/api/line/debug', ensureController, (req, res) => {
  lineController.getDebugInfo(req, res);
});

// ============= LINE 用戶管理 API =============

// 綁定 LINE 用戶
router.post('/api/line/bind-user', ensureController, (req, res) => {
  lineController.bindUser(req, res);
});

// 註冊 LINE 用戶
router.post('/api/line/register-user', ensureController, (req, res) => {
  lineController.registerUser(req, res);
});

// 綁定電話號碼
router.post('/api/line/bind-phone', ensureController, (req, res) => {
  lineController.bindPhone(req, res);
});

// 根據電話號碼獲取用戶ID
router.get('/api/line/user-id/:phone', ensureController, (req, res) => {
  lineController.getUserIdByPhone(req, res);
});

// ============= LINE 訂單相關 API =============

// 連結訂單到 LINE 用戶
router.post('/api/line/link-order', ensureController, (req, res) => {
  lineController.linkOrder(req, res);
});

// 獲取用戶訂單歷史（通過用戶ID）
router.get('/api/line/order-history/:userId', ensureController, (req, res) => {
  lineController.getUserOrderHistory(req, res);
});

// 獲取當前會話用戶的訂單歷史
router.get('/api/line/my-order-history', ensureController, (req, res) => {
  lineController.getMyOrderHistory(req, res);
});

// 獲取訂單詳情（只能查看自己的）
router.get('/api/line/order-detail/:orderId', ensureController, (req, res) => {
  lineController.getOrderDetail(req, res);
});

// 取消訂單（只能取消自己的）
router.post('/api/line/cancel-order/:orderId', ensureController, (req, res) => {
  lineController.cancelOrder(req, res);
});

// ============= LINE 通知相關 API =============

// 發送訂單通知
router.post('/api/line/send-order-notification/:orderId', ensureController, (req, res) => {
  lineController.sendOrderNotification(req, res);
});

// ============= LINE 前端頁面路由 =============

// LINE 訂單歷史頁面
router.get('/line/order-history', ensureController, (req, res) => {
  lineController.orderHistoryPage(req, res);
});

// ============= 路由導出和初始化函數 =============

module.exports = {
  router,
  initializeLineController
};