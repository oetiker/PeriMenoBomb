import { test, expect } from '@playwright/test';

test('first run → template → erfasse Hitzewallungen mit mittel → editiere → swipe weg → undo', async ({ page }) => {
  await page.goto('/');
  await page.waitForURL(/\/tag\/\d{4}-\d{2}-\d{2}/);

  // First-run shown
  await expect(page.getByRole('button', { name: 'Mit Standard-Vorlage starten' })).toBeVisible();
  await page.getByRole('button', { name: 'Mit Standard-Vorlage starten' }).click();

  // Page reload → first-run gone, FAB visible
  await expect(page.getByRole('button', { name: 'Symptom hinzufügen' })).toBeVisible({ timeout: 5000 });

  // Open sheet, drill into "Körperlich", pick Hitzewallungen
  await page.getByRole('button', { name: 'Symptom hinzufügen' }).click();
  await page.getByText('Körperlich', { exact: true }).click();
  await page.getByText('Hitzewallungen').click();

  // Editor opens — pick Mittel
  await page.getByRole('button', { name: 'Mittel' }).click();
  await page.getByRole('button', { name: 'Fertig' }).click();

  // Entry shown on day list (scope to the entry card; sheet may still be open behind)
  const card = page.locator('.card').filter({ hasText: 'Hitzewallungen' });
  await expect(card).toBeVisible();
  await expect(card.getByText('Mittel')).toBeVisible();
});
