import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function createTestOrder() {
  try {
    // Create a test order in "ready" status for driver to claim
    const order = await prisma.order.create({
      data: {
        contactName: '測試客戶',
        contactPhone: '0987654321',
        address: '台北市信義區市府路1號',
        latitude: 25.0375,
        longitude: 121.5637,
        geocodedAt: new Date(),
        status: 'ready',
        subtotal: 500,
        deliveryFee: 50,
        totalAmount: 550,
        paymentMethod: 'cash',
        notes: '請按門鈴，謝謝！',
        deliveryDate: new Date(),
        isPreOrder: false,
        items: {
          create: [
            {
              productId: 'test-product-1',
              name: '高麗菜',
              quantity: 2,
              unit: '顆',
              unitPrice: 150,
              lineTotal: 300
            },
            {
              productId: 'test-product-2',
              name: '番茄',
              quantity: 1,
              unit: '斤',
              unitPrice: 200,
              lineTotal: 200
            }
          ]
        }
      },
      include: {
        items: true
      }
    });

    console.log('建立測試訂單成功！');
    console.log('訂單 ID:', order.id);
    console.log('地址:', order.address);
    console.log('狀態:', order.status);
    console.log('總金額:', Number(order.totalAmount));
    console.log('商品:', order.items.map(item => `${item.name} x${item.quantity}`).join(', '));
  } catch (error) {
    console.error('建立測試訂單失敗:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestOrder();
