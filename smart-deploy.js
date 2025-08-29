#!/usr/bin/env node
/**
 * 🚀 智能部署腳本
 * 自動檢查更改、提交、推送並部署到生產環境
 */

const { execSync } = require('child_process');
const fs = require('fs');

console.log('🚀 智能部署系統啟動...\n');

try {
  // 檢查是否有未提交的更改
  const status = execSync('git status --porcelain', { encoding: 'utf8' });
  
  if (!status.trim()) {
    console.log('📋 沒有檢測到更改，檢查是否需要推送...');
    
    try {
      const unpushed = execSync('git log origin/master..HEAD --oneline', { encoding: 'utf8' });
      if (unpushed.trim()) {
        console.log('📤 發現未推送的提交，正在推送並部署...');
        execSync('git push && vercel --prod', { stdio: 'inherit' });
      } else {
        console.log('✅ 本地與遠端同步，無需操作');
      }
    } catch (error) {
      console.log('⚠️  無法比較本地與遠端，執行推送並部署...');
      execSync('git push && vercel --prod', { stdio: 'inherit' });
    }
    
    return;
  }

  console.log('📝 檢測到以下更改：');
  console.log(status);
  
  // 生成提交訊息
  const timestamp = new Date().toLocaleString('zh-TW');
  const commitMessage = process.argv[2] || `🔄 Smart Deploy - ${timestamp}`;
  
  console.log(`📦 提交訊息: "${commitMessage}"`);
  
  // 執行完整部署流程
  console.log('\n🔄 開始完整部署流程...');
  
  console.log('1️⃣ 添加所有更改...');
  execSync('git add .', { stdio: 'inherit' });
  
  console.log('2️⃣ 提交更改...');
  execSync(`git commit -m "${commitMessage}"`, { stdio: 'inherit' });
  
  console.log('3️⃣ 推送到遠端...');
  execSync('git push', { stdio: 'inherit' });
  
  console.log('4️⃣ 部署到生產環境...');
  execSync('vercel --prod', { stdio: 'inherit' });
  
  console.log('\n🎉 部署完成！');
  console.log('🌐 線上網址: https://veg-delivery-platform.vercel.app');
  
} catch (error) {
  console.error('❌ 部署過程中出現錯誤:', error.message);
  console.log('\n🛠️ 請手動執行以下步驟：');
  console.log('   git add .');
  console.log('   git commit -m "手動修復"');
  console.log('   git push');
  console.log('   vercel --prod');
  process.exit(1);
}