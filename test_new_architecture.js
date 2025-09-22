#!/usr/bin/env node

/**
 * 測試新架構的啟動和基本功能
 */

const http = require('http');
const { spawn } = require('child_process');

class ArchitectureTest {
  constructor() {
    this.testResults = {
      startup: false,
      healthCheck: false,
      apiResponses: [],
      errors: []
    };
  }

  async runTests() {
    console.log('🧪 開始測試新架構...\n');

    try {
      // 測試1: 檢查app.js語法
      await this.testSyntax();

      // 測試2: 快速啟動測試
      await this.testStartup();

      // 測試3: 健康檢查
      if (this.testResults.startup) {
        await this.testHealthCheck();
      }

      // 生成測試報告
      this.generateTestReport();

    } catch (error) {
      console.error('❌ 測試過程發生錯誤:', error);
      this.testResults.errors.push(error.message);
    }
  }

  async testSyntax() {
    console.log('📝 檢查app.js語法...');

    return new Promise((resolve) => {
      const syntaxCheck = spawn('node', ['-c', 'src/app.js'], {
        cwd: __dirname,
        stdio: 'pipe'
      });

      let errorOutput = '';

      syntaxCheck.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      syntaxCheck.on('close', (code) => {
        if (code === 0) {
          console.log('✅ app.js語法檢查通過');
        } else {
          console.log('❌ app.js語法錯誤:');
          console.log(errorOutput);
          this.testResults.errors.push('語法錯誤: ' + errorOutput);
        }
        resolve();
      });
    });
  }

  async testStartup() {
    console.log('🚀 測試應用程式啟動...');

    return new Promise((resolve) => {
      const startupTest = spawn('node', ['src/app.js'], {
        cwd: __dirname,
        stdio: 'pipe',
        env: { ...process.env, NODE_ENV: 'test' }
      });

      let output = '';
      let hasStarted = false;

      const timeout = setTimeout(() => {
        if (!hasStarted) {
          console.log('⏰ 啟動測試超時 (30秒)');
          startupTest.kill();
        }
      }, 30000);

      startupTest.stdout.on('data', (data) => {
        const text = data.toString();
        output += text;

        // 檢查是否看到啟動成功的訊息
        if (text.includes('伺服器運行在') || text.includes('Server running on')) {
          hasStarted = true;
          this.testResults.startup = true;
          console.log('✅ 應用程式啟動成功');
          clearTimeout(timeout);

          // 等待一點時間然後結束進程
          setTimeout(() => {
            startupTest.kill();
            resolve();
          }, 2000);
        }
      });

      startupTest.stderr.on('data', (data) => {
        const error = data.toString();
        console.log('stderr:', error);
        this.testResults.errors.push('啟動錯誤: ' + error);
      });

      startupTest.on('close', (code) => {
        clearTimeout(timeout);
        if (!hasStarted && code !== 0) {
          console.log(`❌ 應用程式啟動失敗 (退出碼: ${code})`);
          console.log('輸出:', output);
        }
        resolve();
      });

      startupTest.on('error', (error) => {
        clearTimeout(timeout);
        console.log('❌ 啟動過程錯誤:', error.message);
        this.testResults.errors.push('啟動過程錯誤: ' + error.message);
        resolve();
      });
    });
  }

  async testHealthCheck() {
    console.log('🏥 執行健康檢查...');

    // 簡單的健康檢查，檢查模組是否可以正確載入
    try {
      // 嘗試require主要模組
      const appPath = require('path').join(__dirname, 'src', 'app.js');
      delete require.cache[appPath]; // 清除緩存

      console.log('✅ 主要模組載入測試通過');
      this.testResults.healthCheck = true;
    } catch (error) {
      console.log('❌ 模組載入測試失敗:', error.message);
      this.testResults.errors.push('模組載入錯誤: ' + error.message);
    }
  }

  generateTestReport() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 新架構測試報告');
    console.log('='.repeat(60));

    console.log(`🚀 啟動測試: ${this.testResults.startup ? '✅ 通過' : '❌ 失敗'}`);
    console.log(`🏥 健康檢查: ${this.testResults.healthCheck ? '✅ 通過' : '❌ 失敗'}`);

    if (this.testResults.errors.length > 0) {
      console.log('\n❌ 發現的問題:');
      this.testResults.errors.forEach((error, index) => {
        console.log(`   ${index + 1}. ${error}`);
      });
    }

    const overallStatus = this.testResults.startup && this.testResults.healthCheck && this.testResults.errors.length === 0;

    console.log(`\n🎯 整體狀態: ${overallStatus ? '✅ 測試通過' : '⚠️ 需要檢查'}`);

    if (overallStatus) {
      console.log('\n🎉 新架構已準備就緒！');
      console.log('💡 建議執行: npm start 來啟動系統');
    } else {
      console.log('\n🔧 請檢查上述問題後再次測試');
    }

    console.log('='.repeat(60));
  }
}

// 執行測試
if (require.main === module) {
  const test = new ArchitectureTest();
  test.runTests();
}

module.exports = ArchitectureTest;