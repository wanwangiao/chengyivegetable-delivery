#!/usr/bin/env node

/**
 * 部署 LIFF 修復方案
 * 確保所有環境變數和配置正確部署到 Railway
 */

const { execSync } = require('child_process');
const fs = require('fs');

console.log('🚀 部署 LIFF 修復方案');
console.log('=' .repeat(50));

try {
    // 1. 運行診斷檢查
    console.log('\n📋 1. 運行最終診斷檢查...');
    const diagnosticResult = execSync('node diagnose_liff_issue.js', { encoding: 'utf8' });
    
    // 檢查是否 LINE_LIFF_ID 正確設定
    if (!diagnosticResult.includes('LINE_LIFF_ID 在本地環境中正確設定')) {
        console.log('❌ 本地環境檢查失敗，無法繼續部署');
        process.exit(1);
    }
    
    console.log('✅ 本地環境檢查通過');
    
    // 2. 檢查 Git 狀態
    console.log('\n📋 2. 檢查並提交變更...');
    
    try {
        const gitStatus = execSync('git status --porcelain', { encoding: 'utf8' });
        if (gitStatus.trim()) {
            console.log('📝 發現未提交的變更：');
            console.log(gitStatus);
            
            // 添加所有變更
            console.log('📝 添加變更到 Git...');
            execSync('git add .', { stdio: 'inherit' });
            
            // 提交變更
            console.log('📝 提交 LIFF 修復...');
            execSync('git commit -m "修復 LIFF 環境變數載入問題\n\n✨ 主要修復:\n- 修正 dotenv 載入路徑，同時載入 src/.env 和根目錄 .env\n- 統一 LINE 環境變數配置\n- 增強 LIFF 調試功能\n- 添加啟動時 LINE 環境變數日誌\n\n🔧 技術細節:\n- 更新 server.js 中的 dotenv 配置\n- 同步 .env 和 src/.env 中的 LINE 配置\n- 優化 /api/line/debug 端點\n- 添加 /liff-entry 路由日誌\n\n🧪 驗證:\n- 本地環境測試通過\n- LINE_LIFF_ID 正確載入: 2007966099-qXjNxbXN\n- 所有 LINE 環境變數就緒\n\n🎯 解決問題: LIFF 頁面 \'LIFF ID 未設定\' 錯誤"', { stdio: 'inherit' });
            
            console.log('✅ 變更提交成功');
        } else {
            console.log('ℹ️ 沒有新的變更需要提交');
        }
    } catch (error) {
        console.log('⚠️ Git 操作失敗，但繼續部署流程');
        console.log('錯誤:', error.message);
    }
    
    // 3. 推送到遠端
    console.log('\n📋 3. 推送到 GitHub...');
    try {
        execSync('git push', { stdio: 'inherit' });
        console.log('✅ 推送成功');
    } catch (error) {
        console.log('❌ 推送失敗:', error.message);
        console.log('請檢查網路連線或手動推送');
    }
    
    // 4. 強制 Railway 重新部署
    console.log('\n📋 4. 觸發 Railway 重新部署...');
    
    // 更新 railway.toml 的重建標記
    const railwayPath = './railway.toml';
    if (fs.existsSync(railwayPath)) {
        let railwayConfig = fs.readFileSync(railwayPath, 'utf8');
        const timestamp = new Date().toISOString().slice(0, 16).replace('T', '-').replace(':', '');
        
        // 更新強制重建標記
        if (railwayConfig.includes('FORCE_REBUILD')) {
            railwayConfig = railwayConfig.replace(
                /FORCE_REBUILD = ".*"/,
                `FORCE_REBUILD = "${timestamp}-liff-fix-deployment"`
            );
        } else {
            // 如果沒有重建標記，添加一個
            railwayConfig += `\n# 強制重建標記 - ${timestamp}\n[variables.rebuild]\nFORCE_REBUILD = "${timestamp}-liff-fix-deployment"\n`;
        }
        
        fs.writeFileSync(railwayPath, railwayConfig);
        console.log(`✅ 更新 Railway 重建標記: ${timestamp}-liff-fix-deployment`);
        
        // 提交並推送重建標記
        try {
            execSync('git add railway.toml', { stdio: 'inherit' });
            execSync(`git commit -m "觸發 Railway 重新部署 - LIFF 修復版本\\n\\n時間戳: ${timestamp}"`, { stdio: 'inherit' });
            execSync('git push', { stdio: 'inherit' });
            console.log('✅ 重建標記已推送');
        } catch (error) {
            console.log('⚠️ 重建標記推送失敗，Railway 可能仍會自動部署');
        }
    }
    
    // 5. 等待部署完成
    console.log('\n📋 5. 等待 Railway 部署完成...');
    console.log('🔄 Railway 正在自動檢測變更並重新部署');
    console.log('⏱️ 預計需要 2-3 分鐘完成部署');
    
    // 6. 提供驗證指引
    console.log('\n🧪 部署完成後的驗證步驟:');
    console.log('=' .repeat(50));
    console.log('1. 檢查環境變數載入:');
    console.log('   https://chengyivegetable-production-7b4a.up.railway.app/api/line/debug');
    console.log('');
    console.log('2. 測試 LIFF 頁面:');
    console.log('   https://chengyivegetable-production-7b4a.up.railway.app/liff-entry');
    console.log('');
    console.log('3. 在 LINE 中測試:');
    console.log('   - 發送上述 LIFF URL 到 LINE');
    console.log('   - 點擊連結在 LINE 內建瀏覽器開啟');
    console.log('   - 應該看到用戶資訊自動載入');
    console.log('');
    console.log('4. 檢查 Railway 部署日誌:');
    console.log('   - 查看啟動日誌中的 LINE 環境變數');
    console.log('   - 確認 LINE_LIFF_ID 已正確載入');
    
    console.log('\n🔧 如果問題仍然存在:');
    console.log('=' .repeat(50));
    console.log('1. 檢查 Railway 環境變數設定面板');
    console.log('2. 確認 railway.toml 變數是否正確同步');
    console.log('3. 重新部署應用程式');
    console.log('4. 檢查瀏覽器開發者工具的錯誤訊息');
    
    console.log('\n✅ LIFF 修復部署腳本執行完成！');
    console.log('🚀 請等待 Railway 完成部署後進行測試');
    
} catch (error) {
    console.error('\n❌ 部署過程中發生錯誤：');
    console.error(error.message);
    console.error('\n請檢查：');
    console.error('1. 網路連線是否正常');
    console.error('2. Git 設定是否正確');
    console.error('3. Railway 專案是否正常運行');
    
    process.exit(1);
}