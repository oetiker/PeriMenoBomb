import { test, expect } from '@playwright/test';

test('report hub shows three analysis entries and they navigate', async ({ page }) => {
  await page.goto('/report');
  await expect(page.getByRole('link', { name: /Zyklus-Heatmap/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /Tage seit/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /Ereignis-Liste/ })).toBeVisible();

  await page.getByRole('link', { name: /Zyklus-Heatmap/ }).click();
  await expect(page).toHaveURL(/\/report\/cycle$/);
  await expect(page.getByRole('heading', { name: 'Zyklus-Heatmap' })).toBeVisible();
});
