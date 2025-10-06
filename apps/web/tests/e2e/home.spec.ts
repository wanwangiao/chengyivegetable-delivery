import { test, expect } from '@playwright/test';

test.describe('Home page', () => {
  test('displays store info and category filters', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('.store-name')).toContainText('誠憶鮮蔬');
    await expect(page.locator('.category-tab').first()).toBeVisible();
    await expect(page.locator('.cta-card').first()).toBeVisible();
  });
});
