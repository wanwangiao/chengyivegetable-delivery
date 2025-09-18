#!/usr/bin/env node
/**
 * 綜合資料庫分析 - 診斷 orders 表結構問題
 * 檢查 contact_name vs customer_name 欄位衝突
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// 檔案結構分析 (當資料庫無法連線時使用)
async function analyzeFileStructure() {
  console.log('\n📁 === 檔案結構分析 ===');
  console.log('分析專案中的 SQL 檔案和 JS 檔案來了解 orders 表結構定義\n');

  const projectDir = process.cwd();
  const analysisResults = {
    contactNameFiles: [],
    customerNameFiles: [],
    createTableStatements: [],
    insertStatements: []
  };

  // 搜尋所有相關檔案
  const filesToCheck = [
    'schema.sql',
    'quick_database_setup.sql',
    'create_11_test_orders.sql',
    'smart_auto_migration.js',
    'comprehensive_backend_fix.js',
    'create_demo_data.js',
    'direct_database_cleanup.sql'
  ];

  for (const filename of filesToCheck) {
    const filepath = path.join(projectDir, filename);
    if (fs.existsSync(filepath)) {
      try {
        const content = fs.readFileSync(filepath, 'utf8');

        // 檢查 contact_name 使用
        if (content.includes('contact_name')) {
          analysisResults.contactNameFiles.push(filename);
        }

        // 檢查 customer_name 使用
        if (content.includes('customer_name')) {
          analysisResults.customerNameFiles.push(filename);
        }

        // 檢查 CREATE TABLE orders 語句
        const createTableMatch = content.match(/CREATE TABLE.*orders.*\(([\s\S]*?)\);/i);
        if (createTableMatch) {
          analysisResults.createTableStatements.push({
            file: filename,
            statement: createTableMatch[0]
          });
        }

        // 檢查 INSERT INTO orders 語句
        const insertMatches = content.match(/INSERT INTO orders.*?\([^)]*\)/gi);
        if (insertMatches) {
          insertMatches.forEach(match => {
            analysisResults.insertStatements.push({
              file: filename,
              statement: match.substring(0, 100) + '...'
            });
          });
        }

      } catch (error) {
        console.log(`⚠️  無法讀取檔案 ${filename}: ${error.message}`);
      }
    }
  }

  // 顯示分析結果
  console.log('🔍 欄位使用分析:');
  console.log(`使用 contact_name 的檔案 (${analysisResults.contactNameFiles.length}):`);
  analysisResults.contactNameFiles.forEach(file => console.log(`  ✅ ${file}`));

  console.log(`\n使用 customer_name 的檔案 (${analysisResults.customerNameFiles.length}):`);
  analysisResults.customerNameFiles.forEach(file => console.log(`  ✅ ${file}`));

  console.log('\n📋 CREATE TABLE 語句:');
  analysisResults.createTableStatements.forEach(item => {
    console.log(`檔案: ${item.file}`);
    console.log('語句預覽:');
    console.log(item.statement.substring(0, 200) + '...\n');
  });

  console.log('📋 INSERT 語句分析:');
  const insertSummary = {};
  analysisResults.insertStatements.forEach(item => {
    if (!insertSummary[item.file]) {
      insertSummary[item.file] = 0;
    }
    insertSummary[item.file]++;
  });

  Object.entries(insertSummary).forEach(([file, count]) => {
    console.log(`  ${file}: ${count} 個 INSERT 語句`);
  });

  // 結論和建議
  console.log('\n🔧 === 檔案分析結論 ===');

  if (analysisResults.contactNameFiles.length > 0 && analysisResults.customerNameFiles.length > 0) {
    console.log('❌ 檢測到欄位名稱不一致問題！');
    console.log('同時使用了 contact_name 和 customer_name');
    console.log('\n建議修復策略：');
    console.log('1. 統一使用 contact_name (推薦，因為這是主要資料庫結構)');
    console.log('2. 修改所有使用 customer_name 的檔案');
    console.log('3. 或者在資料庫中新增 customer_name 欄位作為 contact_name 的別名');
  } else if (analysisResults.contactNameFiles.length > 0) {
    console.log('✅ 主要使用 contact_name，結構一致');
  } else if (analysisResults.customerNameFiles.length > 0) {
    console.log('⚠️  主要使用 customer_name，但可能與標準結構不符');
  }

  return analysisResults;
}

async function analyzeDatabaseStructure() {
  console.log('🔍 開始綜合資料庫結構分析...\n');

  // 優先檢查環境變數中的 Railway 生產資料庫
  let databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.log('❌ 未找到 DATABASE_URL 環境變數');
    return;
  }

  console.log('📊 使用資料庫:', databaseUrl.includes('railway') ? 'Railway 生產環境' : '本地/其他環境');

  try {
    const pool = new Pool({
      connectionString: databaseUrl,
      ssl: databaseUrl.includes('railway') ? { rejectUnauthorized: false } : false
    });

    // 1. 檢查 orders 表的完整結構
    console.log('📋 === ORDERS 表結構分析 ===');
    const ordersStructure = await pool.query(`
      SELECT
        column_name,
        data_type,
        is_nullable,
        column_default,
        character_maximum_length
      FROM information_schema.columns
      WHERE table_name = 'orders'
      ORDER BY ordinal_position
    `);

    if (ordersStructure.rows.length === 0) {
      console.log('❌ orders 表不存在！');
      await pool.end();
      return;
    }

    console.log('✅ orders 表存在，欄位結構如下：');
    console.log('-'.repeat(80));
    console.log('欄位名稱'.padEnd(20) + '資料類型'.padEnd(15) + '可為空'.padEnd(10) + '預設值'.padEnd(20) + '最大長度');
    console.log('-'.repeat(80));

    let hasContactName = false;
    let hasCustomerName = false;
    let contactNameNullable = false;
    let customerNameNullable = false;

    ordersStructure.rows.forEach(col => {
      console.log(
        col.column_name.padEnd(20) +
        col.data_type.padEnd(15) +
        col.is_nullable.padEnd(10) +
        (col.column_default || 'NULL').padEnd(20) +
        (col.character_maximum_length || '')
      );

      if (col.column_name === 'contact_name') {
        hasContactName = true;
        contactNameNullable = col.is_nullable === 'YES';
      }
      if (col.column_name === 'customer_name') {
        hasCustomerName = true;
        customerNameNullable = col.is_nullable === 'YES';
      }
    });

    console.log('-'.repeat(80));
    console.log('\n🔍 === 關鍵欄位分析 ===');
    console.log(`contact_name 欄位: ${hasContactName ? '✅ 存在' : '❌ 不存在'}`);
    if (hasContactName) {
      console.log(`contact_name 可為空: ${contactNameNullable ? '✅ YES' : '❌ NO (NOT NULL 約束)'}`);
    }

    console.log(`customer_name 欄位: ${hasCustomerName ? '✅ 存在' : '❌ 不存在'}`);
    if (hasCustomerName) {
      console.log(`customer_name 可為空: ${customerNameNullable ? '✅ YES' : '❌ NO (NOT NULL 約束)'}`);
    }

    // 2. 檢查現有訂單資料
    console.log('\n📊 === 現有訂單資料分析 ===');
    const orderCount = await pool.query('SELECT COUNT(*) as total FROM orders');
    console.log(`總訂單數: ${orderCount.rows[0].total}`);

    if (parseInt(orderCount.rows[0].total) > 0) {
      // 檢查欄位資料完整性
      if (hasContactName && hasCustomerName) {
        const dataIntegrity = await pool.query(`
          SELECT
            COUNT(*) as total_orders,
            COUNT(contact_name) as has_contact_name,
            COUNT(customer_name) as has_customer_name,
            COUNT(CASE WHEN contact_name IS NOT NULL AND customer_name IS NOT NULL THEN 1 END) as has_both,
            COUNT(CASE WHEN contact_name IS NULL AND customer_name IS NULL THEN 1 END) as has_neither
          FROM orders
        `);

        const integrity = dataIntegrity.rows[0];
        console.log(`具有 contact_name 的訂單: ${integrity.has_contact_name}/${integrity.total_orders}`);
        console.log(`具有 customer_name 的訂單: ${integrity.has_customer_name}/${integrity.total_orders}`);
        console.log(`同時有兩個欄位的訂單: ${integrity.has_both}/${integrity.total_orders}`);
        console.log(`兩個欄位都為空的訂單: ${integrity.has_neither}/${integrity.total_orders}`);
      }

      // 顯示最近的訂單範例
      let sampleQuery;
      if (hasContactName && hasCustomerName) {
        sampleQuery = `
          SELECT id, contact_name, customer_name, address, status, created_at
          FROM orders
          ORDER BY created_at DESC
          LIMIT 5
        `;
      } else if (hasContactName) {
        sampleQuery = `
          SELECT id, contact_name, address, status, created_at
          FROM orders
          ORDER BY created_at DESC
          LIMIT 5
        `;
      } else if (hasCustomerName) {
        sampleQuery = `
          SELECT id, customer_name, address, status, created_at
          FROM orders
          ORDER BY created_at DESC
          LIMIT 5
        `;
      }

      if (sampleQuery) {
        console.log('\n📋 最近的訂單範例:');
        const sampleOrders = await pool.query(sampleQuery);
        sampleOrders.rows.forEach((order, index) => {
          console.log(`${index + 1}. 訂單 #${order.id}`);
          if (order.contact_name) console.log(`   contact_name: "${order.contact_name}"`);
          if (order.customer_name) console.log(`   customer_name: "${order.customer_name}"`);
          console.log(`   地址: ${order.address}`);
          console.log(`   狀態: ${order.status}`);
          console.log(`   時間: ${order.created_at}`);
          console.log('');
        });
      }
    }

    // 3. 分析問題和建議
    console.log('\n🔧 === 問題診斷和修復建議 ===');

    if (!hasContactName && !hasCustomerName) {
      console.log('❌ 嚴重問題：orders 表缺少客戶姓名欄位！');
      console.log('建議：需要新增 contact_name 欄位');
    } else if (hasContactName && hasCustomerName) {
      console.log('⚠️  警告：orders 表同時有 contact_name 和 customer_name 欄位');
      console.log('建議：統一使用其中一個欄位，建議保留 contact_name');
    } else if (hasContactName && !contactNameNullable) {
      console.log('❌ 問題：contact_name 欄位有 NOT NULL 約束');
      console.log('這解釋了為什麼測試訂單創建失敗');
      console.log('建議：修改測試腳本使用 contact_name 而不是 customer_name');
    } else if (hasCustomerName && !customerNameNullable) {
      console.log('❌ 問題：customer_name 欄位有 NOT NULL 約束');
      console.log('建議：修改資料庫結構或統一欄位使用');
    }

    // 4. 檢查其他相關表
    console.log('\n📋 === 其他相關表檢查 ===');
    const relatedTables = ['users', 'drivers', 'order_items', 'products'];

    for (const tableName of relatedTables) {
      const tableExists = await pool.query(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = $1
      `, [tableName]);

      if (tableExists.rows.length > 0) {
        const rowCount = await pool.query(`SELECT COUNT(*) as count FROM ${tableName}`);
        console.log(`✅ ${tableName} 表存在，有 ${rowCount.rows[0].count} 筆記錄`);
      } else {
        console.log(`❌ ${tableName} 表不存在`);
      }
    }

    await pool.end();

  } catch (error) {
    console.error('❌ 資料庫分析失敗:', error.message);
    console.error('詳細錯誤:', error.code || 'N/A');

    if (error.message.includes('connect') || error.code === 'ECONNREFUSED') {
      console.log('\n💡 連線失敗可能原因：');
      console.log('1. 本地 PostgreSQL 未啟動');
      console.log('2. Railway 生產資料庫 DATABASE_URL 未設定');
      console.log('3. 網路連線問題');
      console.log('\n🔧 解決方案：');
      console.log('1. 啟動本地 PostgreSQL 服務');
      console.log('2. 或者設定 Railway 生產環境的 DATABASE_URL');
      console.log('3. 或者使用示範模式進行分析');
    }

    // 嘗試使用示範模式分析
    console.log('\n🔄 嘗試使用示範模式分析檔案結構...');
    await analyzeFileStructure();
  }
}

// 主程序
async function main() {
  console.log('🚀 誠憶鮮蔬系統 - 綜合資料庫結構分析');
  console.log('目的：診斷 contact_name vs customer_name 欄位衝突問題\n');

  await analyzeDatabaseStructure();

  console.log('\n✅ 分析完成！');
  console.log('請根據上述診斷結果制定修復策略。');
}

if (require.main === module) {
  require('dotenv').config();
  main().catch(console.error);
}

module.exports = { analyzeDatabaseStructure };