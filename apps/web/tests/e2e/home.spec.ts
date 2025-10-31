import { test, expect } from '@playwright/test';

test.describe('Home page', () => {
  test('displays store info and category filters', async ({ page }) => {
    await page.goto('/');

    // 驗證店名存在（使用文本匹配，不依賴 CSS class）
    await expect(page.getByRole('heading', { name: '誠憶鮮蔬' })).toBeVisible();

    // 驗證分類標籤存在
    await expect(page.getByRole('button', { name: '全部商品' })).toBeVisible();

    // 驗證 CTA 卡片存在
    await expect(page.getByRole('heading', { name: '訂單查詢' })).toBeVisible();
  });
});
