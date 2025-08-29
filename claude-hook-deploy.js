#!/usr/bin/env node
/**
 * 🤖 Claude Code Hook 自動部署觸發器
 * 當用戶說特定關鍵字時自動執行部署
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { universalDeploy } = require('./universal-deploy.js');

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
  console.log('🤖 Claude Code Hook 觸發通用智能部署系統...\n');
  
  try {
    // 使用通用部署系統
    await universalDeploy();
    
    console.log('\n🎉 Claude Code Hook 自動部署完成！');
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