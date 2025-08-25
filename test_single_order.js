const axios = require('axios');

const BASE_URL = 'https://vegdeliverydbupdated-amx6l91gn-shi-jia-huangs-projects.vercel.app';

async function testSingleOrder() {
  try {
    const response = await axios.post(`${BASE_URL}/api/orders`, {
      name: '王小明',
      phone: '0912345678',
      address: '新北市三峽區中山路100號',
      items: [
        { productId: 3, quantity: 2, price: 40 }, // 青江菜
        { productId: 5, quantity: 1, price: 60 }  // 小黃瓜
      ],
      paymentMethod: 'cash',
      notes: '測試訂單 - 王小明'
    }, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    console.log('✅ 測試訂單成功:', response.data);
    return response.data.order_id;
  } catch (error) {
    console.error('❌ 測試訂單失敗:', error.response?.data || error.message);
    return null;
  }
}

testSingleOrder();