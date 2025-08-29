#!/usr/bin/env node
/**
 * 🤖 Claude Code Hook 自動部署觸發器
 * 當用戶說特定關鍵字時自動執行部署
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// 檢查是否由 Claude Code 觸發
const args = process.argv.slice(2);
const trigger = args[0];

// 定義觸發關鍵字
const DEPLOY_TRIGGERS = [
  '請更新進度記錄並推送部署',
  '更新進度並部署',
  '推送部署',
  '部署到線上',
  '更新線上版本',
  '同步到生產環境',
  'deploy',
  'update and deploy'
];

// 檢查是否包含觸發關鍵字
function shouldTriggerDeploy(userInput) {
  if (!userInput) return false;
  
  const input = userInput.toLowerCase();
  return DEPLOY_TRIGGERS.some(trigger => 
    input.includes(trigger.toLowerCase()) || 
    input.includes('部署') || 
    input.includes('推送')
  );
}

// 智能部署函數
async function smartDeploy(commitMessage = null) {
  console.log('🤖 Claude Code Hook 觸發自動部署...\n');
  
  try {
    // 檢查是否有更改
    const status = execSync('git status --porcelain', { encoding: 'utf8' });
    
    // 智能生成提交訊息
    const timestamp = new Date().toLocaleString('zh-TW');
    const defaultMessage = commitMessage || `📋 Claude Code 自動更新 - ${timestamp}`;
    
    if (status.trim()) {
      console.log('📝 檢測到更改，開始自動部署...');
      
      // 更新 CLAUDE.md
      await updateClaudeProgress();
      
      console.log('1️⃣ 添加所有更改...');
      execSync('git add .', { stdio: 'inherit' });
      
      console.log('2️⃣ 提交更改...');
      execSync(`git commit -m "${defaultMessage}"`, { stdio: 'inherit' });
    } else {
      console.log('📋 沒有新更改，檢查是否需要推送...');
    }
    
    console.log('3️⃣ 推送到遠端...');
    execSync('git push', { stdio: 'inherit' });
    
    console.log('4️⃣ 部署到生產環境...');
    execSync('vercel --prod', { stdio: 'inherit' });
    
    console.log('\n🎉 Claude Code Hook 自動部署完成！');
    console.log('🌐 線上網址: https://veg-delivery-platform.vercel.app');
    console.log('🤖 下次只要說"請更新進度記錄並推送部署"即可自動觸發！');
    
  } catch (error) {
    console.error('❌ 自動部署失敗:', error.message);
    throw error;
  }
}

// 更新進度記錄
async function updateClaudeProgress() {
  const claudeFilePath = path.join(__dirname, 'CLAUDE.md');
  
  if (fs.existsSync(claudeFilePath)) {
    try {
      let content = fs.readFileSync(claudeFilePath, 'utf8');
      
      const timestamp = new Date().toLocaleString('zh-TW');
      const updateLine = `*最後更新: ${timestamp}*`;
      
      // 更新時間戳
      content = content.replace(
        /\*最後更新:.*?\*/g,
        updateLine
      );
      
      // 如果沒有找到，添加到最後
      if (!content.includes('最後更新:')) {
        content += `\n\n---\n${updateLine}\n*狀態: Claude Code Hook 自動更新*\n`;
      }
      
      fs.writeFileSync(claudeFilePath, content, 'utf8');
      console.log('📋 CLAUDE.md 進度記錄已自動更新');
      
    } catch (error) {
      console.log('⚠️ 更新 CLAUDE.md 時出錯:', error.message);
    }
  }
}

// 主執行邏輯
if (require.main === module) {
  const userInput = args.join(' ');
  
  if (shouldTriggerDeploy(userInput) || !userInput) {
    smartDeploy(userInput || '🤖 Claude Code Hook 自動觸發部署')
      .catch(error => {
        console.log('\n🛠️ 請手動執行: npm run deploy');
        process.exit(1);
      });
  } else {
    console.log('🤖 Claude Code Hook: 未檢測到部署觸發關鍵字');
    console.log('💡 說出以下任一關鍵字即可觸發自動部署:');
    DEPLOY_TRIGGERS.forEach(trigger => console.log(`   - "${trigger}"`));
  }
}

module.exports = { smartDeploy, shouldTriggerDeploy };