import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { tick } from 'svelte';
import EntryEditor from './EntryEditor.svelte';
import { db, resetDatabase, type Symptom, type MetaField } from '$lib/db';
import { newField } from '$lib/db/fields';
import { snackbar } from '$lib/stores/snackbar.svelte';

function makeSymptom(p: Partial<Symptom> = {}): Symptom {
  return {
    id: 's1', name: 'X', color: '#000', icon: 'circle',
    tagIds: [], parentId: null, sortIndex: 0, depth: 0,
    isFolder: false, archived: false, createdAt: 0, updatedAt: 0,
    fields: [], daily: false, ...p
  };
}

describe('EntryEditor', () => {
  beforeEach(() => resetDatabase());
  afterEach(() => snackbar.dismiss());

  it('Speichern is enabled when nothing is required and writes a marker entry', async () => {
    const s = makeSymptom();
    const onClose = vi.fn();
    const { getByText } = render(EntryEditor, {
      props: { open: true, date: '2026-05-28', symptom: s, onClose }
    });
    const speichern = getByText('Speichern') as HTMLButtonElement;
    expect(speichern.disabled).toBe(false);
    await fireEvent.click(speichern);
    await tick();
    await new Promise((r) => setTimeout(r, 30));
    const entry = await db.entries.get('2026-05-28__s1');
    expect(entry).toBeTruthy();
    expect(entry?.values).toEqual({});
  });

  it('Speichern is disabled while a slider field is required and value is null', async () => {
    const slider: MetaField = { ...newField('slider'), required: true };
    const s = makeSymptom({ fields: [slider] });
    const { getByText } = render(EntryEditor, {
      props: { open: true, date: '2026-05-28', symptom: s, onClose: () => {} }
    });
    const speichern = getByText('Speichern') as HTMLButtonElement;
    expect(speichern.disabled).toBe(true);
  });

  it('Löschen closes without writing when no entry exists', async () => {
    const s = makeSymptom();
    const onClose = vi.fn();
    const { getByText } = render(EntryEditor, {
      props: { open: true, date: '2026-05-28', symptom: s, onClose }
    });
    await fireEvent.click(getByText('Löschen'));
    await tick();
    await new Promise((r) => setTimeout(r, 30));
    expect(onClose).toHaveBeenCalled();
    expect(await db.entries.get('2026-05-28__s1')).toBeUndefined();
    expect(snackbar.current).toBeNull();
  });

  it('Löschen removes an existing entry and shows an undo snackbar', async () => {
    const slider = newField('slider');
    const text = newField('text');
    const s = makeSymptom({ name: 'Müdigkeit', fields: [slider, text] });
    await db.entries.put({
      id: '2026-05-28__s1', date: '2026-05-28', symptomId: 's1',
      values: { [slider.id]: 80, [text.id]: 'müde' },
      updatedAt: 1
    });
    const onClose = vi.fn();
    const { getByText } = render(EntryEditor, {
      props: { open: true, date: '2026-05-28', symptom: s, onClose }
    });
    await tick();
    await new Promise((r) => setTimeout(r, 30));
    await fireEvent.click(getByText('Löschen'));
    await tick();
    await new Promise((r) => setTimeout(r, 30));
    expect(await db.entries.get('2026-05-28__s1')).toBeUndefined();
    expect(snackbar.current?.message).toBe('Müdigkeit gelöscht');
    expect(snackbar.current?.actionLabel).toBe('Rückgängig');
    expect(onClose).toHaveBeenCalled();

    await snackbar.invokeAction();
    await new Promise((r) => setTimeout(r, 30));
    const restored = await db.entries.get('2026-05-28__s1');
    expect(restored?.values[slider.id]).toBe(80);
    expect(restored?.values[text.id]).toBe('müde');
  });

  it('renders only non-deleted fields', () => {
    const text = newField('text');
    const deleted: MetaField = { ...newField('slider'), deleted: true };
    const s = makeSymptom({ fields: [text, deleted] });
    const { queryByPlaceholderText, getByPlaceholderText } = render(EntryEditor, {
      props: { open: true, date: '2026-05-28', symptom: s, onClose: () => {} }
    });
    expect(getByPlaceholderText('z.B. Auslöser, Umstände…')).toBeTruthy();
    // Deleted slider's track is not in the DOM.
    expect(queryByPlaceholderText(/leicht/)).toBeNull();
  });

  it('restores initial values when initial prop is provided', async () => {
    const slider = newField('slider');
    const text = newField('text');
    // Pre-seed an entry that should be IGNORED when initial is provided.
    await db.entries.put({
      id: '2026-05-28__s1', date: '2026-05-28', symptomId: 's1',
      values: { [slider.id]: 99, [text.id]: 'persisted' },
      updatedAt: 1
    });

    const s = makeSymptom({ fields: [slider, text] });

    const { container } = render(EntryEditor, {
      props: {
        open: true,
        date: '2026-05-28',
        symptom: s,
        initial: { values: { [slider.id]: 42, [text.id]: 'restored' } },
        onClose: () => {}
      }
    });
    await tick();
    await new Promise((r) => setTimeout(r, 30));

    // The comment textarea should show 'restored' (the initial value), NOT 'persisted'.
    const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
    expect(textarea.value).toBe('restored');

    // Slider thumb is on the continuous track (value=42 is not null).
    const thumb = container.querySelector('[data-thumb]') as HTMLElement;
    expect(thumb.dataset.zone).toBe('continuous');
  });
});
