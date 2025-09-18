#!/usr/bin/env node
/**
 * 驗證資料庫修復結果
 * 測試 orders 表結構修復是否成功
 */

const { Pool } = require('pg');

async function verifyDatabaseFix() {
  console.log('🔍 開始驗證資料庫修復結果...\n');

  if (!process.env.DATABASE_URL) {
    console.log('❌ DATABASE_URL 未設定，無法進行驗證');
    return false;
  }

  try {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });

    const results = {
      tableStructure: false,
      dataIntegrity: false,
      testOrderCreation: false,
      environmentVariables: false
    };

    // 1. 驗證表結構
    console.log('📋 === 驗證 orders 表結構 ===');
    const structureCheck = await pool.query(`
      SELECT
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_name = 'orders'
        AND column_name IN ('contact_name', 'contact_phone', 'order_number', 'locked_by')
      ORDER BY column_name
    `);

    console.log('檢查到的關鍵欄位：');
    structureCheck.rows.forEach(col => {
      console.log(`  ✅ ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? '(NOT NULL)' : '(NULLABLE)'}`);
    });

    const requiredFields = ['contact_name', 'contact_phone'];
    const hasAllRequired = requiredFields.every(field =>
      structureCheck.rows.some(row => row.column_name === field)
    );

    if (hasAllRequired) {
      console.log('✅ 表結構驗證通過');
      results.tableStructure = true;
    } else {
      console.log('❌ 表結構驗證失敗：缺少必要欄位');
    }

    // 2. 驗證資料完整性
    console.log('\n📊 === 驗證資料完整性 ===');
    const dataCheck = await pool.query(`
      SELECT
        COUNT(*) as total_orders,
        COUNT(CASE WHEN contact_name IS NULL OR contact_name = '' THEN 1 END) as missing_name,
        COUNT(CASE WHEN contact_phone IS NULL OR contact_phone = '' THEN 1 END) as missing_phone,
        COUNT(CASE WHEN order_number IS NULL OR order_number = '' THEN 1 END) as missing_order_number
      FROM orders
    `);

    const data = dataCheck.rows[0];
    console.log(`總訂單數: ${data.total_orders}`);
    console.log(`缺少客戶姓名的訂單: ${data.missing_name}`);
    console.log(`缺少客戶電話的訂單: ${data.missing_phone}`);
    console.log(`缺少訂單編號的訂單: ${data.missing_order_number}`);

    if (data.missing_name === '0' && data.missing_phone === '0') {
      console.log('✅ 資料完整性驗證通過');
      results.dataIntegrity = true;
    } else {
      console.log('❌ 資料完整性驗證失敗：有記錄缺少必要資料');
    }

    // 3. 測試訂單創建
    console.log('\n🧪 === 測試訂單創建功能 ===');
    try {
      const testOrderResult = await pool.query(`
        INSERT INTO orders (
          contact_name,
          contact_phone,
          address,
          status,
          subtotal,
          delivery_fee,
          total,
          payment_method
        ) VALUES (
          '驗證測試客戶',
          '0987654321',
          '台北市信義區測試路123號',
          'placed',
          100,
          50,
          150,
          'cash'
        ) RETURNING id, order_number
      `);

      const testOrder = testOrderResult.rows[0];
      console.log(`✅ 測試訂單創建成功 - ID: ${testOrder.id}, 編號: ${testOrder.order_number}`);

      // 清理測試訂單
      await pool.query('DELETE FROM orders WHERE id = $1', [testOrder.id]);
      console.log('✅ 測試訂單已清理');

      results.testOrderCreation = true;
    } catch (error) {
      console.log('❌ 測試訂單創建失敗:', error.message);
      if (error.message.includes('contact_name')) {
        console.log('💡 這表示 contact_name NOT NULL 約束問題仍然存在');
      }
    }

    // 4. 驗證環境變數
    console.log('\n🔧 === 驗證環境變數 ===');
    const envChecks = {
      'LINE_LIFF_ID': process.env.LINE_LIFF_ID,
      'LINE_CHANNEL_ID': process.env.LINE_CHANNEL_ID,
      'LINE_CHANNEL_SECRET': process.env.LINE_CHANNEL_SECRET?.substring(0, 10) + '...',
      'GOOGLE_MAPS_API_KEY': process.env.GOOGLE_MAPS_API_KEY?.substring(0, 10) + '...'
    };

    let envValid = true;
    Object.entries(envChecks).forEach(([key, value]) => {
      if (value) {
        console.log(`✅ ${key}: 已設定`);
      } else {
        console.log(`❌ ${key}: 未設定`);
        envValid = false;
      }
    });

    if (envValid) {
      console.log('✅ 環境變數驗證通過');
      results.environmentVariables = true;
    }

    // 5. 總結報告
    console.log('\n📋 === 驗證結果總結 ===');
    console.log('='.repeat(50));
    console.log(`表結構驗證: ${results.tableStructure ? '✅ 通過' : '❌ 失敗'}`);
    console.log(`資料完整性: ${results.dataIntegrity ? '✅ 通過' : '❌ 失敗'}`);
    console.log(`訂單創建測試: ${results.testOrderCreation ? '✅ 通過' : '❌ 失敗'}`);
    console.log(`環境變數: ${results.environmentVariables ? '✅ 通過' : '❌ 失敗'}`);

    const allPassed = Object.values(results).every(r => r);
    console.log('='.repeat(50));
    console.log(`整體狀態: ${allPassed ? '✅ 修復成功' : '⚠️  需要進一步修復'}`);

    if (allPassed) {
      console.log('\n🎉 恭喜！資料庫結構修復完全成功！');
      console.log('現在可以安全地創建測試訂單和使用系統功能。');
    } else {
      console.log('\n🔧 修復建議：');
      if (!results.tableStructure) {
        console.log('1. 執行 complete_database_structure_fix.sql 腳本');
      }
      if (!results.dataIntegrity) {
        console.log('2. 檢查並修復現有訂單的空值問題');
      }
      if (!results.testOrderCreation) {
        console.log('3. 檢查 orders 表的約束條件');
      }
      if (!results.environmentVariables) {
        console.log('4. 確認 .env 檔案中的環境變數設定');
      }
    }

    await pool.end();
    return allPassed;

  } catch (error) {
    console.error('❌ 驗證過程發生錯誤:', error.message);
    console.log('💡 請確認 DATABASE_URL 設定正確且資料庫可連線');
    return false;
  }
}

// 主程序
async function main() {
  console.log('🚀 誠憶鮮蔬系統 - 資料庫修復驗證工具\n');

  const success = await verifyDatabaseFix();

  console.log('\n' + '='.repeat(60));
  if (success) {
    console.log('🎯 驗證完成：系統已準備好正常運作！');
  } else {
    console.log('⚠️  驗證完成：系統需要進一步修復');
    process.exit(1);
  }
}

if (require.main === module) {
  require('dotenv').config();
  main().catch(console.error);
}

module.exports = { verifyDatabaseFix };