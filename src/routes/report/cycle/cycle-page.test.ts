import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/svelte';
import { tick } from 'svelte';
import { resetDatabase } from '$lib/db';
import { createSymptom } from '$lib/db/symptoms';
import { upsertEntry } from '$lib/db/entries';
import { newField } from '$lib/db/fields';
import { setMeta } from '$lib/db/meta';
import Page from './+page.svelte';

async function flush() { await tick(); await new Promise((r) => setTimeout(r, 30)); await tick(); }

describe('Cycle heatmap page', () => {
  beforeEach(() => resetDatabase());

  it('shows an empty state when the anchor has no occurrences', async () => {
    const anchor = await createSymptom({ name: 'Start Mens' });
    const slider = newField('slider');
    const value = await createSymptom({ name: 'Kopfweh', fields: [slider] });
    await setMeta('report.cycle.anchorId', anchor.id);
    await setMeta('report.cycle.valueId', value.id);
    await setMeta('report.cycle.valueFieldId', slider.id);
    render(Page);
    await flush();
    await waitFor(() => {
      expect(screen.getByText(/Keine .*Anker|Noch keine/i)).toBeTruthy();
    }, { timeout: 2000 });
  });

  it('renders heatmap cells when anchor occurrences and value entries exist', async () => {
    const anchor = await createSymptom({ name: 'Start Mens' });
    const slider = newField('slider');
    const value = await createSymptom({ name: 'Kopfweh', fields: [slider] });
    await upsertEntry({ date: '2026-05-18', symptomId: anchor.id, values: {} });
    await upsertEntry({ date: '2026-05-17', symptomId: value.id, values: { [slider.id]: 80 } });
    await setMeta('report.cycle.anchorId', anchor.id);
    await setMeta('report.cycle.valueId', value.id);
    await setMeta('report.cycle.valueFieldId', slider.id);
    render(Page);
    await flush();
    // Virtualized infinite grid: a window of cells is rendered for the default
    // viewport (jsdom has no layout, so the component falls back to a sane
    // default size). We only assert the grid renders cells, not an exact count.
    await waitFor(() => {
      const cells = document.querySelectorAll('[data-cell]');
      expect(cells.length).toBeGreaterThan(0);
    }, { timeout: 2000 });
  });

  it('offers one focus option per value field labeled "Symptom [Feld]"', async () => {
    const anchor = await createSymptom({ name: 'Start Mens' });
    const sys = newField('number'); if (sys.type === 'number') sys.label = 'Systolisch';
    const dia = newField('number'); if (dia.type === 'number') dia.label = 'Diastolisch';
    await createSymptom({ name: 'Blutdruck', fields: [sys, dia] });
    await setMeta('report.cycle.anchorId', anchor.id);
    render(Page);
    await flush();
    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Blutdruck [Systolisch]' })).toBeTruthy();
      expect(screen.getByRole('option', { name: 'Blutdruck [Diastolisch]' })).toBeTruthy();
    }, { timeout: 2000 });
  });
});
