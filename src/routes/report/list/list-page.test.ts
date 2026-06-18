import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import { resetDatabase } from '$lib/db';
import { createSymptom } from '$lib/db/symptoms';
import { upsertEntry } from '$lib/db/entries';
import { newField } from '$lib/db/fields';
import Page from './+page.svelte';

// Flush liveQueryEffect: wait for Dexie observable to fire, then force a
// re-render via rerender({}) which flushes the pending Svelte state update.
async function flush(rerenderFn: (props: Record<string, never>) => Promise<void>) {
  await tick();
  await new Promise((r) => setTimeout(r, 50));
  await rerenderFn({});
  await tick();
}

describe('Event-List page', () => {
  beforeEach(() => resetDatabase());

  it('lists entries grouped by day with the symptom name', async () => {
    // Create symptom with a text field so the logged note renders
    const note = newField('text');
    const s = await createSymptom({ name: 'Kopfweh', fields: [note] });
    await upsertEntry({ date: '2026-05-18', symptomId: s.id, values: { [note.id]: 'morgens' } });
    const { rerender } = render(Page);
    await flush(rerender);
    // symptom name appears in both the filter chip and the entry row
    expect(screen.getAllByText('Kopfweh').length).toBeGreaterThan(0);
    expect(screen.getByText(/morgens/)).toBeTruthy();
  });

  it('shows an export button', async () => {
    const { rerender } = render(Page);
    await flush(rerender);
    expect(screen.getByRole('button', { name: /PDF/ })).toBeTruthy();
  });
});
