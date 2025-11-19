/**
 * 執行 SQL migration: 新增 ProductOption.isActive 欄位
 */

import * as dotenv from 'dotenv';
import { resolve } from 'path';
import { PrismaClient } from '@prisma/client';

// 加載 .env 文件
dotenv.config({ path: resolve(__dirname, '.env') });

const prisma = new PrismaClient();

async function runMigration() {
  console.log('開始執行 migration...\n');

  try {
    // 新增 isActive 欄位
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "ProductOption"
      ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;
    `);

    console.log('✅ 已新增 ProductOption.isActive 欄位\n');

    // 確認欄位
    const result = await prisma.$queryRawUnsafe(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'ProductOption' AND column_name = 'isActive';
    `);

    console.log('欄位資訊:', result);
    console.log('\n✅ Migration 執行成功！');

  } catch (error) {
    console.error('❌ Migration 執行失敗:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

runMigration()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
