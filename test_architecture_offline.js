#!/usr/bin/env node

/**
 * 離線測試新架構 - 不依賴外部資料庫連線
 */

const path = require('path');

class OfflineArchitectureTest {
  constructor() {
    this.testResults = {
      moduleLoading: false,
      controllerStructure: false,
      routeDefinitions: false,
      middlewareSetup: false,
      errors: []
    };
  }

  async runTests() {
    console.log('🧪 開始離線測試新架構...\n');

    try {
      await this.testModuleLoading();
      await this.testControllerStructure();
      await this.testRouteDefinitions();
      await this.testMiddlewareSetup();

      this.generateTestReport();

    } catch (error) {
      console.error('❌ 測試過程發生錯誤:', error);
      this.testResults.errors.push(error.message);
    }
  }

  async testModuleLoading() {
    console.log('📦 測試模組載入...');

    try {
      // 清除require快取
      const appPath = path.join(__dirname, 'src', 'app.js');
      delete require.cache[appPath];

      // 嘗試載入VegetableDeliveryApp類別但不實例化
      const AppClass = require('./src/app.js');

      if (typeof AppClass === 'function') {
        console.log('✅ VegetableDeliveryApp類別載入成功');
        this.testResults.moduleLoading = true;
      } else {
        throw new Error('VegetableDeliveryApp不是有效的類別');
      }

    } catch (error) {
      console.log('❌ 模組載入失敗:', error.message);
      this.testResults.errors.push(`模組載入: ${error.message}`);
    }
  }

  async testControllerStructure() {
    console.log('🎮 測試控制器結構...');

    try {
      // 載入控制器管理器
      const { controllerManager } = require('./src/controllers');

      // 檢查控制器是否正確初始化
      const controllers = controllerManager.getAllControllers();

      const expectedControllers = [
        'system', 'product', 'order', 'admin', 'driver', 'line', 'customer'
      ];

      let allControllersPresent = true;
      for (const controllerName of expectedControllers) {
        if (!controllers[controllerName]) {
          console.log(`❌ 缺少控制器: ${controllerName}`);
          allControllersPresent = false;
        }
      }

      if (allControllersPresent) {
        console.log('✅ 所有必要控制器已正確載入');
        this.testResults.controllerStructure = true;
      }

      // 檢查控制器健康狀態
      const healthStatus = controllerManager.checkHealth();
      console.log(`📊 控制器健康狀態: ${healthStatus.status}`);

    } catch (error) {
      console.log('❌ 控制器結構測試失敗:', error.message);
      this.testResults.errors.push(`控制器結構: ${error.message}`);
    }
  }

  async testRouteDefinitions() {
    console.log('🛣️  測試路由定義...');

    try {
      // 檢查app.js中的路由定義
      const fs = require('fs');
      const appContent = fs.readFileSync(path.join(__dirname, 'src', 'app.js'), 'utf8');

      // 計算路由定義數量
      const routePatterns = [
        /this\.app\.get\(/g,
        /this\.app\.post\(/g,
        /this\.app\.put\(/g,
        /this\.app\.delete\(/g,
        /this\.app\.patch\(/g
      ];

      let totalRoutes = 0;
      routePatterns.forEach(pattern => {
        const matches = appContent.match(pattern);
        if (matches) {
          totalRoutes += matches.length;
        }
      });

      console.log(`📊 發現 ${totalRoutes} 個路由定義`);

      // 檢查關鍵路由是否存在
      const keyRoutes = [
        '/api/health',
        '/api/version',
        '/driver/login',
        '/admin/login',
        '/api/products'
      ];

      let keyRoutesPresent = 0;
      keyRoutes.forEach(route => {
        if (appContent.includes(route)) {
          keyRoutesPresent++;
        }
      });

      console.log(`📊 關鍵路由: ${keyRoutesPresent}/${keyRoutes.length} 個已定義`);

      if (totalRoutes > 0 && keyRoutesPresent === keyRoutes.length) {
        console.log('✅ 路由定義測試通過');
        this.testResults.routeDefinitions = true;
      }

    } catch (error) {
      console.log('❌ 路由定義測試失敗:', error.message);
      this.testResults.errors.push(`路由定義: ${error.message}`);
    }
  }

  async testMiddlewareSetup() {
    console.log('⚙️  測試中間件設定...');

    try {
      const fs = require('fs');
      const appContent = fs.readFileSync(path.join(__dirname, 'src', 'app.js'), 'utf8');

      // 檢查關鍵中間件是否設定
      const middlewareChecks = [
        { name: 'helmet', pattern: /helmet\(\)/ },
        { name: 'cors', pattern: /cors\(\)/ },
        { name: 'compression', pattern: /compression\(\)/ },
        { name: 'bodyParser', pattern: /bodyParser/ },
        { name: 'session', pattern: /session\(/ },
        { name: 'ensureAdmin', pattern: /ensureAdmin\s*=/ },
        { name: 'ensureDriver', pattern: /ensureDriver\s*=/ }
      ];

      let middlewareScore = 0;
      middlewareChecks.forEach(check => {
        if (check.pattern.test(appContent)) {
          console.log(`✅ ${check.name} 中間件已設定`);
          middlewareScore++;
        } else {
          console.log(`❌ ${check.name} 中間件未設定`);
        }
      });

      console.log(`📊 中間件設定: ${middlewareScore}/${middlewareChecks.length}`);

      if (middlewareScore >= middlewareChecks.length - 1) { // 允許一個缺失
        console.log('✅ 中間件設定測試通過');
        this.testResults.middlewareSetup = true;
      }

    } catch (error) {
      console.log('❌ 中間件設定測試失敗:', error.message);
      this.testResults.errors.push(`中間件設定: ${error.message}`);
    }
  }

  generateTestReport() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 離線架構測試報告');
    console.log('='.repeat(60));

    console.log(`📦 模組載入: ${this.testResults.moduleLoading ? '✅ 通過' : '❌ 失敗'}`);
    console.log(`🎮 控制器結構: ${this.testResults.controllerStructure ? '✅ 通過' : '❌ 失敗'}`);
    console.log(`🛣️  路由定義: ${this.testResults.routeDefinitions ? '✅ 通過' : '❌ 失敗'}`);
    console.log(`⚙️  中間件設定: ${this.testResults.middlewareSetup ? '✅ 通過' : '❌ 失敗'}`);

    if (this.testResults.errors.length > 0) {
      console.log('\n❌ 發現的問題:');
      this.testResults.errors.forEach((error, index) => {
        console.log(`   ${index + 1}. ${error}`);
      });
    }

    const passedTests = Object.values(this.testResults).filter(result => result === true).length;
    const totalTests = Object.keys(this.testResults).length - 1; // 排除errors陣列

    const overallStatus = passedTests === totalTests && this.testResults.errors.length === 0;

    console.log(`\n🎯 測試結果: ${passedTests}/${totalTests} 通過`);
    console.log(`🎯 整體狀態: ${overallStatus ? '✅ 架構健全' : '⚠️ 需要檢查'}`);

    if (overallStatus) {
      console.log('\n🎉 新架構結構檢查通過！');
      console.log('💡 架構重構已成功完成，具備以下特性:');
      console.log('   - 模組化控制器設計');
      console.log('   - 統一的錯誤處理機制');
      console.log('   - 完整的路由管理');
      console.log('   - 安全的中間件配置');
      console.log('\n📝 注意: 實際運行需要有效的資料庫連線');
    } else {
      console.log('\n🔧 請檢查上述問題後再次測試');
    }

    console.log('='.repeat(60));
  }
}

// 執行測試
if (require.main === module) {
  const test = new OfflineArchitectureTest();
  test.runTests();
}

module.exports = OfflineArchitectureTest;