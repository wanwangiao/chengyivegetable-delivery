/**
 * 執行 LINE Users 數據庫遷移腳本
 * 一次性執行腳本，創建 line_users 表
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// 數據庫配置
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function executeMigration() {
  try {
    console.log('🚀 開始執行 LINE Users 數據庫遷移...');
    
    // 讀取 SQL 文件
    const sqlPath = path.join(__dirname, 'create_line_users_table.sql');
    console.log('📂 讀取 SQL 文件:', sqlPath);
    
    if (!fs.existsSync(sqlPath)) {
      throw new Error(`SQL 文件不存在: ${sqlPath}`);
    }
    
    const sqlScript = fs.readFileSync(sqlPath, 'utf8');
    console.log('📄 SQL 文件內容長度:', sqlScript.length, '字符');
    
    // 執行 SQL
    console.log('⚡ 執行 SQL 腳本...');
    await pool.query(sqlScript);
    
    // 檢查結果
    console.log('🔍 檢查表格創建結果...');
    const checkResult = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'line_users'
      )
    `);
    
    const tableExists = checkResult.rows[0].exists;
    
    if (tableExists) {
      console.log('✅ line_users 表創建成功!');
      
      // 檢查表結構
      const columnInfo = await pool.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_name = 'line_users' 
        ORDER BY ordinal_position
      `);
      
      console.log('📋 表結構:');
      columnInfo.rows.forEach(col => {
        console.log(`  - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'}`);
      });
      
      // 檢查索引
      const indexInfo = await pool.query(`
        SELECT indexname, indexdef
        FROM pg_indexes
        WHERE tablename = 'line_users'
      `);
      
      console.log('🔗 索引:');
      indexInfo.rows.forEach(idx => {
        console.log(`  - ${idx.indexname}`);
      });
      
    } else {
      throw new Error('表格創建失敗，line_users 表不存在');
    }
    
    console.log('🎉 數據庫遷移完成!');
    
  } catch (error) {
    console.error('❌ 數據庫遷移失敗:', error.message);
    console.error('詳細錯誤:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// 執行遷移
if (require.main === module) {
  executeMigration();
}

module.exports = executeMigration;