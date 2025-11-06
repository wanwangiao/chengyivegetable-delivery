/**
 * 批量同步所有商品的 nextDayPrice 為與 price 相同的值
 *
 * 用途：
 * - 將所有商品的 nextDayPrice 設定為與 price 相同
 * - 修復 nextDayPrice 為 null 導致前台無法顯示動態價格的問題
 *
 * 執行方式：
 * cd apps/api
 * npx tsx ../../sync-next-day-prices.ts
 */

import * as dotenv from 'dotenv';
import { resolve } from 'path';
import { PrismaClient } from '@prisma/client';

// 加載 .env 文件
dotenv.config({ path: resolve(__dirname, '.env') });

const prisma = new PrismaClient();

async function syncNextDayPrices() {
  console.log('開始同步商品的 nextDayPrice...\n');

  try {
    // 1. 查詢所有商品
    const products = await prisma.product.findMany({
      select: {
        id: true,
        name: true,
        price: true,
        nextDayPrice: true,
      },
    });

    console.log(`找到 ${products.length} 個商品\n`);

    // 2. 統計需要更新的商品
    const needsUpdate = products.filter(
      (p) => p.price !== null && p.nextDayPrice !== p.price
    );

    console.log(`需要更新的商品數量: ${needsUpdate.length}\n`);

    if (needsUpdate.length === 0) {
      console.log('✅ 所有商品的 nextDayPrice 已經與 price 同步，無需更新');
      return;
    }

    // 3. 顯示將要更新的商品
    console.log('將要更新的商品：');
    console.log('━'.repeat(80));
    needsUpdate.forEach((product) => {
      console.log(
        `${product.name.padEnd(20)} | 當前價: ${product.price?.toString() ?? 'null'} | 明日預估價: ${product.nextDayPrice?.toString() ?? 'null'}`
      );
    });
    console.log('━'.repeat(80));
    console.log('');

    // 4. 執行批量更新
    let successCount = 0;
    let errorCount = 0;

    for (const product of needsUpdate) {
      try {
        await prisma.product.update({
          where: { id: product.id },
          data: { nextDayPrice: product.price },
        });
        successCount++;
        console.log(`✅ ${product.name}: nextDayPrice 已更新為 ${product.price}`);
      } catch (error) {
        errorCount++;
        console.error(`❌ ${product.name}: 更新失敗`, error);
      }
    }

    console.log('\n' + '━'.repeat(80));
    console.log(`✅ 更新完成！`);
    console.log(`   成功: ${successCount} 個`);
    console.log(`   失敗: ${errorCount} 個`);
    console.log('━'.repeat(80));
  } catch (error) {
    console.error('❌ 執行過程中發生錯誤:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// 執行腳本
syncNextDayPrices()
  .then(() => {
    console.log('\n✅ 腳本執行完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ 腳本執行失敗:', error);
    process.exit(1);
  });
