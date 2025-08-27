/**
 * 第二階段混合地理編碼服務測試
 * 驗證免費地理編碼服務與 Google 備援機制
 */

require('dotenv').config();
const HybridGeocodingService = require('./src/services/HybridGeocodingService');
const FreeGeocodingService = require('./src/services/FreeGeocodingService');

class MockGoogleMapsService {
  constructor() {
    this.apiKey = process.env.GOOGLE_MAPS_API_KEY;
  }

  async geocodeAddress(address) {
    console.log(`🔍 Google 備援地理編碼: ${address}`);
    // 模擬 Google API 響應
    return {
      success: true,
      lat: 25.0330 + Math.random() * 0.01,
      lng: 121.5654 + Math.random() * 0.01,
      formatted_address: `Google模擬: ${address}`,
      place_id: `google_mock_${Date.now()}`,
      source: 'google_mock'
    };
  }
}

async function testPhase2Integration() {
  console.log('🚀 第二階段混合地理編碼測試開始');
  console.log('=' * 60);

  // 初始化服務
  const mockGoogleService = new MockGoogleMapsService();
  const hybridService = new HybridGeocodingService(mockGoogleService);

  // 測試地址集合（包含簡單和複雜地址）
  const testAddresses = [
    // 簡單地址（應使用免費服務）
    '台北市大安區敦化南路一段100號',
    '台北市信義區市府路1號',
    '新北市板橋區中山路一段50號',
    '台中市西區台灣大道二段2號',
    '高雄市前金區中正四路211號',
    
    // 複雜地址（應使用Google備援）
    '台北市大安區復興南路一段390號2樓之1',
    '新北市永和區中山路一段3號15樓之2',
    '台中市北屯區文心路四段955號B1F',
    '高雄市左營區博愛二段777號3樓甲室',
    '桃園市中壢區中正路100巷25弄5號之3',
    
    // 模糊地址（測試容錯性）
    '台北車站附近',
    '信義商圈',
    '中正紀念堂',
    '不存在的地址12345號'
  ];

  console.log(`📍 測試地址數量: ${testAddresses.length}`);
  console.log('');

  let totalTests = 0;
  let successCount = 0;
  let freeServiceCount = 0;
  let googleServiceCount = 0;
  let cacheHits = 0;
  const startTime = Date.now();

  // 個別測試
  console.log('🔍 個別地理編碼測試:');
  for (const address of testAddresses) {
    totalTests++;
    console.log(`\n${totalTests}. 測試地址: ${address}`);
    
    try {
      const result = await hybridService.geocodeAddress(address);
      
      if (result.success) {
        successCount++;
        const serviceUsed = result.hybridSource || result.source || 'unknown';
        
        if (serviceUsed === 'free' || serviceUsed.includes('nominatim')) {
          freeServiceCount++;
        } else if (serviceUsed === 'google' || serviceUsed.includes('google')) {
          googleServiceCount++;
        } else if (serviceUsed === 'cache') {
          cacheHits++;
        }

        console.log(`   ✅ 成功 - 座標: (${result.lat}, ${result.lng})`);
        console.log(`   📡 服務: ${serviceUsed}`);
        console.log(`   📍 格式化地址: ${result.formatted_address.substring(0, 60)}...`);
      } else {
        console.log(`   ❌ 失敗: ${result.error}`);
      }
    } catch (error) {
      console.log(`   💥 錯誤: ${error.message}`);
    }
    
    // 避免過於頻繁請求
    await new Promise(resolve => setTimeout(resolve, 1200));
  }

  // 批量測試
  console.log('\n\n🔄 批量地理編碼測試:');
  const batchAddresses = testAddresses.slice(0, 8); // 取前8個地址測試
  
  try {
    const batchResults = await hybridService.batchGeocode(batchAddresses, {
      maxGoogleRequests: 3, // 最多3個使用Google
      prioritizeImportant: true
    });
    
    console.log(`📊 批量結果: ${batchResults.filter(r => r.success).length}/${batchResults.length} 成功`);
    
    batchResults.forEach((result, index) => {
      const address = batchAddresses[index];
      if (result.success) {
        console.log(`   ✅ ${address.substring(0, 30)}... - ${result.hybridSource || result.source}`);
      } else {
        console.log(`   ❌ ${address.substring(0, 30)}... - ${result.error}`);
      }
    });
    
  } catch (error) {
    console.log(`   💥 批量測試錯誤: ${error.message}`);
  }

  // 成本分析
  console.log('\n\n💰 第二階段成本分析:');
  const endTime = Date.now();
  const totalTime = endTime - startTime;
  
  const stats = {
    總測試次數: totalTests,
    成功率: `${Math.round(successCount / totalTests * 100)}%`,
    免費服務使用: freeServiceCount,
    Google服務使用: googleServiceCount,
    快取命中: cacheHits,
    測試時間: `${Math.round(totalTime / 1000)}秒`
  };

  console.table(stats);

  // 每日成本估算（基於100單）
  const dailyOrders = 100;
  const googleUsageRate = googleServiceCount / totalTests;
  const freeUsageRate = freeServiceCount / totalTests;
  
  console.log('\n📊 每日100單成本估算:');
  const dailyGoogleCalls = Math.ceil(dailyOrders * googleUsageRate);
  const dailyFreeCalls = Math.ceil(dailyOrders * freeUsageRate);
  
  // Google Geocoding API: $5 USD per 1000 requests = $0.005 per request
  // 1 USD = 32 TWD (approximate)
  const googleCostPerRequest = 0.005 * 32; // 台幣
  const dailyCost = dailyGoogleCalls * googleCostPerRequest;
  const originalDailyCost = dailyOrders * googleCostPerRequest; // 全部使用Google
  const savings = originalDailyCost - dailyCost;
  const savingsPercentage = Math.round(savings / originalDailyCost * 100);

  console.log(`Google API 使用: ${dailyGoogleCalls} 次 (${Math.round(googleUsageRate * 100)}%)`);
  console.log(`免費服務使用: ${dailyFreeCalls} 次 (${Math.round(freeUsageRate * 100)}%)`);
  console.log(`每日成本: NT$ ${dailyCost.toFixed(2)} (原本 NT$ ${originalDailyCost.toFixed(2)})`);
  console.log(`每日節省: NT$ ${savings.toFixed(2)} (${savingsPercentage}%)`);
  console.log(`每月節省: NT$ ${(savings * 30).toFixed(0)}`);
  console.log(`每年節省: NT$ ${(savings * 365).toFixed(0)}`);

  // 服務品質評估
  console.log('\n🎯 服務品質評估:');
  console.log(`✅ 地理編碼成功率: ${Math.round(successCount / totalTests * 100)}%`);
  console.log(`🆓 免費服務覆蓋率: ${Math.round(freeUsageRate * 100)}%`);
  console.log(`🔄 Google 備援率: ${Math.round(googleUsageRate * 100)}%`);
  
  if (successCount / totalTests >= 0.9) {
    console.log('🎉 第二階段優化成功！服務品質符合要求');
  } else {
    console.log('⚠️ 服務品質需要調整，建議增加Google備援比例');
  }

  // 最終建議
  console.log('\n📋 第二階段部署建議:');
  if (savingsPercentage >= 70 && successCount / totalTests >= 0.9) {
    console.log('✅ 建議立即部署第二階段優化');
    console.log('✅ 混合地理編碼服務已準備好用於生產環境');
    console.log(`✅ 預期每年節省 NT$ ${(savings * 365).toFixed(0)} 的API費用`);
  } else if (savingsPercentage >= 50) {
    console.log('⚠️ 建議進行更多測試後部署');
    console.log('💡 可考慮調整複雜地址判斷規則以提高免費服務使用率');
  } else {
    console.log('❌ 不建議部署，建議重新檢查服務配置');
  }

  console.log('\n🔚 測試完成');
}

// 執行測試
if (require.main === module) {
  testPhase2Integration().catch(error => {
    console.error('測試執行錯誤:', error);
    process.exit(1);
  });
}

module.exports = { testPhase2Integration };