#!/usr/bin/env node
/**
 * 簡化的系統修復腳本
 */

const fs = require('fs');
const path = require('path');

function updateEnvFile() {
  console.log('🔧 更新環境變數配置...');

  const envPath = path.join(__dirname, '.env');
  let envContent = fs.readFileSync(envPath, 'utf8');

  // 添加本地開發用的 DATABASE_URL
  if (!envContent.includes('DATABASE_URL=postgresql://')) {
    envContent += '\n# 本地開發資料庫 (如無本地PostgreSQL，系統會自動使用示範模式)\n';
    envContent += 'DATABASE_URL=postgresql://postgres:password@localhost:5432/chengyivegetable\n';
    envContent += '\n# 示範模式設定\n';
    envContent += 'DEMO_MODE=auto\n';
  }

  fs.writeFileSync(envPath, envContent);
  console.log('✅ .env 檔案已更新');
}

function createStartScript() {
  console.log('🔧 創建啟動腳本...');

  const startScript = `require('dotenv').config();

console.log('🚀 誠憶鮮蔬系統啟動中...');

if (!process.env.DATABASE_URL) {
  console.log('⚠️ DATABASE_URL 未設定，系統將在示範模式下運行');
}

require('./src/server.js');
`;

  fs.writeFileSync(path.join(__dirname, 'start.js'), startScript);
  console.log('✅ start.js 已創建');
}

function updatePackageJson() {
  console.log('🔧 更新 package.json...');

  const packagePath = path.join(__dirname, 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

  packageJson.scripts = packageJson.scripts || {};
  packageJson.scripts.start = 'node start.js';
  packageJson.scripts.dev = 'node start.js';

  fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2));
  console.log('✅ package.json 已更新');
}

// 執行修復
try {
  updateEnvFile();
  createStartScript();
  updatePackageJson();

  console.log('\n✅ 修復完成！');
  console.log('\n🚀 啟動指令: npm start');
  console.log('🔍 診斷指令: node diagnose_system_issues.js');

} catch (error) {
  console.error('❌ 修復失敗:', error);
}