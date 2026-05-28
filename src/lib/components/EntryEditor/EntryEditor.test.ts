import { describe, it, expect, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { tick } from 'svelte';
import EntryEditor from './EntryEditor.svelte';
import { resetDatabase } from '$lib/db';
import { createSymptom } from '$lib/db/symptoms';
import { upsertEntry, getEntry } from '$lib/db/entries';

describe('EntryEditor', () => {
  beforeEach(() => resetDatabase());

  // Tests rewritten in Task 11 against the new editor — see plan.
  it('renders the comment textarea when open', async () => {
    const sym = await createSymptom({ name: 'Hitzewallungen' });
    await upsertEntry({ date: '2026-05-27', symptomId: sym.id });
    render(EntryEditor, {
      props: { open: true, date: '2026-05-27', symptom: sym, onClose: () => {} }
    });
    await tick();
    expect(document.querySelector('textarea')).toBeTruthy();
  });

  it('delete removes the entry and closes', async () => {
    const sym = await createSymptom({ name: 'X' });
    await upsertEntry({ date: '2026-05-27', symptomId: sym.id, sliderValue: 50 });
    let closed = false;
    const { getByText } = render(EntryEditor, {
      props: {
        open: true,
        date: '2026-05-27',
        symptom: sym,
        onClose: () => {
          closed = true;
        }
      }
    });
    await fireEvent.click(getByText('🗑 Eintrag entfernen'));
    await tick();
    expect(await getEntry('2026-05-27', sym.id)).toBeUndefined();
    expect(closed).toBe(true);
  });
});
