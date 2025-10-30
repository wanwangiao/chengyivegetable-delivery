/**
 * 為玉米商品新增選項
 * - 第一組「處理方式」：要撥 / 不撥 (必選、單選)
 * - 第二組「切割方式」：要切 / 不切 (必選、單選)
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌽 開始為玉米商品新增選項...\n');

  // 查詢所有包含「玉米」的商品
  const cornProducts = await prisma.product.findMany({
    where: {
      name: {
        contains: '玉米',
        mode: 'insensitive'
      }
    },
    include: {
      options: true
    }
  });

  if (cornProducts.length === 0) {
    console.log('❌ 未找到玉米商品');
    return;
  }

  console.log(`✅ 找到 ${cornProducts.length} 個玉米商品：`);
  cornProducts.forEach(p => console.log(`   - ${p.name} (${p.id})`));
  console.log('');

  for (const product of cornProducts) {
    console.log(`🔧 處理商品：${product.name}`);

    // 刪除現有選項（如果有）
    if (product.options.length > 0) {
      await prisma.productOption.deleteMany({
        where: { productId: product.id }
      });
      console.log(`   清除了 ${product.options.length} 個現有選項`);
    }

    // 新增第一組選項：處理方式（要撥/不撥）
    const option1 = await prisma.productOption.create({
      data: {
        productId: product.id,
        name: '要撥',
        price: null,
        groupName: '處理方式',
        isRequired: true,
        selectionType: 'single',
        sortOrder: 1
      }
    });

    const option2 = await prisma.productOption.create({
      data: {
        productId: product.id,
        name: '不撥',
        price: null,
        groupName: '處理方式',
        isRequired: true,
        selectionType: 'single',
        sortOrder: 2
      }
    });

    // 新增第二組選項：切割方式（要切/不切）
    const option3 = await prisma.productOption.create({
      data: {
        productId: product.id,
        name: '要切',
        price: null,
        groupName: '切割方式',
        isRequired: true,
        selectionType: 'single',
        sortOrder: 3
      }
    });

    const option4 = await prisma.productOption.create({
      data: {
        productId: product.id,
        name: '不切',
        price: null,
        groupName: '切割方式',
        isRequired: true,
        selectionType: 'single',
        sortOrder: 4
      }
    });

    console.log(`   ✅ 新增了 4 個選項：`);
    console.log(`      組1「處理方式」：要撥、不撥 (必選、單選)`);
    console.log(`      組2「切割方式」：要切、不切 (必選、單選)`);
    console.log('');
  }

  console.log('🎉 完成！所有玉米商品已新增選項\n');
}

main()
  .catch((e) => {
    console.error('❌ 錯誤:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
