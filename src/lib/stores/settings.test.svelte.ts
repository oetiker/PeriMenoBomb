import { describe, it, expect, beforeEach } from 'vitest';
import { resetDatabase, db } from '$lib/db';
import { settings, loadSettings } from './settings.svelte';
import { exportAll, importAll } from '$lib/utils/transfer';

describe('slider-step setting survives a backup round-trip', () => {
  beforeEach(() => resetDatabase());

  it('writes sliderStep into the backup payload', async () => {
    await settings.setSliderStep(10);
    const payload = await exportAll();
    expect(payload.meta.find((m) => m.key === 'sliderStep')?.value).toBe(10);
  });

  it('restores sliderStep into the meta table on import', async () => {
    await settings.setSliderStep(10);
    const payload = await exportAll();
    await resetDatabase();
    await importAll(payload, 'replace');
    expect((await db.meta.get('sliderStep'))?.value).toBe(10);
  });

  it('reflects the restored value in the live settings store after a reload', async () => {
    await settings.setSliderStep(10);
    const payload = await exportAll();

    // Simulate a fresh start: wipe + initial load → back to default.
    await resetDatabase();
    await loadSettings();
    expect(settings.sliderStep).toBe(1);

    // Importing the backup restores the meta row...
    await importAll(payload, 'replace');
    // ...and re-reading settings surfaces it (this is what the import flow must do).
    await loadSettings();
    expect(settings.sliderStep).toBe(10);
  });
});
