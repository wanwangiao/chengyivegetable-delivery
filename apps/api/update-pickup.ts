import { prisma } from './src/infrastructure/prisma/client.js';

async function updatePickup() {
  const result = await prisma.deliveryConfig.update({
    where: { id: 'delivery-config' },
    data: {
      pickupName: '誠憶蔬菜配送中心',
      pickupAddress: '新北市三峽區民生街186號',
      pickupLat: 24.9346,
      pickupLng: 121.3689
    }
  });
  console.log('✅ 取貨點已設定:', result.pickupName, result.pickupAddress);
  await prisma.$disconnect();
}

updatePickup().catch(console.error);
