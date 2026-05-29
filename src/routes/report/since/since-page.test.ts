import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import { resetDatabase } from '$lib/db';
import { createSymptom } from '$lib/db/symptoms';
import { upsertEntry } from '$lib/db/entries';
import Page from './+page.svelte';

async function flush() { await tick(); await new Promise((r) => setTimeout(r, 30)); await tick(); }

describe('Since-View page', () => {
  beforeEach(() => resetDatabase());

  it('shows an empty state when the selected symptom has no occurrences', async () => {
    const s = await createSymptom({ name: 'Start Mens' });
    await import('$lib/db/meta').then((m) => m.setMeta('report.since.symptomId', s.id));
    render(Page);
    await flush();
    expect(screen.getByText(/Noch keine Erfassung/)).toBeTruthy();
  });

  it('shows the interval list and stats when occurrences exist', async () => {
    const s = await createSymptom({ name: 'Start Mens' });
    await upsertEntry({ date: '2026-03-20', symptomId: s.id });
    await upsertEntry({ date: '2026-04-21', symptomId: s.id });
    await upsertEntry({ date: '2026-05-18', symptomId: s.id });
    await import('$lib/db/meta').then((m) => m.setMeta('report.since.symptomId', s.id));
    render(Page);
    await flush();
    // avg of 32 and 27 = 30 (rounded)
    expect(screen.getByText(/Ø\s*30/)).toBeTruthy();
  });
});
