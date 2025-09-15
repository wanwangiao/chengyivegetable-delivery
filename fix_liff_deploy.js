#!/usr/bin/env node

/**
 * 修復LIFF設定並部署到Railway
 * 解決LINE ID綁定功能的環境變數問題
 */

const { execSync } = require('child_process');
const fs = require('fs');

console.log('🔧 修復LIFF設定並部署到Railway');
console.log('═══════════════════════════════════════');

try {
    // 1. 檢查Railway.toml是否包含LINE設定
    console.log('\n📋 1. 檢查Railway配置...');
    
    const railwayConfig = fs.readFileSync('./railway.toml', 'utf8');
    
    if (railwayConfig.includes('LINE_LIFF_ID = "2007966099-qXjNxbXN"')) {
        console.log('✅ Railway.toml已包含LIFF設定');
    } else {
        console.log('❌ Railway.toml缺少LIFF設定');
        process.exit(1);
    }
    
    // 2. 檢查Git狀態
    console.log('\n📋 2. 檢查Git狀態...');
    try {
        const gitStatus = execSync('git status --porcelain', { encoding: 'utf8' });
        if (gitStatus.trim()) {
            console.log('📝 發現未提交的變更：');
            console.log(gitStatus);
        } else {
            console.log('✅ 工作目錄乾淨');
        }
    } catch (error) {
        console.log('⚠️ Git檢查失敗，繼續部署流程');
    }
    
    // 3. 添加變更到Git
    console.log('\n📋 3. 添加變更到Git...');
    try {
        execSync('git add railway.toml', { stdio: 'inherit' });
        console.log('✅ 已添加railway.toml到暫存');
    } catch (error) {
        console.log('⚠️ Git add失敗，但繼續流程');
    }
    
    // 4. 提交變更
    console.log('\n📋 4. 提交LIFF修復...');
    try {
        execSync('git commit -m "修復LIFF環境變數設定 - 啟用LINE ID綁定功能\n\n- 在railway.toml中添加LINE_LIFF_ID和相關設定\n- 解決/liff-entry頁面404錯誤\n- 啟用自動LINE ID綁定功能"', { stdio: 'inherit' });
        console.log('✅ 提交成功');
    } catch (error) {
        console.log('⚠️ 提交失敗（可能沒有變更），但繼續部署');
    }
    
    // 5. 推送到遠端
    console.log('\n📋 5. 推送到GitHub...');
    try {
        execSync('git push', { stdio: 'inherit' });
        console.log('✅ 推送成功');
    } catch (error) {
        console.log('❌ 推送失敗:', error.message);
        console.log('請手動推送或檢查Git設定');
    }
    
    // 6. 等待Railway部署
    console.log('\n📋 6. 等待Railway自動部署...');
    console.log('🔄 Railway應該會自動檢測到變更並開始部署');
    console.log('⏱️ 預計需要2-3分鐘完成部署');
    
    // 7. 提供測試資訊
    console.log('\n🎯 部署完成後測試方法：');
    console.log('══════════════════════════════');
    console.log('1. 在LINE中發送以下網址：');
    console.log('   https://chengyivegetable-production-7b4a.up.railway.app/liff-entry');
    console.log('');
    console.log('2. 點擊網址（會在LINE內建瀏覽器開啟）');
    console.log('');
    console.log('3. 應該會看到：');
    console.log('   - 用戶資訊自動載入');
    console.log('   - LINE ID自動綁定');
    console.log('   - 重導向到購物頁面');
    console.log('');
    console.log('4. 下單測試：');
    console.log('   - 選購商品並下單');
    console.log('   - 填寫手機號碼');
    console.log('   - 系統會自動綁定LINE ID');
    console.log('');
    console.log('5. 通知測試：');
    console.log('   - 後台將訂單設為「包裝完成」');
    console.log('   - 應收到LINE付款通知');
    
    console.log('\n🔧 如果仍有問題：');
    console.log('══════════════════');
    console.log('1. 檢查Railway環境變數設定');
    console.log('2. 查看Railway部署日誌');
    console.log('3. 確認LIFF應用設定正確');
    
    console.log('\n✅ LIFF修復腳本執行完成！');
    console.log('🚀 請等待Railway完成部署後測試');
    
} catch (error) {
    console.error('\n❌ 修復過程中發生錯誤：');
    console.error(error.message);
    console.error('\n請檢查：');
    console.error('1. 是否在專案根目錄');
    console.error('2. Git是否正確設定');
    console.error('3. 網路連線是否正常');
    
    process.exit(1);
}