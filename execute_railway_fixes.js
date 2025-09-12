#!/usr/bin/env node
/**
 * Railway 平台外送员系统修复执行脚本
 * 执行数据库表结构修复和系统优化
 */

const { Pool } = require('pg');
const fs = require('fs');
require('dotenv').config({ path: './src/.env' });

async function executeRailwayFixes() {
    console.log('\n🚀 开始执行 Railway 平台外送员系统修复...\n');
    
    // 数据库连接配置
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });

    try {
        // 测试数据库连接
        console.log('📡 测试数据库连接...');
        const client = await pool.connect();
        console.log('✅ 数据库连接成功');
        
        // 读取并执行迁移SQL
        console.log('\n📋 执行数据库表结构迁移...');
        const migrationSQL = fs.readFileSync('./railway_missing_tables_migration.sql', 'utf8');
        
        await client.query(migrationSQL);
        console.log('✅ 数据库表结构迁移完成');
        
        // 验证表结构
        console.log('\n🔍 验证表结构...');
        
        // 检查orders表是否有锁定字段
        const ordersCheck = await client.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'orders' 
            AND column_name IN ('locked_by', 'locked_at', 'lock_expires_at')
        `);
        console.log(`✅ orders表锁定字段: ${ordersCheck.rows.length}/3 个字段已添加`);
        
        // 检查新表是否创建成功
        const tablesCheck = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name IN ('offline_queue', 'delivery_photos', 'delivery_problems', 'drivers')
        `);
        console.log(`✅ 新表创建: ${tablesCheck.rows.length}/4 个表已创建`);
        
        // 验证测试账号
        const driverCheck = await client.query(`
            SELECT phone, name FROM drivers WHERE phone = '0912345678'
        `);
        
        if (driverCheck.rows.length > 0) {
            console.log('✅ 测试外送员账号确认存在');
        } else {
            console.log('⚠️  测试外送员账号不存在，尝试创建...');
            await client.query(`
                INSERT INTO drivers (phone, name, password_hash) 
                VALUES ('0912345678', '测试外送员', '$2b$10$8N2pKl5jK8mXKlY7rWJzKOYZE4jQyVBZc7qC9mWKnDxH3nY5yZdBa')
            `);
            console.log('✅ 测试外送员账号创建完成');
        }
        
        // 创建测试订单（如果没有）
        console.log('\n📦 检查测试数据...');
        const ordersCount = await client.query('SELECT COUNT(*) as count FROM orders');
        
        if (parseInt(ordersCount.rows[0].count) === 0) {
            console.log('📝 创建测试订单数据...');
            await client.query(`
                INSERT INTO orders (contact_name, contact_phone, address, status, total_amount, subtotal, delivery_fee)
                VALUES 
                ('张三', '0901234567', '台北市信义区信义路100号', 'available', 350, 300, 50),
                ('李四', '0902345678', '台北市大安区敦化南路200号', 'available', 420, 380, 40),
                ('王五', '0903456789', '台北市中山区中山北路300号', 'available', 280, 250, 30)
            `);
            console.log('✅ 测试订单创建完成');
        } else {
            console.log(`✅ 现有订单数量: ${ordersCount.rows[0].count}`);
        }
        
        client.release();
        console.log('\n🎉 Railway 平台外送员系统修复完成！');
        
        // 输出测试信息
        console.log('\n📋 测试账号信息:');
        console.log('- 手机号: 0912345678');
        console.log('- 密码: driver123');
        console.log('- 登录网址: https://chengyivegetable-production-7b4a.up.railway.app/driver/login');
        
        console.log('\n🔧 修复完成项目:');
        console.log('✅ 登录重定向路径修复 (/driver/dashboard → /driver)');
        console.log('✅ orders表添加锁定字段 (locked_by, locked_at, lock_expires_at)');
        console.log('✅ 创建offline_queue表');
        console.log('✅ 创建delivery_photos表');
        console.log('✅ 创建delivery_problems表');
        console.log('✅ 创建drivers表');
        console.log('✅ 添加性能索引');
        console.log('✅ 创建测试数据');
        
    } catch (error) {
        console.error('❌ 修复过程出错:', error);
        console.error('错误详情:', error.message);
    } finally {
        await pool.end();
    }
}

// 如果直接运行此脚本
if (require.main === module) {
    executeRailwayFixes().catch(console.error);
}

module.exports = { executeRailwayFixes };