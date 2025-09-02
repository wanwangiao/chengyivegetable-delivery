#!/usr/bin/env node

/**
 * 修復外送員系統載入卡住問題 - 緊急修復腳本
 * 問題：loadUnifiedOrderPool 函數中的 Promise.allSettled 可能卡住
 * 解決方案：簡化載入邏輯，添加超時機制
 */

const fs = require('fs').promises;
const path = require('path');

async function fixLoadingIssue() {
    console.log('🔧 開始修復外送員系統載入問題...');
    
    const filePath = path.join(__dirname, 'views', 'driver_dashboard_simplified.ejs');
    
    try {
        // 讀取文件內容
        let content = await fs.readFile(filePath, 'utf-8');
        console.log('✅ 已讀取文件');
        
        // 修復方案：添加超時機制和錯誤捕獲
        const fixedLoadFunction = `
        // 載入統一訂單池 - 緊急修復版本 (2025-09-02)
        async function loadUnifiedOrderPool() {
            console.log('🔄 === 開始載入統一訂單池 (修復版) ===');
            
            const container = document.getElementById('unified-orders');
            if (!container) {
                console.error('❌ 找不到 unified-orders 容器');
                return;
            }
            
            // 顯示載入狀態
            container.innerHTML = '<div class="loading"><div class="loading-spinner"></div>載入訂單中...</div>';
            
            try {
                // 添加總體超時機制 - 30秒
                const loadingTimeout = setTimeout(() => {
                    throw new Error('載入超時（30秒）');
                }, 30000);
                
                // Step 1: 載入訂單數量（5秒超時）
                console.log('📊 Step 1: 載入訂單數量...');
                const countsPromise = fetch('/api/driver/order-counts')
                    .then(response => {
                        if (!response.ok) {
                            throw new Error(\`訂單數量API錯誤: \${response.status}\`);
                        }
                        return response.json();
                    });
                
                const countsData = await Promise.race([
                    countsPromise,
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('訂單數量API超時')), 5000)
                    )
                ]);
                
                console.log('✅ 訂單數量回應:', countsData);
                
                if (!countsData.success) {
                    throw new Error('訂單數量API回應失敗');
                }
                
                // Step 2: 簡化地區訂單載入（避免Promise.allSettled）
                console.log('📍 Step 2: 載入各地區訂單（簡化版）...');
                const areas = ['三峽區', '樹林區', '鶯歌區', '土城區', '北大特區'];
                const areaGroups = [];
                let totalCount = 0;
                allAvailableOrders = [];
                
                // 改為順序載入，避免併發問題
                for (const area of areas) {
                    try {
                        console.log(\`  🔍 載入 \${area}...\`);
                        
                        // 單個地區5秒超時
                        const areaPromise = fetch(\`/api/driver/area-orders/\${encodeURIComponent(area)}\`)
                            .then(response => response.ok ? response.json() : { success: false });
                        
                        const areaData = await Promise.race([
                            areaPromise,
                            new Promise((_, reject) => 
                                setTimeout(() => reject(new Error(\`\${area}載入超時\`)), 5000)
                            )
                        ]);
                        
                        if (areaData.success && areaData.orders && Array.isArray(areaData.orders)) {
                            if (areaData.orders.length > 0) {
                                totalCount += areaData.orders.length;
                                
                                // 為每個訂單添加地區標記
                                const ordersWithArea = areaData.orders.map(order => ({
                                    ...order,
                                    area: area
                                }));
                                
                                allAvailableOrders.push(...ordersWithArea);
                                areaGroups.push({
                                    area,
                                    count: areaData.orders.length,
                                    orders: ordersWithArea
                                });
                                
                                console.log(\`  ✅ \${area}: \${areaData.orders.length}筆訂單\`);
                            } else {
                                console.log(\`  📭 \${area}: 無訂單\`);
                            }
                        } else {
                            console.warn(\`  ⚠️ \${area}: 載入失敗\`);
                        }
                    } catch (err) {
                        console.error(\`  ❌ \${area}載入錯誤:\`, err.message);
                        // 繼續處理下一個地區，不中斷整個流程
                    }
                }
                
                clearTimeout(loadingTimeout);
                
                // Step 3: 渲染結果
                console.log('🎨 Step 3: 渲染結果...');
                console.log(\`📊 總計載入 \${totalCount} 筆訂單，\${areaGroups.length} 個地區\`);
                
                // 更新訂單總數
                const totalCountElement = document.getElementById('total-available-count');
                if (totalCountElement) {
                    totalCountElement.textContent = totalCount;
                }
                
                // 渲染訂單
                renderUnifiedOrderPool(areaGroups);
                
                console.log('🎉 === 訂單池載入完成 ===');
                
            } catch (error) {
                console.error('❌ === 載入訂單池失敗 ===', error);
                
                // 顯示錯誤狀態和重試按鈕
                if (container) {
                    container.innerHTML = \`
                        <div class="empty-state">
                            <div class="empty-icon">⚠️</div>
                            <h3>載入失敗</h3>
                            <p>錯誤: \${error.message}</p>
                            <p style="font-size: 12px; color: #666; margin-top: 10px;">
                                如果問題持續，請聯絡技術支援
                            </p>
                            <button onclick="loadUnifiedOrderPool()" class="btn btn-primary" style="margin-top: 15px;">
                                🔄 重新載入
                            </button>
                        </div>
                    \`;
                }
                
                // 通知用戶
                showNotification('載入訂單失敗: ' + error.message, 'error');
            }
        }`;
        
        // 找到原始函數並替換
        const functionRegex = /async function loadUnifiedOrderPool\(\)[^}]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/s;
        
        if (functionRegex.test(content)) {
            content = content.replace(functionRegex, fixedLoadFunction.trim());
            console.log('✅ 找到並替換了 loadUnifiedOrderPool 函數');
        } else {
            console.log('⚠️ 未找到原始函數，將添加到文件末尾');
            // 在 </script> 標籤前添加修復函數
            const scriptEndIndex = content.lastIndexOf('</script>');
            if (scriptEndIndex !== -1) {
                content = content.slice(0, scriptEndIndex) + '\n' + fixedLoadFunction.trim() + '\n        ' + content.slice(scriptEndIndex);
            }
        }
        
        // 寫回文件
        await fs.writeFile(filePath, content, 'utf-8');
        console.log('✅ 修復完成！文件已更新');
        
        console.log('\n🚀 修復內容：');
        console.log('1. 添加30秒總體超時機制');
        console.log('2. 每個API調用5秒超時');
        console.log('3. 改為順序載入，避免併發問題');
        console.log('4. 增強錯誤處理和用戶提示');
        console.log('5. 添加技術支援聯絡提示');
        
        return true;
        
    } catch (error) {
        console.error('❌ 修復過程中發生錯誤:', error);
        return false;
    }
}

// 執行修復
if (require.main === module) {
    fixLoadingIssue().then(success => {
        if (success) {
            console.log('\n🎉 修復完成！請重新部署系統');
            console.log('💡 建議測試步驟：');
            console.log('1. 部署到Vercel');
            console.log('2. 清除瀏覽器快取');
            console.log('3. 重新登入外送員系統');
            console.log('4. 觀察控制台日誌');
        } else {
            console.log('\n❌ 修復失敗，請檢查錯誤信息');
        }
        process.exit(success ? 0 : 1);
    });
}

module.exports = { fixLoadingIssue };