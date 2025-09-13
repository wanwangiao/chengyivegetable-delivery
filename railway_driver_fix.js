#!/usr/bin/env node
/**
 * Railway 資料庫外送員系統修復腳本 
 * 專為 Railway 平台設計，不依賴 .env 檔案
 * 執行 fix_driver_database.sql 內容並進行系統修復
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

class RailwayDriverFixer {
    constructor() {
        this.pool = null;
        this.errors = [];
        this.successCount = 0;
    }

    /**
     * 建立資料庫連接 - 與 server.js 相同的邏輯
     */
    async createDatabaseConnection() {
        console.log('🔧 開始建立 Railway 資料庫連線...');
        console.log('🔍 環境變數檢查:');
        console.log('  DATABASE_URL:', process.env.DATABASE_URL ? '已設定' : '未設定');
        console.log('  NODE_ENV:', process.env.NODE_ENV || 'development');
        
        // 方法1: 優先使用 Railway 環境變數
        if (process.env.DATABASE_URL) {
            console.log('✅ 方法1: 使用 Railway DATABASE_URL 環境變數...');
            try {
                this.pool = new Pool({
                    connectionString: process.env.DATABASE_URL,
                    ssl: { rejectUnauthorized: false },
                    connectionTimeoutMillis: 60000,
                    idleTimeoutMillis: 30000,
                    max: 10,
                    min: 1
                });
                
                // 測試連接
                const client = await this.pool.connect();
                const result = await client.query('SELECT NOW()');
                client.release();
                
                console.log('✅ Railway 資料庫連線成功!');
                console.log('⏰ 連線時間:', result.rows[0].now);
                return true;
                
            } catch (error) {
                console.error('❌ Railway 連線失敗:', error.message);
                this.errors.push({ method: 'Railway環境變數', error: error.message });
            }
        } else {
            console.log('⚠️ DATABASE_URL 環境變數未設定');
            this.errors.push({ method: 'Railway環境變數', error: 'DATABASE_URL 未設定' });
        }

        // 如果 Railway 連線失敗，嘗試其他方法
        console.log('🔄 嘗試其他連線方式...');
        
        // 方法2: 使用 Supabase 備用連線（如果是從 Supabase 遷移的項目）
        const supabaseMapping = {
            'db.cywcuzgbuqmxjxwyrrsp.supabase.co': '54.225.34.23'
        };
        
        try {
            const directIP = supabaseMapping['db.cywcuzgbuqmxjxwyrrsp.supabase.co'];
            if (directIP) {
                console.log(`🔗 嘗試備用連線到 IP: ${directIP}`);
                
                this.pool = new Pool({
                    host: directIP,
                    port: 5432,
                    database: 'postgres',
                    user: process.env.DB_USER || 'postgres',
                    password: process.env.DB_PASSWORD || process.env.DATABASE_PASSWORD,
                    ssl: { rejectUnauthorized: false },
                    connectionTimeoutMillis: 30000
                });
                
                const client = await this.pool.connect();
                await client.query('SELECT 1');
                client.release();
                
                console.log('✅ 備用資料庫連線成功!');
                return true;
            }
        } catch (error) {
            console.log('❌ 備用連線也失敗:', error.message);
            this.errors.push({ method: '備用連線', error: error.message });
        }

        return false;
    }

    /**
     * 執行 SQL 檔案內容
     */
    async executeSQLFile(filePath) {
        try {
            console.log(`📄 讀取 SQL 檔案: ${filePath}`);
            const sqlContent = fs.readFileSync(filePath, 'utf8');
            
            const client = await this.pool.connect();
            
            console.log('🔄 執行 SQL 指令...');
            await client.query(sqlContent);
            
            client.release();
            console.log('✅ SQL 檔案執行成功');
            this.successCount++;
            
            return true;
        } catch (error) {
            console.error(`❌ SQL 檔案執行失敗: ${error.message}`);
            this.errors.push({ file: filePath, error: error.message });
            return false;
        }
    }

    /**
     * 執行額外的修復檢查
     */
    async performAdditionalChecks() {
        try {
            const client = await this.pool.connect();
            
            // 檢查重要表格是否存在
            const requiredTables = ['orders', 'drivers', 'offline_queue', 'delivery_photos', 'delivery_problems'];
            
            for (const tableName of requiredTables) {
                const result = await client.query(`
                    SELECT EXISTS (
                        SELECT FROM information_schema.tables 
                        WHERE table_schema = 'public' 
                        AND table_name = $1
                    )
                `, [tableName]);
                
                if (result.rows[0].exists) {
                    console.log(`✅ 表格 ${tableName} 存在`);
                } else {
                    console.log(`⚠️ 表格 ${tableName} 不存在`);
                }
            }
            
            // 檢查 orders 表的鎖定欄位
            const lockFields = await client.query(`
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'orders' 
                AND column_name IN ('locked_by', 'locked_at', 'lock_expires_at')
            `);
            
            console.log(`📋 orders 表鎖定欄位: ${lockFields.rows.length}/3 個欄位已添加`);
            
            // 檢查測試外送員是否存在
            const driverCount = await client.query(`
                SELECT COUNT(*) FROM drivers WHERE phone = '0912345678'
            `);
            
            console.log(`👤 測試外送員帳號: ${driverCount.rows[0].count > 0 ? '存在' : '不存在'}`);
            
            // 檢查測試訂單
            const testOrderCount = await client.query(`
                SELECT COUNT(*) FROM orders WHERE order_number LIKE 'TEST%'
            `);
            
            console.log(`📦 測試訂單數量: ${testOrderCount.rows[0].count} 筆`);
            
            client.release();
            this.successCount++;
            
        } catch (error) {
            console.error('❌ 額外檢查失敗:', error.message);
            this.errors.push({ check: '額外檢查', error: error.message });
        }
    }

    /**
     * 主要執行函數
     */
    async execute() {
        console.log('🚀 Railway 外送員系統資料庫修復開始');
        console.log('=' .repeat(50));
        
        try {
            // 1. 建立資料庫連接
            const connected = await this.createDatabaseConnection();
            if (!connected) {
                throw new Error('無法建立資料庫連接');
            }
            
            // 2. 執行主要修復 SQL
            const sqlFilePath = path.join(__dirname, 'fix_driver_database.sql');
            if (fs.existsSync(sqlFilePath)) {
                await this.executeSQLFile(sqlFilePath);
            } else {
                console.log('⚠️ fix_driver_database.sql 檔案不存在，跳過執行');
            }
            
            // 3. 執行額外檢查
            await this.performAdditionalChecks();
            
            // 4. 產生報告
            this.generateReport();
            
        } catch (error) {
            console.error('💥 修復過程發生嚴重錯誤:', error.message);
            this.errors.push({ critical: true, error: error.message });
        } finally {
            if (this.pool) {
                await this.pool.end();
                console.log('🔌 資料庫連線已關閉');
            }
        }
    }

    /**
     * 產生修復報告
     */
    generateReport() {
        console.log('\n' + '=' .repeat(50));
        console.log('📊 Railway 外送員系統修復報告');
        console.log('=' .repeat(50));
        
        console.log(`✅ 成功執行步驟: ${this.successCount}`);
        console.log(`❌ 錯誤數量: ${this.errors.length}`);
        
        if (this.errors.length > 0) {
            console.log('\n🚨 錯誤詳情:');
            this.errors.forEach((error, index) => {
                console.log(`${index + 1}. [${error.method || error.file || error.check || 'Unknown'}] ${error.error}`);
            });
        }
        
        if (this.errors.length === 0) {
            console.log('\n🎉 修復完全成功！系統應該可以正常運行了');
        } else if (this.successCount > 0) {
            console.log('\n⚠️ 部分修復成功，請檢查錯誤並手動處理');
        } else {
            console.log('\n💥 修復失敗，請檢查資料庫連接和權限設置');
        }
        
        console.log('\n📝 接下來的步驟:');
        console.log('1. 檢查 Railway 部署日誌');
        console.log('2. 測試外送員登入功能');
        console.log('3. 驗證 API 端點正常運作');
        console.log('4. 如有問題請檢查環境變數設定');
    }
}

// 執行修復（如果直接執行此檔案）
if (require.main === module) {
    const fixer = new RailwayDriverFixer();
    fixer.execute().catch(error => {
        console.error('💥 修復執行失敗:', error);
        process.exit(1);
    });
}

module.exports = RailwayDriverFixer;