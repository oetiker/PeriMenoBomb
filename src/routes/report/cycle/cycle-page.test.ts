import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/svelte';
import { tick } from 'svelte';
import { resetDatabase } from '$lib/db';
import { createSymptom } from '$lib/db/symptoms';
import { upsertEntry } from '$lib/db/entries';
import { setMeta } from '$lib/db/meta';
import Page from './+page.svelte';

async function flush() { await tick(); await new Promise((r) => setTimeout(r, 30)); await tick(); }

describe('Cycle heatmap page', () => {
  beforeEach(() => resetDatabase());

  it('shows an empty state when the anchor has no occurrences', async () => {
    const anchor = await createSymptom({ name: 'Start Mens' });
    const value = await createSymptom({ name: 'Kopfweh', inputs: {
      slider: { enabled: true, required: false, lowLabel: 'leicht', highLabel: 'stark' },
      number: { enabled: false, required: false, unit: '', integer: true },
      comment: { enabled: false, required: false }
    } });
    await setMeta('report.cycle.anchorId', anchor.id);
    await setMeta('report.cycle.valueId', value.id);
    render(Page);
    await flush();
    await waitFor(() => {
      expect(screen.getByText(/Keine .*Anker|Noch keine/i)).toBeTruthy();
    }, { timeout: 2000 });
  });

  it('renders heatmap cells when anchor occurrences and value entries exist', async () => {
    const anchor = await createSymptom({ name: 'Start Mens' });
    const value = await createSymptom({ name: 'Kopfweh', inputs: {
      slider: { enabled: true, required: false, lowLabel: 'leicht', highLabel: 'stark' },
      number: { enabled: false, required: false, unit: '', integer: true },
      comment: { enabled: false, required: false }
    } });
    await upsertEntry({ date: '2026-05-18', symptomId: anchor.id });
    await upsertEntry({ date: '2026-05-17', symptomId: value.id, sliderValue: 80 });
    await setMeta('report.cycle.anchorId', anchor.id);
    await setMeta('report.cycle.valueId', value.id);
    render(Page);
    await flush();
    // One column (one anchor occurrence) × 63 offsets → 63 cells rendered.
    await waitFor(() => {
      const cells = document.querySelectorAll('[data-cell]');
      expect(cells.length).toBe(63);
    }, { timeout: 2000 });
  });
});
