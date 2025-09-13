#!/usr/bin/env node
/**
 * Railway 修復結果測試腳本
 * 用於驗證修復腳本是否成功執行
 */

const { Pool } = require('pg');

class RailwayFixTester {
    constructor() {
        this.pool = null;
        this.testResults = [];
    }

    async setupConnection() {
        console.log('🔧 建立測試資料庫連線...');
        
        if (process.env.DATABASE_URL) {
            this.pool = new Pool({
                connectionString: process.env.DATABASE_URL,
                ssl: { rejectUnauthorized: false },
                connectionTimeoutMillis: 30000
            });
            
            const client = await this.pool.connect();
            await client.query('SELECT 1');
            client.release();
            
            console.log('✅ 資料庫連線成功');
            return true;
        } else {
            console.log('❌ DATABASE_URL 環境變數未設定');
            return false;
        }
    }

    async testTableStructure() {
        console.log('\n📋 測試表格結構...');
        const client = await this.pool.connect();
        
        const tests = [
            {
                name: 'orders 表鎖定欄位',
                query: `
                    SELECT column_name 
                    FROM information_schema.columns 
                    WHERE table_name = 'orders' 
                    AND column_name IN ('locked_by', 'locked_at', 'lock_expires_at')
                `,
                expected: 3,
                test: (result) => result.rows.length === 3
            },
            {
                name: 'offline_queue 表',
                query: `
                    SELECT EXISTS (
                        SELECT FROM information_schema.tables 
                        WHERE table_schema = 'public' AND table_name = 'offline_queue'
                    )
                `,
                expected: true,
                test: (result) => result.rows[0].exists === true
            },
            {
                name: 'delivery_photos 表',
                query: `
                    SELECT EXISTS (
                        SELECT FROM information_schema.tables 
                        WHERE table_schema = 'public' AND table_name = 'delivery_photos'
                    )
                `,
                expected: true,
                test: (result) => result.rows[0].exists === true
            },
            {
                name: 'delivery_problems 表',
                query: `
                    SELECT EXISTS (
                        SELECT FROM information_schema.tables 
                        WHERE table_schema = 'public' AND table_name = 'delivery_problems'
                    )
                `,
                expected: true,
                test: (result) => result.rows[0].exists === true
            },
            {
                name: 'drivers 表',
                query: `
                    SELECT EXISTS (
                        SELECT FROM information_schema.tables 
                        WHERE table_schema = 'public' AND table_name = 'drivers'
                    )
                `,
                expected: true,
                test: (result) => result.rows[0].exists === true
            }
        ];

        for (const test of tests) {
            try {
                const result = await client.query(test.query);
                const passed = test.test(result);
                
                this.testResults.push({
                    name: test.name,
                    passed: passed,
                    result: passed ? '✅ 通過' : '❌ 失敗',
                    details: `預期: ${test.expected}, 實際: ${JSON.stringify(result.rows)}`
                });
                
                console.log(`${passed ? '✅' : '❌'} ${test.name}: ${passed ? '通過' : '失敗'}`);
                
            } catch (error) {
                this.testResults.push({
                    name: test.name,
                    passed: false,
                    result: '❌ 錯誤',
                    details: error.message
                });
                console.log(`❌ ${test.name}: 錯誤 - ${error.message}`);
            }
        }
        
        client.release();
    }

    async testDataIntegrity() {
        console.log('\n📊 測試資料完整性...');
        const client = await this.pool.connect();
        
        const tests = [
            {
                name: '測試外送員帳號',
                query: `SELECT COUNT(*) FROM drivers WHERE phone = '0912345678'`,
                test: (result) => parseInt(result.rows[0].count) > 0,
                description: '檢查測試外送員是否存在'
            },
            {
                name: '測試訂單',
                query: `SELECT COUNT(*) FROM orders WHERE order_number LIKE 'TEST%'`,
                test: (result) => parseInt(result.rows[0].count) >= 3,
                description: '檢查測試訂單是否存在'
            },
            {
                name: 'orders 表索引',
                query: `
                    SELECT indexname 
                    FROM pg_indexes 
                    WHERE tablename = 'orders' 
                    AND indexname IN ('idx_orders_locked_by', 'idx_orders_lock_expires')
                `,
                test: (result) => result.rows.length >= 1,
                description: '檢查訂單表索引'
            }
        ];

        for (const test of tests) {
            try {
                const result = await client.query(test.query);
                const passed = test.test(result);
                
                this.testResults.push({
                    name: test.name,
                    passed: passed,
                    result: passed ? '✅ 通過' : '❌ 失敗',
                    details: test.description
                });
                
                console.log(`${passed ? '✅' : '❌'} ${test.name}: ${passed ? '通過' : '失敗'}`);
                
            } catch (error) {
                this.testResults.push({
                    name: test.name,
                    passed: false,
                    result: '❌ 錯誤',
                    details: error.message
                });
                console.log(`❌ ${test.name}: 錯誤 - ${error.message}`);
            }
        }
        
        client.release();
    }

    async testAPIEndpoints() {
        console.log('\n🔌 測試 API 端點...');
        
        // 這裡只是模擬測試，實際上需要啟動伺服器才能測試
        const mockTests = [
            {
                name: '外送員登入 API',
                endpoint: '/api/driver-simplified/login',
                expected: '應該可以接受外送員登入請求'
            },
            {
                name: '訂單列表 API',
                endpoint: '/api/driver-simplified/order-counts',
                expected: '應該回傳各地區訂單數量'
            },
            {
                name: '接取訂單 API',
                endpoint: '/api/driver-simplified/take-orders',
                expected: '應該可以接取訂單'
            }
        ];

        for (const test of mockTests) {
            this.testResults.push({
                name: test.name,
                passed: null, // 無法實際測試
                result: '⚠️ 需要伺服器運行',
                details: test.expected
            });
            
            console.log(`⚠️ ${test.name}: 需要伺服器運行才能測試`);
        }
    }

    generateReport() {
        console.log('\n' + '='.repeat(60));
        console.log('📊 Railway 修復驗證報告');
        console.log('='.repeat(60));
        
        const passed = this.testResults.filter(t => t.passed === true).length;
        const failed = this.testResults.filter(t => t.passed === false).length;
        const skipped = this.testResults.filter(t => t.passed === null).length;
        
        console.log(`✅ 通過測試: ${passed}`);
        console.log(`❌ 失敗測試: ${failed}`);
        console.log(`⚠️ 跳過測試: ${skipped}`);
        console.log(`📋 總計測試: ${this.testResults.length}`);
        
        if (failed > 0) {
            console.log('\n🚨 失敗測試詳情:');
            this.testResults
                .filter(t => t.passed === false)
                .forEach((test, index) => {
                    console.log(`${index + 1}. ${test.name}: ${test.details}`);
                });
        }
        
        console.log('\n📝 建議步驟:');
        if (failed === 0) {
            console.log('🎉 所有測試通過！系統應該可以正常運行');
            console.log('1. 部署到 Railway');
            console.log('2. 測試外送員登入功能');
            console.log('3. 驗證訂單管理功能');
        } else {
            console.log('⚠️ 有測試失敗，建議:');
            console.log('1. 重新執行 railway_driver_fix.js');
            console.log('2. 檢查資料庫權限');
            console.log('3. 確認環境變數設定正確');
        }
    }

    async run() {
        console.log('🚀 開始 Railway 修復驗證測試\n');
        
        try {
            const connected = await this.setupConnection();
            if (!connected) {
                console.log('❌ 無法連接資料庫，測試終止');
                return;
            }
            
            await this.testTableStructure();
            await this.testDataIntegrity();
            await this.testAPIEndpoints();
            
            this.generateReport();
            
        } catch (error) {
            console.error('💥 測試執行失敗:', error.message);
        } finally {
            if (this.pool) {
                await this.pool.end();
            }
        }
    }
}

// 執行測試
if (require.main === module) {
    const tester = new RailwayFixTester();
    tester.run().catch(console.error);
}

module.exports = RailwayFixTester;