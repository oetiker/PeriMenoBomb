import { test, expect } from '@playwright/test';

test('first run → template → daily prompt → slider + Speichern → card in Heute erfasst', async ({ page }) => {
  // (Editor save/delete buttons: "Speichern" enables an entry, "Löschen" removes it.)
  await page.goto('/');
  await page.waitForURL(/\/day\/\d{4}-\d{2}-\d{2}/);

  // First run banner: import template
  await expect(page.getByRole('button', { name: 'Mit Standard-Vorlage starten' })).toBeVisible();
  await page.getByRole('button', { name: 'Mit Standard-Vorlage starten' }).click();

  // After import: Daily-Prompts appear at top.
  // Template marks Stimmungstief as daily → it shows under "Noch offen".
  await expect(page.getByText('Noch offen')).toBeVisible();
  await expect(page.locator('button:has-text("Stimmungstief")').first()).toBeVisible();

  // Tap the prompt → Editor opens.
  await page.locator('button:has-text("Stimmungstief")').first().click();

  // Stimmungstief's slider is optional (required = false in default template),
  // so Speichern is enabled right away — the whole point of the daily-prompt flow.
  await expect(page.getByRole('button', { name: 'Speichern' })).toBeEnabled();

  // Click on the slider track in the continuous zone (right side) to set a value.
  const track = page.locator('[data-track]').first();
  const box = await track.boundingBox();
  if (!box) throw new Error('track missing');
  await page.mouse.click(box.x + box.width * 0.7, box.y + box.height / 2);

  // Still enabled, save the entry.
  await expect(page.getByRole('button', { name: 'Speichern' })).toBeEnabled();
  await page.getByRole('button', { name: 'Speichern' }).click();

  // Card appears in the "Heute erfasst" section.
  await expect(page.getByText(/Heute erfasst/)).toBeVisible();
  // DailyPromptCard (data-muted="true") and EntryCard share class="card";
  // the prompt for Stimmungstief may briefly remain until liveQuery refreshes,
  // so we exclude muted cards to target the saved entry only.
  const card = page.locator('button.card:not([data-muted])').filter({ hasText: 'Stimmungstief' });
  await expect(card).toBeVisible();
});
