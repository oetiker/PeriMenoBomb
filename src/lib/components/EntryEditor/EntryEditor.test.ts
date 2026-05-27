import { describe, it, expect, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { tick } from 'svelte';
import EntryEditor from './EntryEditor.svelte';
import { resetDatabase } from '$lib/db';
import { createSymptom } from '$lib/db/symptoms';
import { upsertEntry, getEntry } from '$lib/db/entries';

describe('EntryEditor', () => {
  beforeEach(() => resetDatabase());

  it('updates the entry intensity on button tap', async () => {
    const sym = await createSymptom({ name: 'Hitzewallungen' });
    await upsertEntry({ date: '2026-05-27', symptomId: sym.id });
    const { getByText } = render(EntryEditor, {
      props: { open: true, date: '2026-05-27', symptom: sym, onClose: () => {} }
    });
    await fireEvent.click(getByText('Mittel'));
    await tick();
    await new Promise((r) => setTimeout(r, 30));
    const after = await getEntry('2026-05-27', sym.id);
    expect(after?.intensity).toBe('mittel');
  });

  it('delete removes the entry and closes', async () => {
    const sym = await createSymptom({ name: 'X' });
    await upsertEntry({ date: '2026-05-27', symptomId: sym.id, intensity: 'leicht' });
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
