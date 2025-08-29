#!/usr/bin/env node
/**
 * 🛡️ 安全部署系統 - 防止誤部署到錯誤專案
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// 專案識別配置
const PROJECT_CONFIG = {
  name: 'veg-delivery-platform',
  displayName: '蔬果外送平台',
  identifier: 'chengyivegetable-delivery-db',
  productionUrl: 'https://veg-delivery-platform.vercel.app',
  expectedFiles: ['CLAUDE.md', 'src/server.js', 'package.json'],
  vercelProject: 'veg-delivery-platform'
};

// 安全檢查函數
function validateProjectEnvironment() {
  console.log('🔍 執行專案安全檢查...\n');
  
  const errors = [];
  const warnings = [];
  
  // 1. 檢查當前目錄名稱
  const currentDir = path.basename(process.cwd());
  console.log(`📁 當前目錄: ${currentDir}`);
  
  if (currentDir !== PROJECT_CONFIG.name) {
    errors.push(`❌ 目錄名稱不匹配: 期望 "${PROJECT_CONFIG.name}", 實際 "${currentDir}"`);
  }
  
  // 2. 檢查 package.json 專案名稱
  const packagePath = path.join(process.cwd(), 'package.json');
  if (fs.existsSync(packagePath)) {
    try {
      const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
      console.log(`📦 專案名稱: ${packageJson.name}`);
      
      if (packageJson.name !== PROJECT_CONFIG.identifier) {
        errors.push(`❌ package.json 名稱不匹配: 期望 "${PROJECT_CONFIG.identifier}", 實際 "${packageJson.name}"`);
      }
    } catch (error) {
      warnings.push(`⚠️ 無法讀取 package.json: ${error.message}`);
    }
  } else {
    errors.push('❌ 找不到 package.json 檔案');
  }
  
  // 3. 檢查必要檔案
  console.log('📋 檢查必要檔案...');
  PROJECT_CONFIG.expectedFiles.forEach(file => {
    if (fs.existsSync(path.join(process.cwd(), file))) {
      console.log(`  ✅ ${file}`);
    } else {
      errors.push(`❌ 找不到必要檔案: ${file}`);
    }
  });
  
  // 4. 檢查 Git 遠端倉庫
  try {
    const remoteUrl = execSync('git remote get-url origin', { encoding: 'utf8' }).trim();
    console.log(`🔗 Git 遠端倉庫: ${remoteUrl}`);
    
    if (!remoteUrl.includes('chengyivegetable-delivery')) {
      warnings.push(`⚠️ Git 遠端倉庫可能不正確: ${remoteUrl}`);
    }
  } catch (error) {
    warnings.push(`⚠️ 無法檢查 Git 遠端倉庫: ${error.message}`);
  }
  
  // 5. 檢查 Vercel 專案設定
  const vercelConfigPath = path.join(process.cwd(), '.vercel', 'project.json');
  if (fs.existsSync(vercelConfigPath)) {
    try {
      const vercelConfig = JSON.parse(fs.readFileSync(vercelConfigPath, 'utf8'));
      console.log(`🌐 Vercel 專案: ${vercelConfig.projectName}`);
      
      if (vercelConfig.projectName !== PROJECT_CONFIG.vercelProject) {
        errors.push(`❌ Vercel 專案名稱不匹配: 期望 "${PROJECT_CONFIG.vercelProject}", 實際 "${vercelConfig.projectName}"`);
      }
    } catch (error) {
      warnings.push(`⚠️ 無法讀取 Vercel 配置: ${error.message}`);
    }
  } else {
    warnings.push('⚠️ 找不到 Vercel 專案配置');
  }
  
  return { errors, warnings };
}

// 安全確認函數
function requestConfirmation() {
  console.log(`\n🎯 準備部署到: ${PROJECT_CONFIG.displayName}`);
  console.log(`🌐 生產網址: ${PROJECT_CONFIG.productionUrl}`);
  console.log('\n⚠️ 這將會影響正在運作的生產環境！');
  
  // 在自動化環境中，我們返回 true，但記錄警告
  console.log('\n🤖 Claude Code Hook 自動確認部署');
  console.log('🔒 已通過專案安全檢查');
  
  return true;
}

// 主要安全部署函數
async function safeDeployment() {
  console.log('🛡️ 啟動安全部署系統...\n');
  
  // 1. 專案環境驗證
  const { errors, warnings } = validateProjectEnvironment();
  
  // 2. 顯示警告
  if (warnings.length > 0) {
    console.log('\n⚠️ 警告訊息:');
    warnings.forEach(warning => console.log(`   ${warning}`));
  }
  
  // 3. 檢查錯誤
  if (errors.length > 0) {
    console.log('\n❌ 安全檢查失敗:');
    errors.forEach(error => console.log(`   ${error}`));
    console.log('\n🚫 為了安全，拒絕執行部署！');
    console.log('💡 請確認您在正確的專案目錄中執行部署命令。');
    process.exit(1);
  }
  
  // 4. 安全確認
  if (!requestConfirmation()) {
    console.log('\n🚫 部署已取消');
    process.exit(0);
  }
  
  // 5. 執行部署
  console.log('\n🚀 開始安全部署...');
  
  try {
    // 使用現有的智能部署腳本
    const deployScript = path.join(__dirname, 'claude-hook-deploy.js');
    execSync(`node "${deployScript}" "🛡️ 安全部署系統自動觸發"`, { stdio: 'inherit' });
    
    console.log('\n✅ 安全部署完成！');
    console.log(`🌐 請確認網站正常運作: ${PROJECT_CONFIG.productionUrl}`);
    
  } catch (error) {
    console.error('\n❌ 安全部署失敗:', error.message);
    console.log('\n🔧 建議手動檢查並修復問題：');
    console.log('   1. 檢查 Git 狀態: git status');
    console.log('   2. 檢查 Vercel 狀態: vercel ls');
    console.log('   3. 手動部署: npm run deploy');
    process.exit(1);
  }
}

// 如果直接執行此腳本
if (require.main === module) {
  safeDeployment().catch(error => {
    console.error('💥 安全部署系統發生嚴重錯誤:', error);
    process.exit(1);
  });
}

module.exports = { safeDeployment, validateProjectEnvironment };