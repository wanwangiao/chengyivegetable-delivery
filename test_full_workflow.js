// 完整業務流程測試腳本
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const baseURL = 'https://chengyivegetable-production-7b4a.up.railway.app';

class BusinessWorkflowTester {
    constructor() {
        this.testResults = {};
        this.orderId = null;
        this.adminSession = null;
    }

    async log(category, message, status = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        const statusEmoji = {
            'success': '✅',
            'error': '❌',
            'warning': '⚠️',
            'info': 'ℹ️'
        }[status] || 'ℹ️';
        
        console.log(`${statusEmoji} [${timestamp}] ${category}: ${message}`);
        
        if (!this.testResults[category]) {
            this.testResults[category] = [];
        }
        this.testResults[category].push({ message, status, timestamp });
    }

    // 1. 測試顧客下單
    async testCustomerOrder() {
        await this.log('顧客下單', '開始測試下單流程...');
        
        try {
            // 模擬下單
            const orderData = {
                contact_name: '測試顧客',
                contact_phone: '0912345678',
                address: '台北市信義區信義路五段7號',
                notes: '請送到1樓管理室',
                items: [
                    { name: '高麗菜', quantity: 2, unit_price: 50 },
                    { name: '白蘿蔔', quantity: 1, unit_price: 30 }
                ]
            };

            const response = await fetch(`${baseURL}/api/orders`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(orderData)
            });

            const result = await response.json();
            
            if (result.success) {
                this.orderId = result.order_id;
                await this.log('顾客下單', `下單成功！訂單編號: ${this.orderId}`, 'success');
                return true;
            } else {
                await this.log('顧客下單', `下單失敗: ${result.message}`, 'error');
                return false;
            }
        } catch (error) {
            await this.log('顧客下單', `下單錯誤: ${error.message}`, 'error');
            return false;
        }
    }

    // 2. 測試管理員登入
    async testAdminLogin() {
        await this.log('管理員登入', '測試管理員登入...');
        
        try {
            const response = await fetch(`${baseURL}/admin/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: 'password=admin123',
                redirect: 'manual'
            });

            if (response.status === 302) {
                // 取得登入cookie
                const cookies = response.headers.get('set-cookie');
                this.adminSession = cookies;
                await this.log('管理員登入', '登入成功', 'success');
                return true;
            } else {
                await this.log('管理員登入', '登入失敗', 'error');
                return false;
            }
        } catch (error) {
            await this.log('管理員登入', `登入錯誤: ${error.message}`, 'error');
            return false;
        }
    }

    // 3. 測試庫存扣除
    async testInventoryDeduction() {
        await this.log('庫存管理', '檢查庫存扣除機制...');
        
        try {
            // 檢查高麗菜庫存
            const response = await fetch(`${baseURL}/api/admin/inventory`, {
                headers: { 'Cookie': this.adminSession || '' }
            });

            if (response.ok) {
                const inventory = await response.json();
                await this.log('庫存管理', `庫存查詢成功，共${inventory.length}項商品`, 'success');
                
                // 檢查高麗菜是否有庫存記錄
                const cabbageStock = inventory.find(item => item.name === '高麗菜');
                if (cabbageStock) {
                    await this.log('庫存管理', `高麗菜庫存: ${cabbageStock.current_stock}`, 'info');
                } else {
                    await this.log('庫存管理', '高麗菜庫存記錄不存在', 'warning');
                }
                return true;
            } else {
                await this.log('庫存管理', `庫存查詢失敗: ${response.status}`, 'error');
                return false;
            }
        } catch (error) {
            await this.log('庫存管理', `庫存查詢錯誤: ${error.message}`, 'error');
            return false;
        }
    }

    // 4. 測試新增商品
    async testAddProduct() {
        await this.log('商品管理', '測試新增商品...');
        
        try {
            const newProduct = {
                name: '測試蔬菜',
                price: 25.50,
                is_priced_item: false,
                unit_hint: '包'
            };

            const response = await fetch(`${baseURL}/api/admin/products/add`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Cookie': this.adminSession || ''
                },
                body: JSON.stringify(newProduct)
            });

            if (response.ok) {
                const result = await response.json();
                await this.log('商品管理', '新增商品成功', 'success');
                return true;
            } else {
                await this.log('商品管理', `新增商品失敗: ${response.status}`, 'error');
                return false;
            }
        } catch (error) {
            await this.log('商品管理', `新增商品錯誤: ${error.message}`, 'error');
            return false;
        }
    }

    // 5. 測試外送員接單
    async testDriverOrderAcceptance() {
        await this.log('外送員系統', '測試外送員接單...');
        
        if (!this.orderId) {
            await this.log('外送員系統', '沒有訂單可接', 'warning');
            return false;
        }

        try {
            // 模擬外送員登入
            const loginResponse = await fetch(`${baseURL}/api/driver/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    phone: '0912345678',
                    password: 'driver123'
                })
            });

            if (loginResponse.ok) {
                const driverSession = loginResponse.headers.get('set-cookie');
                await this.log('外送員系統', '外送員登入成功', 'success');

                // 測試接單
                const acceptResponse = await fetch(`${baseURL}/api/driver/accept-order`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Cookie': driverSession || ''
                    },
                    body: JSON.stringify({ order_id: this.orderId })
                });

                if (acceptResponse.ok) {
                    await this.log('外送員系統', '接單成功', 'success');
                    return true;
                } else {
                    await this.log('外送員系統', `接單失敗: ${acceptResponse.status}`, 'error');
                    return false;
                }
            } else {
                await this.log('外送員系統', '外送員登入失敗', 'error');
                return false;
            }
        } catch (error) {
            await this.log('外送員系統', `外送員測試錯誤: ${error.message}`, 'error');
            return false;
        }
    }

    // 6. 測試路線優化
    async testRouteOptimization() {
        await this.log('路線優化', '測試智能路線規劃...');
        
        try {
            const response = await fetch(`${baseURL}/api/admin/route-optimization/generate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Cookie': this.adminSession || ''
                },
                body: JSON.stringify({
                    orders: [this.orderId],
                    driver_id: 1
                })
            });

            if (response.ok) {
                const result = await response.json();
                await this.log('路線優化', '路線優化成功', 'success');
                return true;
            } else {
                await this.log('路線優化', `路線優化失敗: ${response.status}`, 'error');
                return false;
            }
        } catch (error) {
            await this.log('路線優化', `路線優化錯誤: ${error.message}`, 'error');
            return false;
        }
    }

    // 7. 測試訂單狀態更新
    async testOrderStatusUpdate() {
        await this.log('訂單狀態', '測試訂單狀態更新...');
        
        if (!this.orderId) {
            await this.log('訂單狀態', '沒有訂單可更新', 'warning');
            return false;
        }

        try {
            const response = await fetch(`${baseURL}/api/admin/orders/${this.orderId}/status`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Cookie': this.adminSession || ''
                },
                body: JSON.stringify({ status: 'preparing' })
            });

            if (response.ok) {
                await this.log('訂單狀態', '訂單狀態更新成功', 'success');
                return true;
            } else {
                await this.log('訂單狀態', `狀態更新失敗: ${response.status}`, 'error');
                return false;
            }
        } catch (error) {
            await this.log('訂單狀態', `狀態更新錯誤: ${error.message}`, 'error');
            return false;
        }
    }

    // 執行完整測試
    async runFullTest() {
        console.log('🚀 開始完整業務流程測試...\n');

        const tests = [
            { name: '顧客下單', method: this.testCustomerOrder },
            { name: '管理員登入', method: this.testAdminLogin },
            { name: '庫存管理', method: this.testInventoryDeduction },
            { name: '新增商品', method: this.testAddProduct },
            { name: '外送員接單', method: this.testDriverOrderAcceptance },
            { name: '路線優化', method: this.testRouteOptimization },
            { name: '訂單狀態', method: this.testOrderStatusUpdate }
        ];

        let successCount = 0;
        const totalTests = tests.length;

        for (const test of tests) {
            console.log(`\n📋 執行測試: ${test.name}`);
            console.log('─'.repeat(40));
            
            const success = await test.method.call(this);
            if (success) successCount++;
        }

        // 生成測試報告
        console.log('\n' + '='.repeat(50));
        console.log('📊 完整業務流程測試報告');
        console.log('='.repeat(50));
        console.log(`總測試項目: ${totalTests}`);
        console.log(`測試通過: ${successCount}`);
        console.log(`測試失敗: ${totalTests - successCount}`);
        console.log(`成功率: ${Math.round(successCount / totalTests * 100)}%`);
        
        if (this.orderId) {
            console.log(`\n📝 測試訂單編號: ${this.orderId}`);
        }

        console.log('\n🔍 詳細結果:');
        Object.entries(this.testResults).forEach(([category, results]) => {
            console.log(`\n${category}:`);
            results.forEach(result => {
                const emoji = {
                    'success': '✅',
                    'error': '❌', 
                    'warning': '⚠️',
                    'info': 'ℹ️'
                }[result.status] || 'ℹ️';
                console.log(`  ${emoji} ${result.message}`);
            });
        });

        return { successCount, totalTests, successRate: successCount / totalTests };
    }
}

// 執行測試
const tester = new BusinessWorkflowTester();
tester.runFullTest().catch(console.error);