import bcrypt from 'bcryptjs';
import { prisma } from '../src/infrastructure/prisma/client';

async function main() {
  console.log('🌱 Seeding base data...');

  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@chengyi.tw';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'Admin123456';
  const driverEmail = process.env.SEED_DRIVER_EMAIL ?? 'driver@chengyi.tw';
  const driverPassword = process.env.SEED_DRIVER_PASSWORD ?? 'Driver123456';

  const adminHash = await bcrypt.hash(adminPassword, 10);
  const driverHash = await bcrypt.hash(driverPassword, 10);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      password: adminHash,
      name: '系統管理員',
      role: 'ADMIN',
      isActive: true
    }
  });

  const driverUser = await prisma.user.upsert({
    where: { email: driverEmail },
    update: {},
    create: {
      email: driverEmail,
      password: driverHash,
      name: '配送夥伴',
      role: 'DRIVER',
      isActive: true
    }
  });

  const driverProfile = await prisma.driver.upsert({
    where: { id: driverUser.id },
    update: {
      status: 'available'
    },
    create: {
      id: driverUser.id,
      name: '配送夥伴',
      phone: '0912-345-678',
      status: 'available'
    }
  });

  console.log('✅ Admin user:', admin.email);
  console.log('✅ Driver user:', driverUser.email, 'Driver profile:', driverProfile.name);

  const productsCount = await prisma.product.count();
  if (productsCount === 0) {
    await prisma.product.createMany({
      data: [
        {
          name: '彩椒綜合包',
          category: '熱門精選',
          unit: '包',
          price: 180,
          stock: 25,
          isAvailable: true
        },
        {
          name: '有機小黃瓜',
          category: '本日推薦',
          unit: '斤',
          price: 120,
          stock: 40,
          isAvailable: true
        },
        {
          name: '花椰菜（綠）',
          category: '葉菜類',
          unit: '顆',
          price: 90,
          stock: 30,
          isAvailable: true
        }
      ]
    });
    console.log('✅ Seeded sample products');
  }

  const deliveryAreaCount = await prisma.deliveryArea.count();
  if (deliveryAreaCount === 0) {
    await prisma.deliveryArea.createMany({
      data: [
        {
          name: '中和永和地區',
          polygon: {
            type: 'Polygon',
            coordinates: []
          },
          isActive: true
        },
        {
          name: '台北市中心',
          polygon: {
            type: 'Polygon',
            coordinates: []
          },
          isActive: true
        }
      ]
    });
    console.log('✅ Seeded delivery areas');
  }
  await prisma.deliveryConfig.upsert({
    where: { id: 'delivery-config' },
    update: {},
    create: {
      pickupName: '未設定取貨點',
      pickupAddress: '',
      pickupLat: 0,
      pickupLng: 0,
      recommendedBatchMin: 5,
      recommendedBatchMax: 8,
      autoBatchingEnabled: true
    }
  });
  console.log('🚚Delivery config ready');

}

main()
  .then(async () => {
    await prisma.$disconnect();
    console.log('🌱 Seed completed');
  })
  .catch(async (error) => {
    console.error('❌ Seed failed', error);
    await prisma.$disconnect();
    process.exit(1);
  });
