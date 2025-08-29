/**
 * 簡化版外送員系統測試腳本
 * 測試新的地區分類接單功能
 */

const axios = require('axios');

// 測試配置
const BASE_URL = 'http://localhost:3003';
const TEST_DRIVER = {
    phone: '0912345678',
    password: 'password123'
};

class DriverSystemTester {
    constructor() {
        this.sessionCookie = null;
    }

    async runAllTests() {
        console.log('🚀 開始測試簡化版外送員系統...\n');

        try {
            // 1. 測試外送員登入
            await this.testDriverLogin();
            
            // 2. 測試地區訂單數量API
            await this.testOrderCounts();
            
            // 3. 測試特定地區訂單API
            await this.testAreaOrders();
            
            // 4. 測試批次接單API
            await this.testAcceptOrders();
            
            // 5. 測試我的配送訂單API
            await this.testMyOrders();
            
            // 6. 測試路線優化API
            await this.testRouteOptimization();
            
            // 7. 測試外送員統計API
            await this.testDriverStats();

            console.log('\n✅ 所有測試完成！簡化版外送員系統運作正常');

        } catch (error) {
            console.error('❌ 測試失敗:', error.message);
            if (error.response) {
                console.error('響應狀態:', error.response.status);
                console.error('響應數據:', error.response.data);
            }
        }
    }

    async testDriverLogin() {
        console.log('📝 測試 1: 外送員登入...');
        
        try {
            const response = await axios.post(`${BASE_URL}/driver/login`, TEST_DRIVER);
            
            // 在示範模式下，登入可能會重定向
            if (response.status === 200 || response.status === 302) {
                console.log('  ✅ 登入測試通過');
                
                // 提取 session cookie (如果有的話)
                if (response.headers['set-cookie']) {
                    this.sessionCookie = response.headers['set-cookie'][0];
                    console.log('  🍪 Session cookie已獲取');
                }
            }
        } catch (error) {
            if (error.response && error.response.status === 302) {
                console.log('  ✅ 登入測試通過 (重定向)');
            } else {
                throw error;
            }
        }
    }

    async testOrderCounts() {
        console.log('📊 測試 2: 地區訂單數量API...');
        
        const response = await axios.get(`${BASE_URL}/api/driver/order-counts`, {
            headers: this.getHeaders()
        });

        if (response.data.success && response.data.counts) {
            console.log('  ✅ 訂單數量API測試通過');
            console.log('  📋 地區訂單數量:');
            
            Object.entries(response.data.counts).forEach(([area, count]) => {
                console.log(`    • ${area}: ${count} 筆`);
            });
        } else {
            throw new Error('訂單數量API響應格式錯誤');
        }
    }

    async testAreaOrders() {
        console.log('📍 測試 3: 特定地區訂單API...');
        
        const testArea = '三峽區';
        const response = await axios.get(`${BASE_URL}/api/driver/area-orders/${encodeURIComponent(testArea)}`, {
            headers: this.getHeaders()
        });

        if (response.data.success) {
            console.log(`  ✅ ${testArea}訂單API測試通過`);
            console.log(`  📦 找到 ${response.data.orders.length} 筆訂單`);
            
            if (response.data.orders.length > 0) {
                const order = response.data.orders[0];
                console.log(`  📋 示範訂單 #${order.id}: ${order.customer_name} - ${order.address}`);
            }
        } else {
            throw new Error(`${testArea}訂單API響應格式錯誤`);
        }
    }

    async testAcceptOrders() {
        console.log('✅ 測試 4: 批次接單API...');
        
        // 先獲取一些訂單ID進行測試
        const areaResponse = await axios.get(`${BASE_URL}/api/driver/area-orders/三峽區`, {
            headers: this.getHeaders()
        });

        if (areaResponse.data.orders.length > 0) {
            const orderIds = areaResponse.data.orders.slice(0, 2).map(order => order.id);
            
            const response = await axios.post(`${BASE_URL}/api/driver/batch-accept-orders`, {
                orderIds: orderIds
            }, {
                headers: this.getHeaders()
            });

            if (response.data.success) {
                console.log('  ✅ 批次接單API測試通過');
                console.log(`  📦 成功接取 ${response.data.acceptedCount} 筆訂單`);
            } else {
                throw new Error('批次接單API測試失敗');
            }
        } else {
            console.log('  ⚠️ 沒有可用訂單進行批次接單測試');
        }
    }

    async testMyOrders() {
        console.log('🚛 測試 5: 我的配送訂單API...');
        
        const response = await axios.get(`${BASE_URL}/api/driver/my-orders`, {
            headers: this.getHeaders()
        });

        if (response.data.success) {
            console.log('  ✅ 我的配送訂單API測試通過');
            console.log(`  📦 當前配送訂單: ${response.data.orders.length} 筆`);
            
            response.data.orders.forEach((order, index) => {
                console.log(`    ${index + 1}. #${order.id} - ${order.customer_name}`);
            });
        } else {
            throw new Error('我的配送訂單API響應格式錯誤');
        }
    }

    async testRouteOptimization() {
        console.log('🧭 測試 6: 路線優化API...');
        
        // 使用測試訂單ID
        const testOrderIds = [1001, 1002, 1003];
        
        try {
            const response = await axios.post(`${BASE_URL}/api/driver/optimize-route`, {
                orderIds: testOrderIds
            }, {
                headers: this.getHeaders()
            });

            if (response.data.success) {
                console.log('  ✅ 路線優化API測試通過');
                console.log(`  ⏱️ 預計節省時間: ${response.data.timeSaved} 分鐘`);
                
                if (response.data.routeUrl) {
                    console.log('  🗺️ 路線URL已生成');
                }
            } else {
                throw new Error('路線優化API測試失敗');
            }
        } catch (error) {
            if (error.response && error.response.status === 400) {
                console.log('  ⚠️ 路線優化測試: 訂單數量不足 (預期行為)');
            } else {
                throw error;
            }
        }
    }

    async testDriverStats() {
        console.log('📊 測試 7: 外送員統計API...');
        
        const response = await axios.get(`${BASE_URL}/api/driver/stats`, {
            headers: this.getHeaders()
        });

        if (response.data.success) {
            console.log('  ✅ 外送員統計API測試通過');
            console.log('  📈 統計數據:');
            console.log(`    • 今日完成: ${response.data.todayCompleted} 筆`);
            console.log(`    • 今日收入: $${response.data.todayEarnings}`);
            console.log(`    • 平均配送時間: ${response.data.avgDeliveryTime} 分鐘`);
        } else {
            throw new Error('外送員統計API響應格式錯誤');
        }
    }

    getHeaders() {
        const headers = {
            'Content-Type': 'application/json',
            'User-Agent': 'DriverSystemTester/1.0'
        };

        if (this.sessionCookie) {
            headers['Cookie'] = this.sessionCookie;
        }

        return headers;
    }
}

// 執行測試
const tester = new DriverSystemTester();
tester.runAllTests().catch(console.error);