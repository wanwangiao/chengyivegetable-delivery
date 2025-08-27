#!/usr/bin/env node
const axios = require('axios');

async function testNominatimTaiwan() {
  console.log('🧪 測試 Nominatim 對台灣的支援程度');
  console.log('='.repeat(50));

  const baseUrl = 'https://nominatim.openstreetmap.org/search';

  const testQueries = [
    // 大地標
    '台北101',
    '台北車站',
    '中正紀念堂',
    '台北市政府',
    
    // 區域
    '台北市大安區',
    '台北市信義區',
    '新北市板橋區',
    
    // 主要道路（無號碼）
    '台北市大安區敦化南路',
    '台北市信義區市府路',
    '新北市板橋區中山路',
    
    // 簡化的地址
    '敦化南路一段',
    '市府路',
    '中山路',
    
    // 英文地址
    'Taipei Main Station',
    'Da\'an District, Taipei',
    'Xinyi District, Taipei'
  ];

  for (const query of testQueries) {
    console.log(`\n🔍 查詢: "${query}"`);
    
    try {
      const response = await axios.get(baseUrl, {
        params: {
          format: 'json',
          q: query,
          limit: 3,
          countrycodes: 'tw',
          'accept-language': 'zh-TW,zh',
          addressdetails: 1
        },
        headers: {
          'User-Agent': 'chengyivegetable-test/1.0'
        },
        timeout: 10000
      });

      if (response.data && response.data.length > 0) {
        console.log(`   ✅ 找到 ${response.data.length} 個結果:`);
        response.data.forEach((result, index) => {
          console.log(`   ${index + 1}. ${result.display_name}`);
          console.log(`      座標: (${result.lat}, ${result.lon})`);
          if (result.type) console.log(`      類型: ${result.type}`);
        });
      } else {
        console.log('   ❌ 無結果');
      }
      
      // 避免過快請求 Nominatim
      await new Promise(resolve => setTimeout(resolve, 1200));
      
    } catch (error) {
      console.log(`   💥 錯誤: ${error.message}`);
    }
  }
  
  console.log('\n' + '='.repeat(50));
  console.log('📊 結論: 檢查哪些類型的查詢有效');
}

if (require.main === module) {
  testNominatimTaiwan().catch(console.error);
}