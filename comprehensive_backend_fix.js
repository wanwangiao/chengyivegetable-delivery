/**
 * 🔧 後台系統完整修復腳本
 * 解決訂單、商品管理、資料庫一致性問題
 */

const axios = require('axios');
const { Pool } = require('pg');
require('dotenv').config();

const BASE_URL = 'https://chengyivegetable-production-7b4a.up.railway.app';

console.log('🔧 後台系統完整修復腳本');
console.log('📅 執行時間:', new Date().toLocaleString('zh-TW'));
console.log('═══════════════════════════════════════════════════════');

// 1. 檢查demo模式狀態
async function checkDemoModeStatus() {
    console.log('\n🎭 1. 檢查示範模式狀態');
    console.log('─────────────────────────────');
    
    try {
        // 檢查後台API訂單返回
        const adminResponse = await axios.get(`${BASE_URL}/api/admin/orders`, {
            timeout: 10000,
            validateStatus: (status) => status < 500
        });
        
        if (adminResponse.status === 200) {
            const data = adminResponse.data;
            
            if (data.orders && data.orders.length > 0) {
                console.log(`⚠️ 後台顯示 ${data.orders.length} 筆訂單`);
                
                // 分析訂單內容
                const sampleOrder = data.orders[0];
                const customerName = sampleOrder.contact_name || sampleOrder.customer_name || '';
                
                const fakeDataIndicators = ['王小明', '李小華', '張小美', '陳大明', '測試客戶', 'test', 'demo', '示範'];
                const isFakeData = fakeDataIndicators.some(indicator => customerName.includes(indicator));
                
                if (isFakeData) {
                    console.log('🎭 確認：這些是示範/假資料');
                    return { status: 'demo_data_found', orders: data.orders };
                } else {
                    console.log('✅ 看起來是真實客戶訂單');
                    return { status: 'real_data', orders: data.orders };
                }
            } else {
                console.log('✅ 後台沒有訂單（符合預期）');
                return { status: 'no_orders', orders: [] };
            }
        } else if (adminResponse.status === 401) {
            console.log('🔐 後台需要認證（正常安全機制）');
            return { status: 'needs_auth' };
        }
        
    } catch (error) {
        console.error('❌ 檢查demo模式失敗:', error.message);
        return { status: 'error', error: error.message };
    }
}

// 2. 檢查商品管理頁面狀態
async function checkProductsPage() {
    console.log('\n🛍️ 2. 檢查商品管理頁面');
    console.log('──────────────────────────');
    
    try {
        // 檢查商品頁面是否可訪問
        const productsResponse = await axios.get(`${BASE_URL}/admin/products`, {
            timeout: 10000,
            validateStatus: (status) => status < 500,
            maxRedirects: 0 // 不跟隨重定向
        });
        
        if (productsResponse.status === 200) {
            console.log('✅ 商品管理頁面可正常訪問');
            return { status: 'accessible' };
        } else if (productsResponse.status === 302) {
            console.log('🔄 商品管理頁面需要認證（重定向到登入頁面）');
            return { status: 'needs_auth' };
        } else {
            console.log(`⚠️ 商品管理頁面返回狀態碼: ${productsResponse.status}`);
            return { status: 'error', code: productsResponse.status };
        }
        
    } catch (error) {
        if (error.response && error.response.status === 302) {
            console.log('🔄 商品管理頁面需要認證（重定向到登入頁面）');
            return { status: 'needs_auth' };
        }
        
        console.error('❌ 檢查商品管理頁面失敗:', error.message);
        return { status: 'error', error: error.message };
    }
}

// 3. 檢查外送員系統狀態
async function checkDriverSystem() {
    console.log('\n🚚 3. 檢查外送員系統狀態');
    console.log('───────────────────────────');
    
    try {
        // 檢查外送員訂單計數API
        const driverResponse = await axios.get(`${BASE_URL}/api/driver/order-counts`, {
            timeout: 10000
        });
        
        if (driverResponse.status === 200) {
            const data = driverResponse.data;
            console.log('✅ 外送員系統正常運行');
            console.log(`📊 可接取訂單數: ${data.available || 0}`);
            console.log(`📊 進行中訂單: ${data.in_progress || 0}`);
            console.log(`📊 已完成訂單: ${data.completed || 0}`);
            
            return {
                status: 'working',
                available: data.available || 0,
                in_progress: data.in_progress || 0,
                completed: data.completed || 0
            };
        }
        
    } catch (error) {
        console.error('❌ 檢查外送員系統失敗:', error.message);
        return { status: 'error', error: error.message };
    }
}

// 4. 驗證系統一致性
async function verifySystemConsistency(demoResult, productsResult, driverResult) {
    console.log('\n🔍 4. 系統一致性分析');
    console.log('────────────────────────');
    
    const issues = [];
    const recommendations = [];
    
    // 分析demo模式狀態
    if (demoResult.status === 'demo_data_found') {
        issues.push('後台仍然顯示示範/假資料');
        recommendations.push('清理假資料，確保系統完全切換到真實模式');
    } else if (demoResult.status === 'no_orders') {
        console.log('✅ 後台訂單狀態正確（空資料）');
    }
    
    // 分析商品管理頁面
    if (productsResult.status === 'needs_auth') {
        console.log('✅ 商品管理頁面有正確的認證保護');
    } else if (productsResult.status === 'error') {
        issues.push('商品管理頁面無法正常訪問');
        recommendations.push('檢查路由和模板文件是否正確');
    }
    
    // 分析外送員系統
    if (driverResult.status === 'working') {
        if (driverResult.available === 0) {
            console.log('✅ 外送員系統正常，沒有可接取訂單（符合預期）');
        } else {
            console.log(`⚠️ 外送員系統顯示 ${driverResult.available} 筆可接取訂單`);
        }
    } else {
        issues.push('外送員系統無法正常運行');
        recommendations.push('檢查外送員API和資料庫連接');
    }
    
    return { issues, recommendations };
}

// 5. 生成SQL清理腳本
function generateCleanupSQL() {
    console.log('\n🧹 5. 資料庫清理腳本');
    console.log('─────────────────────');
    
    const sqlScript = `
-- 清理示範/假資料的SQL腳本
-- 請在Railway PostgreSQL中執行

-- 1. 檢查現有訂單中的假資料
SELECT id, customer_name, contact_name, address, status, created_at 
FROM orders 
WHERE customer_name ILIKE '%王小明%' 
   OR customer_name ILIKE '%李小華%' 
   OR customer_name ILIKE '%張小美%' 
   OR customer_name ILIKE '%陳大明%'
   OR customer_name ILIKE '%測試客戶%'
   OR customer_name ILIKE '%test%'
   OR customer_name ILIKE '%demo%'
   OR customer_name ILIKE '%示範%'
   OR contact_name ILIKE '%王小明%' 
   OR contact_name ILIKE '%李小華%' 
   OR contact_name ILIKE '%張小美%' 
   OR contact_name ILIKE '%陳大明%'
   OR contact_name ILIKE '%測試客戶%'
   OR contact_name ILIKE '%test%'
   OR contact_name ILIKE '%demo%'
   OR contact_name ILIKE '%示範%';

-- 2. 刪除假資料訂單（請先確認上面的查詢結果）
-- DELETE FROM orders 
-- WHERE customer_name ILIKE '%王小明%' 
--    OR customer_name ILIKE '%李小華%' 
--    OR customer_name ILIKE '%張小美%' 
--    OR customer_name ILIKE '%陳大明%'
--    OR customer_name ILIKE '%測試客戶%'
--    OR customer_name ILIKE '%test%'
--    OR customer_name ILIKE '%demo%'
--    OR customer_name ILIKE '%示範%'
--    OR contact_name ILIKE '%王小明%' 
--    OR contact_name ILIKE '%李小華%' 
--    OR contact_name ILIKE '%張小美%' 
--    OR contact_name ILIKE '%陳大明%'
--    OR contact_name ILIKE '%測試客戶%'
--    OR contact_name ILIKE '%test%'
--    OR contact_name ILIKE '%demo%'
--    OR contact_name ILIKE '%示範%';

-- 3. 檢查products表是否有數據
SELECT COUNT(*) as product_count FROM products;
SELECT id, name, price, is_priced_item FROM products LIMIT 10;

-- 4. 創建測試訂單（如需要）
-- INSERT INTO orders (customer_name, contact_name, contact_phone, address, status, driver_id, total_amount, created_at)
-- VALUES ('真實測試客戶', '張先生', '0912345678', '新北市三峽區中山路123號', 'packed', NULL, 150, NOW());

-- 5. 驗證修復結果
SELECT status, COUNT(*) as count FROM orders GROUP BY status;
SELECT 
    COUNT(*) as total_orders,
    COUNT(CASE WHEN status = 'packed' AND driver_id IS NULL THEN 1 END) as available_for_delivery
FROM orders;
`;
    
    console.log('📝 生成的SQL清理腳本:');
    console.log(sqlScript);
    
    return sqlScript;
}

// 6. 生成修復報告
function generateFixReport(demoResult, productsResult, driverResult, consistency) {
    console.log('\n📋 6. 修復報告');
    console.log('─────────────────');
    
    const report = {
        timestamp: new Date().toISOString(),
        demo_mode_status: demoResult.status,
        products_page_status: productsResult.status,
        driver_system_status: driverResult.status,
        issues_found: consistency.issues,
        recommendations: consistency.recommendations,
        system_health: 'unknown'
    };
    
    // 評估系統健康狀態
    if (consistency.issues.length === 0) {
        report.system_health = 'healthy';
        console.log('🟢 系統狀態: 健康');
        console.log('✅ 沒有發現重大問題');
    } else if (consistency.issues.length <= 2) {
        report.system_health = 'minor_issues';
        console.log('🟡 系統狀態: 輕微問題');
        console.log(`⚠️ 發現 ${consistency.issues.length} 個問題需要處理`);
    } else {
        report.system_health = 'needs_attention';
        console.log('🔴 系統狀態: 需要注意');
        console.log(`❌ 發現 ${consistency.issues.length} 個問題需要立即處理`);
    }
    
    console.log('\n📊 詳細發現:');
    if (consistency.issues.length > 0) {
        console.log('問題清單:');
        consistency.issues.forEach((issue, index) => {
            console.log(`  ${index + 1}. ${issue}`);
        });
    }
    
    if (consistency.recommendations.length > 0) {
        console.log('\n💡 建議操作:');
        consistency.recommendations.forEach((rec, index) => {
            console.log(`  ${index + 1}. ${rec}`);
        });
    }
    
    return report;
}

// 7. 主要執行函數
async function main() {
    try {
        console.log('🚀 開始執行後台系統檢查...\n');
        
        // 執行各項檢查
        const demoResult = await checkDemoModeStatus();
        const productsResult = await checkProductsPage();
        const driverResult = await checkDriverSystem();
        
        // 分析系統一致性
        const consistency = await verifySystemConsistency(demoResult, productsResult, driverResult);
        
        // 生成清理腳本
        const sqlScript = generateCleanupSQL();
        
        // 生成最終報告
        const report = generateFixReport(demoResult, productsResult, driverResult, consistency);
        
        console.log('\n🏆 檢查完成');
        console.log('═══════════════════════════════════════════════════════');
        console.log('📄 完整報告已生成');
        console.log('🧹 SQL清理腳本已準備就緒');
        console.log('');
        console.log('🎯 後續行動建議:');
        console.log('1. 使用管理員帳號登入後台確認狀態');
        console.log('2. 如有假資料，執行提供的SQL清理腳本');
        console.log('3. 在前台建立一筆真實測試訂單');
        console.log('4. 測試完整的訂單流程（下單→確認→打包→外送）');
        
    } catch (error) {
        console.error('\n💥 執行過程中發生錯誤:', error.message);
        console.log('\n🔧 錯誤處理建議:');
        console.log('1. 檢查網路連接');
        console.log('2. 確認系統URL正確');
        console.log('3. 檢查Railway服務狀態');
    }
}

// 執行修復腳本
main();