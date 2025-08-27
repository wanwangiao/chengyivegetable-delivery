#!/usr/bin/env node
const FreeGeocodingService = require('./src/services/FreeGeocodingService');

async function testImprovedGeocoding() {
  console.log('🧪 測試改進後的地址清理和地理編碼');
  console.log('='.repeat(50));

  const freeService = new FreeGeocodingService();

  // 測試地址
  const testAddresses = [
    '台北市大安區敦化南路一段100號',
    '台北市信義區市府路1號',
    '台北市大安區復興南路一段390號2樓之1',
    '新北市永和區中山路一段3號15樓之2',
    '台中市西區台灣大道二段2號',
    '台中市北屯區文心路四段955號B1F',
    '桃園市中壢區中正路100巷25弄5號之3',
  ];

  let totalSuccess = 0;
  let freeServiceSuccess = 0;

  for (let i = 0; i < testAddresses.length; i++) {
    const address = testAddresses[i];
    console.log(`\n${i + 1}. 測試地址: ${address}`);
    console.log('-'.repeat(40));

    try {
      const result = await freeService.geocodeAddress(address, {
        retryCount: 2,
        useCache: false,
        preferredService: 'nominatim'
      });

      if (result.success) {
        totalSuccess++;
        if (result.source === 'nominatim' || result.source === 'locationiq' || result.source === 'free') {
          freeServiceSuccess++;
          console.log(`   ✅ 免費服務成功 - 座標: (${result.lat}, ${result.lng})`);
          console.log(`   📍 地址: ${result.formatted_address.substring(0, 80)}...`);
          if (result.approximateMatch) {
            console.log(`   🎯 近似匹配: "${result.originalAddress}" → "${result.matchedQuery}"`);
          }
        } else {
          console.log(`   ⚠️ 非免費服務: ${result.source || result.service || 'unknown'}`);
        }
      } else {
        console.log(`   ❌ 失敗: ${result.error}`);
      }

      // 避免過快請求
      await new Promise(resolve => setTimeout(resolve, 1200));

    } catch (error) {
      console.log(`   💥 異常: ${error.message}`);
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log('📊 改進後測試結果:');
  console.log(`總成功率: ${totalSuccess}/${testAddresses.length} (${Math.round(totalSuccess/testAddresses.length*100)}%)`);
  console.log(`免費服務成功: ${freeServiceSuccess}/${testAddresses.length} (${Math.round(freeServiceSuccess/testAddresses.length*100)}%)`);
  
  console.log('\n🎯 改進效果評估:');
  if (freeServiceSuccess >= testAddresses.length * 0.6) {
    console.log('✅ 改進效果優秀！免費服務覆蓋率 >= 60%');
  } else if (freeServiceSuccess >= testAddresses.length * 0.4) {
    console.log('⚠️ 改進效果中等，免費服務覆蓋率 40-60%');  
  } else {
    console.log('❌ 改進效果不佳，需要進一步優化');
  }

  return {
    totalAddresses: testAddresses.length,
    totalSuccess,
    freeServiceSuccess,
    freeServiceRate: Math.round(freeServiceSuccess/testAddresses.length*100)
  };
}

if (require.main === module) {
  testImprovedGeocoding().catch(console.error);
}

module.exports = { testImprovedGeocoding };