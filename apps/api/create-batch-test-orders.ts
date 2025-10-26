import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 台北市各區的測試地址
const testAddresses = [
  { name: '林小明', phone: '0912345678', address: '台北市信義區市府路1號', lat: 25.0375, lng: 121.5637 },
  { name: '陳大華', phone: '0923456789', address: '台北市大安區忠孝東路四段123號', lat: 25.0418, lng: 121.5436 },
  { name: '王美玲', phone: '0934567890', address: '台北市中山區南京東路三段256號', lat: 25.0519, lng: 121.5443 },
  { name: '張家豪', phone: '0945678901', address: '台北市松山區八德路四段88號', lat: 25.0487, lng: 121.5597 },
  { name: '李雅婷', phone: '0956789012', address: '台北市內湖區成功路四段188號', lat: 25.0784, lng: 121.5829 },
  { name: '黃志明', phone: '0967890123', address: '台北市南港區南港路一段68號', lat: 25.0525, lng: 121.6069 },
  { name: '吳佳蓉', phone: '0978901234', address: '台北市文山區羅斯福路六段142號', lat: 24.9981, lng: 121.5397 },
  { name: '劉建宏', phone: '0989012345', address: '台北市士林區中山北路六段88號', lat: 25.0937, lng: 121.5261 },
  { name: '鄭淑芬', phone: '0990123456', address: '台北市北投區大業路500號', lat: 25.1183, lng: 121.5095 },
  { name: '謝俊傑', phone: '0901234567', address: '台北市萬華區桂林路100號', lat: 25.0303, lng: 121.5023 }
];

// 測試商品
const testProducts = [
  { id: 'cabbage', name: '高麗菜', unitPrice: 150, unit: '顆' },
  { id: 'tomato', name: '番茄', unitPrice: 200, unit: '斤' },
  { id: 'cucumber', name: '小黃瓜', unitPrice: 120, unit: '斤' },
  { id: 'carrot', name: '紅蘿蔔', unitPrice: 80, unit: '斤' },
  { id: 'spinach', name: '菠菜', unitPrice: 100, unit: '斤' },
  { id: 'lettuce', name: '萵苣', unitPrice: 90, unit: '顆' }
];

async function createBatchTestOrders() {
  try {
    console.log('開始建立測試訂單...');

    const orders = [];

    for (let i = 0; i < testAddresses.length; i++) {
      const addr = testAddresses[i];

      // 隨機選擇 1-3 個商品
      const itemCount = Math.floor(Math.random() * 3) + 1;
      const selectedProducts = [];
      const usedIndices = new Set();

      while (selectedProducts.length < itemCount) {
        const idx = Math.floor(Math.random() * testProducts.length);
        if (!usedIndices.has(idx)) {
          usedIndices.add(idx);
          const product = testProducts[idx];
          const quantity = Math.floor(Math.random() * 3) + 1;
          selectedProducts.push({
            productId: product.id,
            name: product.name,
            quantity,
            unit: product.unit,
            unitPrice: product.unitPrice,
            lineTotal: product.unitPrice * quantity
          });
        }
      }

      const subtotal = selectedProducts.reduce((sum, item) => sum + item.lineTotal, 0);
      const deliveryFee = 50;
      const totalAmount = subtotal + deliveryFee;

      const order = await prisma.order.create({
        data: {
          contactName: addr.name,
          contactPhone: addr.phone,
          address: addr.address,
          latitude: addr.lat,
          longitude: addr.lng,
          geocodedAt: new Date(),
          status: 'ready',
          subtotal,
          deliveryFee,
          totalAmount,
          paymentMethod: 'cash',
          notes: i % 3 === 0 ? '請按門鈴，謝謝！' : undefined,
          deliveryDate: new Date(),
          isPreOrder: false,
          items: {
            create: selectedProducts
          }
        },
        include: {
          items: true
        }
      });

      orders.push(order);
      console.log(`✓ 建立訂單 ${i + 1}/${testAddresses.length}: ${order.contactName} - ${order.address}`);
    }

    console.log(`\n✅ 成功建立 ${orders.length} 筆測試訂單！`);
    console.log('\n訂單摘要:');
    orders.forEach((order, index) => {
      console.log(`${index + 1}. ${order.contactName} - ${order.address}`);
      console.log(`   總金額: NT$${Number(order.totalAmount)} (${order.items.length} 項商品)`);
    });

    console.log('\n現在可以測試批次推薦功能了！');

  } catch (error) {
    console.error('建立測試訂單失敗:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createBatchTestOrders();
