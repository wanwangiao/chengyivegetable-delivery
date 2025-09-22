/**
 * 控制器索引文件
 * 統一管理和初始化所有控制器
 */

const SystemController = require('./SystemController');
const ProductController = require('./ProductController');
const OrderController = require('./OrderController');
const AdminController = require('./AdminController');
const DriverController = require('./DriverController');
const LineController = require('./LineController');
const CustomerController = require('./CustomerController');

/**
 * 控制器管理類
 * 負責初始化和配置所有控制器
 */
class ControllerManager {
  constructor() {
    this.controllers = {};
    this.initializeControllers();
  }

  /**
   * 初始化所有控制器
   */
  initializeControllers() {
    this.controllers = {
      system: new SystemController(),
      product: new ProductController(),
      order: new OrderController(),
      admin: new AdminController(),
      driver: new DriverController(),
      line: new LineController(),
      customer: new CustomerController()
    };

    console.log('✅ 所有控制器已初始化');
  }

  /**
   * 設置資料庫連線池到所有控制器
   * @param {Pool} pool - PostgreSQL 連線池
   */
  setDatabasePool(pool) {
    Object.values(this.controllers).forEach(controller => {
      controller.setDatabasePool(pool);
    });
    console.log('✅ 資料庫連線池已設置到所有控制器');
  }

  /**
   * 設置服務依賴到所有控制器
   * @param {Object} services - 服務物件集合
   */
  setServices(services) {
    Object.values(this.controllers).forEach(controller => {
      controller.setServices(services);
    });
    console.log('✅ 服務依賴已設置到所有控制器');
  }

  /**
   * 獲取指定控制器
   * @param {string} name - 控制器名稱
   * @returns {BaseController} 控制器實例
   */
  getController(name) {
    if (!this.controllers[name]) {
      throw new Error(`控制器 '${name}' 不存在`);
    }
    return this.controllers[name];
  }

  /**
   * 獲取所有控制器
   * @returns {Object} 所有控制器的物件
   */
  getAllControllers() {
    return this.controllers;
  }

  /**
   * 檢查控制器健康狀態
   * @returns {Object} 健康狀態報告
   */
  checkHealth() {
    const healthStatus = {
      status: 'healthy',
      controllers: {},
      timestamp: new Date().toISOString()
    };

    Object.entries(this.controllers).forEach(([name, controller]) => {
      healthStatus.controllers[name] = {
        initialized: !!controller,
        hasDatabase: !!controller.pool,
        hasServices: Object.keys(controller.services).length > 0
      };
    });

    return healthStatus;
  }

  /**
   * 重置所有控制器的連線
   */
  resetConnections() {
    Object.values(this.controllers).forEach(controller => {
      controller.pool = null;
      controller.services = {};
    });
    console.log('⚠️ 所有控制器連線已重置');
  }
}

// 建立全域控制器管理器實例
const controllerManager = new ControllerManager();

module.exports = {
  ControllerManager,
  controllerManager,
  // 直接導出控制器類別以便個別使用
  SystemController,
  ProductController,
  OrderController,
  AdminController,
  DriverController,
  LineController,
  CustomerController
};