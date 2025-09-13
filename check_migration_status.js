/**
 * 檢查自動遷移狀態
 * 通過外送員登入後檢查API響應內容來判斷遷移是否成功
 */

const axios = require('axios');

const RAILWAY_BASE_URL = 'https://chengyivegetable-production-7b4a.up.railway.app';

console.log('🔍 檢查外送員系統自動遷移狀態');
console.log('========================================');

async function checkMigrationStatus() {
  try {
    // 1. 登入外送員
    console.log('🔐 外送員登入...');
    const loginData = new URLSearchParams({
      phone: '0912345678',
      password: 'driver123'
    });
    
    const loginResponse = await axios.post(
      `${RAILWAY_BASE_URL}/driver/login`,
      loginData,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        maxRedirects: 0,
        validateStatus: (status) => status < 400
      }
    );
    
    let cookies = [];
    if (loginResponse.status === 302) {
      cookies = loginResponse.headers['set-cookie'] || [];
      console.log('✅ 外送員登入成功');
    } else {
      throw new Error('登入失敗');
    }
    
    // 2. 嘗試API呼叫，檢查錯誤訊息
    console.log('\n🔍 檢查API錯誤訊息...');
    
    const apiTests = [
      { name: '訂單統計', url: '/api/driver/order-counts' },
      { name: '我的訂單', url: '/api/driver/my-orders' },
      { name: '區域訂單', url: '/api/driver/area-orders/all' }
    ];
    
    const migrationIndicators = {
      tablesCreated: false,
      testDriverExists: false,
      testOrdersExist: false,
      lockColumnsAdded: false
    };
    
    for (const test of apiTests) {
      try {
        const response = await axios.get(
          `${RAILWAY_BASE_URL}${test.url}`,
          {
            headers: {
              'Cookie': cookies.join('; ')
            },
            timeout: 10000
          }
        );
        
        if (response.status === 200) {
          console.log(`✅ ${test.name}: API正常工作`);
          
          // 檢查回傳的資料
          if (test.url.includes('area-orders') && Array.isArray(response.data)) {
            const testOrders = response.data.filter(order => 
              order.order_number && order.order_number.startsWith('TEST')
            );
            if (testOrders.length > 0) {
              migrationIndicators.testOrdersExist = true;
              console.log(`   📦 找到 ${testOrders.length} 筆測試訂單`);
            }
          }
        }
        
      } catch (error) {
        if (error.response && error.response.status === 500) {
          console.log(`❌ ${test.name}: 500錯誤`);
          
          // 分析錯誤訊息
          const errorMessage = error.response.data;
          if (typeof errorMessage === 'string') {
            console.log(`   錯誤詳情: ${errorMessage.substring(0, 200)}...`);
            
            // 檢查是否為資料庫相關錯誤
            if (errorMessage.includes('relation') && errorMessage.includes('does not exist')) {
              if (errorMessage.includes('drivers')) {
                console.log('   ⚠️ drivers 表不存在 - 遷移可能未執行');
              }
              if (errorMessage.includes('offline_queue')) {
                console.log('   ⚠️ offline_queue 表不存在 - 遷移可能未執行');
              }
            } else if (errorMessage.includes('locked_by')) {
              console.log('   ⚠️ orders 表缺少 locked_by 欄位 - 遷移可能未執行');
            } else if (errorMessage.includes('Cannot read properties of null')) {
              console.log('   ⚠️ 資料庫連接池為 null - 可能為連接問題');
            } else {
              console.log('   ℹ️ 其他資料庫錯誤 - 需要進一步診斷');
            }
          }
        } else if (error.response && error.response.status === 400) {
          console.log(`⚠️ ${test.name}: 400錯誤 (參數問題)`);
        } else {
          console.log(`❌ ${test.name}: ${error.message}`);
        }
      }
    }
    
    // 3. 嘗試直接訪問儀表板，檢查是否有遷移相關訊息
    console.log('\n🔍 檢查系統啟動日誌線索...');
    
    try {
      const dashboardResponse = await axios.get(
        `${RAILWAY_BASE_URL}/driver`,
        {
          headers: {
            'Cookie': cookies.join('; ')
          }
        }
      );
      
      if (dashboardResponse.status === 200) {
        console.log('✅ 儀表板可訪問');
        
        // 檢查頁面是否包含測試相關內容
        const pageContent = dashboardResponse.data;
        if (pageContent.includes('TEST001') || pageContent.includes('測試客戶')) {
          migrationIndicators.testOrdersExist = true;
          console.log('✅ 儀表板頁面包含測試訂單內容');
        }
      }
    } catch (error) {
      console.log('⚠️ 儀表板檢查失敗:', error.message);
    }
    
    // 4. 分析結果
    console.log('\n📊 遷移狀態分析');
    console.log('========================================');
    
    const indicators = Object.values(migrationIndicators);
    const positiveIndicators = indicators.filter(Boolean).length;
    
    console.log('🔍 檢查結果:');
    console.log(`   測試訂單存在: ${migrationIndicators.testOrdersExist ? '✅' : '❌'}`);
    console.log(`   測試外送員存在: ${migrationIndicators.testDriverExists ? '✅' : '⚠️ 無法確認'}`);
    console.log(`   系統表格建立: ${migrationIndicators.tablesCreated ? '✅' : '⚠️ 無法確認'}`);
    console.log(`   鎖定欄位新增: ${migrationIndicators.lockColumnsAdded ? '✅' : '⚠️ 無法確認'}`);
    
    if (migrationIndicators.testOrdersExist) {
      console.log('\n🎉 好消息: 遷移可能已成功執行!');
      console.log('   - 找到測試訂單，表示資料庫修復腳本已執行');
      console.log('   - 外送員登入功能正常');
      console.log('   - 儀表板頁面可正常訪問');
    } else {
      console.log('\n⚠️ 遷移狀態不明確:');
      console.log('   - 未找到測試訂單 (TEST001-003)');
      console.log('   - API錯誤可能表示某些表格或欄位缺失');
      console.log('   - 需要進一步檢查Railway部署日誌');
    }
    
    // 5. 建議
    console.log('\n💡 建議下一步:');
    if (!migrationIndicators.testOrdersExist) {
      console.log('1. 檢查Railway部署日誌，查看是否有遷移執行記錄');
      console.log('2. 檢查Railway資料庫連接狀態');
      console.log('3. 手動觸發遷移或重新部署');
    } else {
      console.log('1. 測試外送員訂單勾選功能');
      console.log('2. 驗證所有外送員API功能');
      console.log('3. 進行完整的端到端測試');
    }
    
    return migrationIndicators.testOrdersExist;
    
  } catch (error) {
    console.error('❌ 檢查過程發生錯誤:', error.message);
    return false;
  }
}

// 執行檢查
checkMigrationStatus().then(success => {
  if (success) {
    console.log('\n✅ 外送員系統遷移檢查完成 - 狀態良好');
    process.exit(0);
  } else {
    console.log('\n⚠️ 外送員系統遷移檢查完成 - 需要進一步處理');
    process.exit(1);
  }
}).catch(error => {
  console.error('💥 檢查失敗:', error.message);
  process.exit(1);
});