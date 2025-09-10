// 基於真實API端點的業務流程測試
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const baseURL = 'https://chengyivegetable-production-7b4a.up.railway.app';

class RealAPITester {
    constructor() {
        this.results = {};
        this.orderId = null;
    }

    log(test, message, status = 'info') {
        const emoji = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' }[status] || 'ℹ️';
        console.log(`${emoji} ${test}: ${message}`);
        if (!this.results[test]) this.results[test] = [];
        this.results[test].push({ message, status });
    }

    // 1. 測試顧客下單 (使用真實API)
    async testCustomerOrder() {
        console.log('\n🛒 測試顧客下單流程');
        console.log('─'.repeat(40));
        
        try {
            const orderData = {
                contact_name: '測試顧客',
                contact_phone: '0987654321',
                address: '台北市信義區信義路五段7號',
                notes: '測試訂單請忽略',
                items: [
                    { 
                        name: '高麗菜',
                        quantity: 2,
                        unit_price: 50.00,
                        line_total: 100.00
                    },
                    {
                        name: '白蘿蔔', 
                        quantity: 1,
                        unit_price: 30.00,
                        line_total: 30.00
                    }
                ],
                subtotal: 130.00,
                delivery_fee: 50.00,
                total: 180.00
            };

            const response = await fetch(`${baseURL}/api/orders`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(orderData)
            });

            const result = await response.json();
            
            if (result.success) {
                this.orderId = result.order_id;
                this.log('顧客下單', `✅ 下單成功！訂單編號: ${this.orderId}`, 'success');
                this.log('顧客下單', `訂單金額: $${orderData.total}`, 'info');
                return true;
            } else {
                this.log('顧客下單', `❌ 下單失敗: ${result.message}`, 'error');
                return false;
            }
        } catch (error) {
            this.log('顧客下單', `❌ 請求錯誤: ${error.message}`, 'error');
            return false;
        }
    }

    // 2. 測試商品API
    async testProductsAPI() {
        console.log('\n📦 測試商品管理');
        console.log('─'.repeat(40));
        
        try {
            const response = await fetch(`${baseURL}/api/products`);
            const result = await response.json();
            
            if (result.success) {
                this.log('商品API', `✅ 商品查詢成功，共 ${result.count} 個商品`, 'success');
                this.log('商品API', `模式: ${result.mode}`, 'info');
                
                // 顯示前3個商品
                if (result.products && result.products.length > 0) {
                    result.products.slice(0, 3).forEach((product, index) => {
                        this.log('商品API', `${index + 1}. ${product.name} - $${product.price} (${product.unit_hint})`, 'info');
                    });
                }
                return true;
            } else {
                this.log('商品API', '❌ 商品查詢失敗', 'error');
                return false;
            }
        } catch (error) {
            this.log('商品API', `❌ 請求錯誤: ${error.message}`, 'error');
            return false;
        }
    }

    // 3. 測試外送員功能
    async testDriverAPIs() {
        console.log('\n🚚 測試外送員系統');
        console.log('─'.repeat(40));
        
        let successCount = 0;
        let totalTests = 0;

        // 測試可用訂單查詢
        try {
            totalTests++;
            const response = await fetch(`${baseURL}/api/driver/available-orders`);
            const orders = await response.json();
            
            if (Array.isArray(orders)) {
                this.log('外送員API', `✅ 可用訂單查詢成功，共 ${orders.length} 個訂單`, 'success');
                successCount++;
            } else {
                this.log('外送員API', '⚠️ 可用訂單格式異常', 'warning');
            }
        } catch (error) {
            this.log('外送員API', `❌ 可用訂單查詢錯誤: ${error.message}`, 'error');
        }

        // 測試外送員統計
        try {
            totalTests++;
            const response = await fetch(`${baseURL}/api/driver/stats`);
            const stats = await response.json();
            
            if (stats) {
                this.log('外送員API', '✅ 外送員統計查詢成功', 'success');
                successCount++;
                if (stats.totalOrders !== undefined) {
                    this.log('外送員API', `總訂單數: ${stats.totalOrders}`, 'info');
                }
            }
        } catch (error) {
            this.log('外送員API', `❌ 統計查詢錯誤: ${error.message}`, 'error');
        }

        // 測試今日統計
        try {
            totalTests++;
            const response = await fetch(`${baseURL}/api/driver/today-stats`);
            const todayStats = await response.json();
            
            if (todayStats) {
                this.log('外送員API', '✅ 今日統計查詢成功', 'success');
                successCount++;
            }
        } catch (error) {
            this.log('外送員API', `❌ 今日統計錯誤: ${error.message}`, 'error');
        }

        return successCount === totalTests;
    }

    // 4. 測試管理功能
    async testAdminAPIs() {
        console.log('\n⚙️ 測試管理員功能');
        console.log('─'.repeat(40));

        // 測試路線規劃API
        try {
            const response = await fetch(`${baseURL}/api/smart-route/plans`);
            
            if (response.status === 401) {
                this.log('管理員API', '⚠️ 路線規劃需要管理員權限 (正常)', 'warning');
                return true; // 這是正常的，因為需要登入
            } else if (response.ok) {
                const plans = await response.json();
                this.log('管理員API', '✅ 路線規劃API可訪問', 'success');
                return true;
            } else {
                this.log('管理員API', `⚠️ 路線規劃回應: ${response.status}`, 'warning');
                return false;
            }
        } catch (error) {
            this.log('管理員API', `❌ 路線規劃錯誤: ${error.message}`, 'error');
            return false;
        }
    }

    // 5. 測試系統狀態
    async testSystemStatus() {
        console.log('\n🔧 測試系統狀態');
        console.log('─'.repeat(40));
        
        let successCount = 0;
        let totalTests = 0;

        // 測試版本API
        try {
            totalTests++;
            const response = await fetch(`${baseURL}/api/version`);
            const version = await response.json();
            
            if (version.version) {
                this.log('系統狀態', `✅ 版本: ${version.version}`, 'success');
                this.log('系統狀態', `提交: ${version.commit}`, 'info');
                this.log('系統狀態', `狀態: ${version.status}`, 'info');
                successCount++;
            }
        } catch (error) {
            this.log('系統狀態', `❌ 版本查詢錯誤: ${error.message}`, 'error');
        }

        // 測試前台頁面
        try {
            totalTests++;
            const response = await fetch(`${baseURL}/`);
            
            if (response.ok) {
                this.log('系統狀態', '✅ 前台頁面正常', 'success');
                successCount++;
            } else {
                this.log('系統狀態', `❌ 前台頁面異常: ${response.status}`, 'error');
            }
        } catch (error) {
            this.log('系統狀態', `❌ 前台頁面錯誤: ${error.message}`, 'error');
        }

        // 測試管理頁面
        try {
            totalTests++;
            const response = await fetch(`${baseURL}/admin`);
            
            if (response.ok) {
                this.log('系統狀態', '✅ 管理頁面正常', 'success');
                successCount++;
            } else {
                this.log('系統狀態', `❌ 管理頁面異常: ${response.status}`, 'error');
            }
        } catch (error) {
            this.log('系統狀態', `❌ 管理頁面錯誤: ${error.message}`, 'error');
        }

        // 測試外送員頁面
        try {
            totalTests++;
            const response = await fetch(`${baseURL}/driver`);
            
            if (response.ok) {
                this.log('系統狀態', '✅ 外送員頁面正常', 'success');
                successCount++;
            } else {
                this.log('系統狀態', `❌ 外送員頁面異常: ${response.status}`, 'error');
            }
        } catch (error) {
            this.log('系統狀態', `❌ 外送員頁面錯誤: ${error.message}`, 'error');
        }

        return successCount === totalTests;
    }

    // 執行所有測試
    async runAllTests() {
        console.log('🧪 開始系統功能全面測試');
        console.log('='.repeat(50));

        const tests = [
            { name: '系統狀態', method: this.testSystemStatus, weight: 4 },
            { name: '商品管理', method: this.testProductsAPI, weight: 1 },
            { name: '顧客下單', method: this.testCustomerOrder, weight: 1 },
            { name: '外送員系統', method: this.testDriverAPIs, weight: 3 },
            { name: '管理員功能', method: this.testAdminAPIs, weight: 1 }
        ];

        let totalScore = 0;
        let maxScore = 0;

        for (const test of tests) {
            maxScore += test.weight;
            const success = await test.method.call(this);
            if (success) {
                totalScore += test.weight;
            }
        }

        // 生成最終報告
        console.log('\n' + '='.repeat(50));
        console.log('📊 系統功能測試總報告');
        console.log('='.repeat(50));
        
        const successRate = Math.round((totalScore / maxScore) * 100);
        console.log(`🎯 整體成功率: ${successRate}%`);
        console.log(`📈 得分: ${totalScore}/${maxScore}`);
        
        if (this.orderId) {
            console.log(`📝 測試訂單編號: ${this.orderId}`);
        }

        // 系統狀態評估
        if (successRate >= 80) {
            console.log('✅ 系統狀態: 優秀 - 可投入商業使用');
        } else if (successRate >= 60) {
            console.log('⚠️ 系統狀態: 良好 - 建議修復部分功能後使用');
        } else {
            console.log('❌ 系統狀態: 需要改進 - 建議修復主要問題');
        }

        console.log('\n🌐 系統連結:');
        console.log(`前台: ${baseURL}/`);
        console.log(`管理: ${baseURL}/admin`);
        console.log(`外送: ${baseURL}/driver`);

        return { successRate, totalScore, maxScore };
    }
}

// 執行測試
const tester = new RealAPITester();
tester.runAllTests().catch(console.error);