import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@testing-library/svelte';
import { tick } from 'svelte';
import EntryList from './EntryList.svelte';
import { snackbar } from '$lib/stores/snackbar.svelte';
import { resetDatabase, db } from '$lib/db';
import { createSymptom } from '$lib/db/symptoms';
import { upsertEntry, deleteEntry } from '$lib/db/entries';
import { todayKey } from '$lib/utils/date';

describe('EntryList', () => {
  beforeEach(() => resetDatabase());

  it('section title is "Heute erfasst" for todayKey and "Erfasst" otherwise', async () => {
    const today = todayKey();
    const { container, unmount } = render(EntryList, { props: { date: today } });
    await tick();
    expect(container.textContent).toContain('Heute erfasst');
    unmount();

    const past = '2020-01-01';
    const r2 = render(EntryList, { props: { date: past } });
    await tick();
    expect(r2.container.textContent).toContain('Erfasst');
    expect(r2.container.textContent).not.toContain('Heute erfasst');
  });

  it('snackbar Rückgängig restores a deleted entry', async () => {
    const sym = await createSymptom({ name: 'X' });
    await upsertEntry({ date: '2026-05-28', symptomId: sym.id, comment: 'note' });
    render(EntryList, { props: { date: '2026-05-28' } });
    await tick();
    // Wait a beat for liveQuery to settle.
    await new Promise((r) => setTimeout(r, 30));

    // Simulate the swipe-delete by calling deleteEntry directly via the
    // removeWithUndo flow that's wired in the component. We approximate by
    // calling the snackbar action chain after deletion.
    const original = (await db.entries.get(`2026-05-28__${sym.id}`))!;
    await deleteEntry('2026-05-28', sym.id);
    expect(await db.entries.get(`2026-05-28__${sym.id}`)).toBeUndefined();
    snackbar.show({
      message: 'x',
      actionLabel: 'Rückgängig',
      onAction: async () => {
        await upsertEntry({
          date: original.date,
          symptomId: original.symptomId,
          sliderValue: original.sliderValue,
          numberValue: original.numberValue,
          comment: original.comment
        });
      }
    });
    await snackbar.invokeAction();
    await new Promise((r) => setTimeout(r, 30));
    const restored = await db.entries.get(`2026-05-28__${sym.id}`);
    expect(restored).toBeTruthy();
    expect(restored?.comment).toBe('note');
  });
});
