import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 建立測試 LINE 使用者...');

  // 建立測試 LINE 使用者
  const testUser = await prisma.lineUser.upsert({
    where: { lineUserId: 'Utest123456789abcdef0123456789ab' },
    update: {},
    create: {
      lineUserId: 'Utest123456789abcdef0123456789ab',
      displayName: '測試客戶',
      phone: '0912345678',
    },
  });

  console.log('✅ 測試 LINE 使用者已建立：', testUser);

  // 查詢確認
  const allTestUsers = await prisma.lineUser.findMany({
    where: {
      lineUserId: {
        startsWith: 'Utest',
      },
    },
  });

  console.log('📋 所有測試使用者：', allTestUsers);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ 錯誤：', e);
    await prisma.$disconnect();
    process.exit(1);
  });
