import { test, expect } from '@playwright/test';

test('cycle heatmap renders with selectors after template import', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Mit Standard-Vorlage starten' }).click();
  await page.goto('/report/cycle');
  await expect(page.getByRole('heading', { name: 'Zyklus-Heatmap' })).toBeVisible();
  await expect(page.getByLabel('Anker wählen')).toBeVisible();
  await expect(page.getByLabel('Farb-Symptom wählen')).toBeVisible();
  // Fresh import has no entries → empty state for the heatmap body.
  await expect(page.getByText(/Keine Anker-Erfassungen/)).toBeVisible();
});
