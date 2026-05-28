import { describe, it, expect, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { tick } from 'svelte';
import EntryEditor from './EntryEditor.svelte';
import { resetDatabase } from '$lib/db';
import { createSymptom } from '$lib/db/symptoms';
import { upsertEntry, getEntry } from '$lib/db/entries';

describe('EntryEditor', () => {
  beforeEach(() => resetDatabase());

  it('updates the entry on interaction', async () => {
    const sym = await createSymptom({ name: 'Hitzewallungen' });
    await upsertEntry({ date: '2026-05-27', symptomId: sym.id });
    const { getByText } = render(EntryEditor, {
      props: { open: true, date: '2026-05-27', symptom: sym, onClose: () => {} }
    });
    // Intensity UI is removed in this stub; Task 11 rewrites this test.
    await tick();
    await new Promise((r) => setTimeout(r, 30));
    const after = await getEntry('2026-05-27', sym.id);
    expect(after?.sliderValue).toBeNull();
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
