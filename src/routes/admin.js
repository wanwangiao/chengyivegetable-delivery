const express = require('express');
const router = express.Router();
const AdminController = require('../controllers/AdminController');

/**
 * 管理員路由 - 整合AdminController
 * 處理所有管理員相關的頁面路由
 */

// 創建AdminController實例
const adminController = new AdminController();

// 管理員身份驗證中介軟體
function ensureAdmin(req, res, next) {
  if (!req.session) {
    console.warn('⚠️ ensureAdmin: Session不存在，重定向到登入');
    return res.redirect('/admin/login');
  }

  if (req.session.isAdmin) {
    // 檢查是否過期（24小時）
    const now = new Date();
    const loginTime = new Date(req.session.loginTime);
    const hoursSinceLogin = (now - loginTime) / (1000 * 60 * 60);

    if (hoursSinceLogin > 24) {
      console.warn('⚠️ ensureAdmin: Session已過期，清理並重定向');
      req.session.destroy();
      return res.redirect('/admin/login');
    }

    // 更新最後活動時間
    req.session.lastActivity = new Date();
    return next();
  }
  return res.redirect('/admin/login');
}

// 設置資料庫連接
router.use((req, res, next) => {
  if (req.app.locals.pool) {
    adminController.setDatabasePool(req.app.locals.pool);
  }
  next();
});

// ===== 認證相關路由 =====
router.get('/', adminController.adminHome);
router.get('/login', adminController.loginPage);
router.post('/login', adminController.login);
router.get('/logout', adminController.logout);

// ===== 主要管理頁面 =====
router.get('/dashboard', ensureAdmin, adminController.dashboard);
router.get('/orders', ensureAdmin, adminController.ordersPage);
router.get('/products', ensureAdmin, adminController.productsPage);
router.get('/inventory', ensureAdmin, adminController.inventoryPage);
router.get('/reports', ensureAdmin, adminController.reportsPage);
router.get('/delivery', ensureAdmin, adminController.deliveryPage);

// ===== 設定頁面 =====
router.get('/basic-settings', ensureAdmin, adminController.basicSettingsPage);
router.get('/business-hours', ensureAdmin, adminController.businessHoursPage);
router.get('/delivery-areas', ensureAdmin, adminController.deliveryAreasPage);

// ===== 監控頁面 =====
router.get('/map', ensureAdmin, adminController.mapPage);
router.get('/websocket-monitor', ensureAdmin, adminController.websocketMonitorPage);
router.get('/driver-performance', ensureAdmin, adminController.driverPerformancePage);
router.get('/order-management', ensureAdmin, adminController.orderManagementPage);

// ===== API 端點 =====
router.get('/api/dashboard', ensureAdmin, adminController.getDashboardData);

module.exports = router;