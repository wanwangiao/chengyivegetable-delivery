const axios = require('axios');

const BASE_URL = 'https://vegdeliverydbupdated-667yp22m0-shi-jia-huangs-projects.vercel.app';

// 測試訂單資料 - 集中在三峽、樹林、鶯歌、土城、北大區域
const testOrders = [
  // 三峽區域
  {
    contact_name: '王小明',
    contact_phone: '0912345678',
    address: '新北市三峽區中山路100號',
    lat: 24.9345,
    lng: 121.3688,
    items: [
      { id: 3, quantity: 2, price: 40 }, // 青江菜
      { id: 5, quantity: 1, price: 60 }  // 小黃瓜
    ]
  },
  {
    contact_name: '李美華',
    contact_phone: '0923456789',
    address: '新北市三峽區復興路50號',
    lat: 24.9378,
    lng: 121.3712,
    items: [
      { id: 7, quantity: 3, price: 50 }, // 空心菜
      { id: 9, quantity: 2, price: 80 }  // 水果玉米
    ]
  },
  {
    contact_name: '張志強',
    contact_phone: '0934567890',
    address: '新北市三峽區民生街25號',
    lat: 24.9322,
    lng: 121.3665,
    items: [
      { id: 3, quantity: 1, price: 40 },
      { id: 7, quantity: 2, price: 50 },
      { id: 12, quantity: 1, price: 28 }
    ]
  },
  // 樹林區域
  {
    contact_name: '陳淑芬',
    contact_phone: '0945678901',
    address: '新北市樹林區中正路200號',
    lat: 24.9924,
    lng: 121.4244,
    items: [
      { id: 5, quantity: 2, price: 60 },
      { id: 9, quantity: 1, price: 80 }
    ]
  },
  {
    contact_name: '劉建國',
    contact_phone: '0956789012',
    address: '新北市樹林區保安街一段88號',
    lat: 24.9889,
    lng: 121.4289,
    items: [
      { id: 3, quantity: 3, price: 40 },
      { id: 7, quantity: 1, price: 50 }
    ]
  },
  {
    contact_name: '黃雅玲',
    contact_phone: '0967890123',
    address: '新北市樹林區大安路150號',
    lat: 24.9856,
    lng: 121.4156,
    items: [
      { id: 12, quantity: 3, price: 28 },
      { id: 5, quantity: 1, price: 60 }
    ]
  },
  // 鶯歌區域
  {
    contact_name: '吳志明',
    contact_phone: '0978901234',
    address: '新北市鶯歌區中山路300號',
    lat: 24.9565,
    lng: 121.3514,
    items: [
      { id: 9, quantity: 2, price: 80 },
      { id: 7, quantity: 2, price: 50 }
    ]
  },
  {
    contact_name: '林佳慧',
    contact_phone: '0989012345',
    address: '新北市鶯歌區文化路75號',
    lat: 24.9587,
    lng: 121.3576,
    items: [
      { id: 3, quantity: 2, price: 40 },
      { id: 12, quantity: 2, price: 28 }
    ]
  },
  {
    contact_name: '何俊傑',
    contact_phone: '0990123456',
    address: '新北市鶯歌區重慶街120號',
    lat: 24.9534,
    lng: 121.3498,
    items: [
      { id: 5, quantity: 3, price: 60 },
      { id: 9, quantity: 1, price: 80 }
    ]
  },
  // 土城區域
  {
    contact_name: '鄭雅婷',
    contact_phone: '0901234567',
    address: '新北市土城區中央路二段180號',
    lat: 24.9823,
    lng: 121.4567,
    items: [
      { id: 7, quantity: 4, price: 50 },
      { id: 3, quantity: 1, price: 40 }
    ]
  },
  {
    contact_name: '趙文斌',
    contact_phone: '0912345679',
    address: '新北市土城區金城路三段66號',
    lat: 24.9756,
    lng: 121.4623,
    items: [
      { id: 12, quantity: 2, price: 28 },
      { id: 5, quantity: 2, price: 60 }
    ]
  },
  {
    contact_name: '孫美玲',
    contact_phone: '0923456780',
    address: '新北市土城區學府路90號',
    lat: 24.9689,
    lng: 121.4445,
    items: [
      { id: 9, quantity: 3, price: 80 },
      { id: 7, quantity: 1, price: 50 }
    ]
  },
  // 北大特區（三峽）
  {
    contact_name: '馬志華',
    contact_phone: '0934567801',
    address: '新北市三峽區大學路188號',
    lat: 24.9412,
    lng: 121.3745,
    items: [
      { id: 3, quantity: 4, price: 40 },
      { id: 12, quantity: 1, price: 28 }
    ]
  },
  {
    contact_name: '周淑雯',
    contact_phone: '0945678012',
    address: '新北市三峽區學成路300號',
    lat: 24.9445,
    lng: 121.3789,
    items: [
      { id: 5, quantity: 1, price: 60 },
      { id: 9, quantity: 2, price: 80 },
      { id: 7, quantity: 1, price: 50 }
    ]
  },
  {
    contact_name: '許志偉',
    contact_phone: '0956789023',
    address: '新北市三峽區國際一街77號',
    lat: 24.9398,
    lng: 121.3723,
    items: [
      { id: 12, quantity: 5, price: 28 },
      { id: 3, quantity: 2, price: 40 }
    ]
  }
];

async function createOrder(orderData) {
  try {
    // 計算總金額
    const total_amount = orderData.items.reduce((sum, item) => {
      return sum + (item.price * item.quantity);
    }, 0);

    const response = await axios.post(`${BASE_URL}/api/orders`, {
      name: orderData.contact_name,
      phone: orderData.contact_phone,
      address: orderData.address,
      lat: orderData.lat,
      lng: orderData.lng,
      items: orderData.items,
      paymentMethod: 'cash',
      notes: `測試訂單 - ${orderData.contact_name}`
    }, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    console.log(`✅ 訂單成功 - ${orderData.contact_name}: ${response.data.order_id}`);
    return response.data.order_id;
  } catch (error) {
    console.error(`❌ 訂單失敗 - ${orderData.contact_name}:`, error.message);
    return null;
  }
}

async function createAllOrders() {
  console.log('🚀 開始建立15筆測試訂單...\n');
  
  const orderIds = [];
  for (let i = 0; i < testOrders.length; i++) {
    const orderId = await createOrder(testOrders[i]);
    if (orderId) {
      orderIds.push(orderId);
    }
    
    // 延遲2秒避免rate limiting
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  console.log(`\n✅ 完成！成功建立 ${orderIds.length} 筆訂單`);
  console.log('訂單ID:', orderIds);
  
  return orderIds;
}

if (require.main === module) {
  createAllOrders().catch(console.error);
}

module.exports = { createAllOrders, testOrders };