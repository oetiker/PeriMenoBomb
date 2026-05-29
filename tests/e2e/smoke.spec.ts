import { test, expect } from '@playwright/test';

test('app loads', async ({ page }) => {
  await page.goto('/');
  await page.waitForURL(/\/day\/\d{4}-\d{2}-\d{2}/);
  await expect(page.getByRole('heading', { name: /Willkommen/ })).toBeVisible();
});
