#!/usr/bin/env node

/**
 * 修復正式版外送員系統 - 使用緊急版本的載入邏輯
 * 目標：將緊急版本的簡單可靠載入邏輯移植到正式版本
 */

const fs = require('fs').promises;
const path = require('path');

async function fixOfficialVersion() {
    console.log('🔧 開始修復正式版外送員系統...');
    
    const filePath = path.join(__dirname, 'views', 'driver_dashboard_simplified.ejs');
    
    try {
        // 讀取文件內容
        let content = await fs.readFile(filePath, 'utf-8');
        console.log('✅ 已讀取正式版文件');
        
        // 新的簡化載入函數 - 基於緊急版本的邏輯
        const newLoadFunction = `
        // 載入統一訂單池 - 最終修復版本 (基於緊急版本邏輯)
        async function loadUnifiedOrderPool() {
            console.log('🔄 開始載入訂單池（最終修復版）');
            
            const container = document.getElementById('unified-orders');
            if (!container) {
                console.error('❌ 找不到 unified-orders 容器');
                return;
            }
            
            // 顯示載入狀態
            container.innerHTML = '<div class="loading"><div class="loading-spinner"></div>正在載入訂單...</div>';
            
            try {
                console.log('📊 Step 1: 獲取訂單統計');
                const countResponse = await fetch('/api/driver/order-counts');
                
                if (!countResponse.ok) {
                    throw new Error(\`HTTP \${countResponse.status}: \${countResponse.statusText}\`);
                }
                
                const countData = await countResponse.json();
                console.log('✅ 訂單統計:', countData);
                
                if (!countData.success) {
                    throw new Error('訂單統計API返回失敗');
                }
                
                // 更新訂單總數
                const totalCountElement = document.getElementById('total-available-count');
                let totalCount = 0;
                if (countData.counts) {
                    totalCount = Object.values(countData.counts).reduce((a, b) => a + b, 0);
                    if (totalCountElement) {
                        totalCountElement.textContent = totalCount;
                    }
                }
                
                console.log(\`📊 總訂單數: \${totalCount}\`);
                
                // Step 2: 載入各地區訂單
                const areas = ['三峽區', '樹林區', '鶯歌區', '土城區', '北大特區'];
                let allOrders = [];
                const areaGroups = [];
                
                for (const area of areas) {
                    console.log(\`📍 載入 \${area} 訂單\`);
                    container.innerHTML = \`<div class="loading"><div class="loading-spinner"></div>載入 \${area} 中...</div>\`;
                    
                    try {
                        const areaResponse = await fetch(\`/api/driver/area-orders/\${encodeURIComponent(area)}\`);
                        
                        if (areaResponse.ok) {
                            const areaData = await areaResponse.json();
                            console.log(\`✅ \${area} 回應:\`, areaData);
                            
                            if (areaData.success && areaData.orders && Array.isArray(areaData.orders)) {
                                const ordersWithArea = areaData.orders.map(order => ({...order, area}));
                                allOrders.push(...ordersWithArea);
                                
                                if (areaData.orders.length > 0) {
                                    areaGroups.push({
                                        area,
                                        count: areaData.orders.length,
                                        orders: ordersWithArea
                                    });
                                }
                                
                                console.log(\`✅ \${area}: \${areaData.orders.length} 筆訂單\`);
                            } else {
                                console.log(\`⚠️ \${area}: 無訂單或格式錯誤\`);
                            }
                        } else {
                            console.log(\`❌ \${area}: HTTP \${areaResponse.status}\`);
                        }
                    } catch (areaError) {
                        console.error(\`❌ \${area} 錯誤:\`, areaError);
                    }
                }
                
                // 保存到全域變數
                window.allAvailableOrders = allOrders;
                
                console.log(\`🎨 渲染 \${allOrders.length} 筆訂單, \${areaGroups.length} 個地區\`);
                
                // Step 3: 渲染訂單
                if (areaGroups.length > 0) {
                    renderUnifiedOrderPool(areaGroups);
                } else {
                    container.innerHTML = \`
                        <div class="empty-state">
                            <div class="empty-icon">📭</div>
                            <h3>暫無可接訂單</h3>
                            <p>目前沒有需要配送的訂單</p>
                            <button onclick="loadUnifiedOrderPool()" class="btn btn-primary" style="margin-top: 15px;">
                                🔄 重新載入
                            </button>
                        </div>
                    \`;
                }
                
                console.log('🎉 訂單載入完成');
                
            } catch (error) {
                console.error('❌ 載入訂單失敗:', error);
                
                container.innerHTML = \`
                    <div class="empty-state">
                        <div class="empty-icon">⚠️</div>
                        <h3>載入失敗</h3>
                        <p>錯誤: \${error.message}</p>
                        <p style="font-size: 12px; color: #666; margin-top: 10px;">
                            時間: \${new Date().toLocaleTimeString()}<br>
                            請嘗試重新載入或聯絡技術支援
                        </p>
                        <button onclick="loadUnifiedOrderPool()" class="btn btn-primary" style="margin-top: 15px;">
                            🔄 重新載入
                        </button>
                    </div>
                \`;
                
                // 顯示通知
                if (typeof showNotification === 'function') {
                    showNotification('載入訂單失敗: ' + error.message, 'error');
                }
            }
        }`;
        
        // 找到並替換 loadUnifiedOrderPool 函數
        const functionPattern = /\/\/\s*載入統一訂單池[\s\S]*?async\s+function\s+loadUnifiedOrderPool\s*\(\)\s*\{[\s\S]*?\n\s*\}/;
        
        if (functionPattern.test(content)) {
            content = content.replace(functionPattern, newLoadFunction.trim());
            console.log('✅ 找到並替換了 loadUnifiedOrderPool 函數');
        } else {
            console.log('⚠️ 未找到原始函數模式，嘗試其他替換方式...');
            
            // 嘗試更寬泛的匹配
            const broadPattern = /async\s+function\s+loadUnifiedOrderPool\s*\(\)[\s\S]*?(?=\n\s*(?:\/\/|function|\s*$))/;
            
            if (broadPattern.test(content)) {
                content = content.replace(broadPattern, newLoadFunction.trim());
                console.log('✅ 使用寬泛模式替換了函數');
            } else {
                // 最後手段：在適當位置插入新函數
                const scriptEndIndex = content.lastIndexOf('</script>');
                if (scriptEndIndex !== -1) {
                    content = content.slice(0, scriptEndIndex) + '\n        ' + newLoadFunction.trim() + '\n\n        ' + content.slice(scriptEndIndex);
                    console.log('✅ 在腳本末尾添加了新函數');
                }
            }
        }
        
        // 寫回文件
        await fs.writeFile(filePath, content, 'utf-8');
        console.log('✅ 正式版本修復完成！');
        
        console.log('\n🎉 修復摘要：');
        console.log('1. ✅ 使用緊急版本的穩定載入邏輯');
        console.log('2. ✅ 簡化了載入流程，避免複雜的併發問題');
        console.log('3. ✅ 保留原有的UI和功能');
        console.log('4. ✅ 增強了錯誤處理和用戶反饋');
        console.log('5. ✅ 添加了詳細的載入進度顯示');
        
        return true;
        
    } catch (error) {
        console.error('❌ 修復過程中發生錯誤:', error);
        return false;
    }
}

// 執行修復
if (require.main === module) {
    fixOfficialVersion().then(success => {
        if (success) {
            console.log('\n🚀 正式版本修復完成！');
            console.log('📋 下一步：');
            console.log('1. git add .');
            console.log('2. git commit -m "🔧 正式版載入系統修復"');
            console.log('3. git push && vercel --prod');
            console.log('\n💡 修復後的正式版本應該能正常載入訂單了！');
        } else {
            console.log('\n❌ 修復失敗，請檢查錯誤信息');
        }
        process.exit(success ? 0 : 1);
    });
}

module.exports = { fixOfficialVersion };