import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { tick } from 'svelte';
import EntryEditor from './EntryEditor.svelte';
import { db, defaultSymptomInputs, resetDatabase, type Symptom } from '$lib/db';

function makeSymptom(p: Partial<Symptom> = {}): Symptom {
  return {
    id: 's1', name: 'X', color: '#000', icon: 'circle',
    tagIds: [], parentId: null, sortIndex: 0, depth: 0,
    isFolder: false, archived: false, createdAt: 0, updatedAt: 0,
    inputs: defaultSymptomInputs(), daily: false, ...p
  };
}

describe('EntryEditor', () => {
  beforeEach(() => resetDatabase());

  it('Fertig is enabled when nothing is required and writes a marker entry', async () => {
    const s = makeSymptom();
    const onClose = vi.fn();
    const { getByText } = render(EntryEditor, {
      props: { open: true, date: '2026-05-28', symptom: s, onClose }
    });
    const fertig = getByText('Fertig') as HTMLButtonElement;
    expect(fertig.disabled).toBe(false);
    await fireEvent.click(fertig);
    await tick();
    await new Promise((r) => setTimeout(r, 30));
    const entry = await db.entries.get('2026-05-28__s1');
    expect(entry).toBeTruthy();
    expect(entry?.sliderValue).toBeNull();
    expect(entry?.numberValue).toBeNull();
    expect(entry?.comment).toBe('');
  });

  it('Fertig is disabled while slider is required and value is null', async () => {
    const inputs = defaultSymptomInputs();
    inputs.slider.enabled = true; inputs.slider.required = true;
    const s = makeSymptom({ inputs });
    const { getByText } = render(EntryEditor, {
      props: { open: true, date: '2026-05-28', symptom: s, onClose: () => {} }
    });
    const fertig = getByText('Fertig') as HTMLButtonElement;
    expect(fertig.disabled).toBe(true);
  });

  it('Verwerfen closes without writing an entry', async () => {
    const s = makeSymptom();
    const onClose = vi.fn();
    const { getByText } = render(EntryEditor, {
      props: { open: true, date: '2026-05-28', symptom: s, onClose }
    });
    await fireEvent.click(getByText('Verwerfen'));
    await tick();
    // onVerwerfen is async (awaits clearDialog); give it a tick to resolve.
    await new Promise((r) => setTimeout(r, 30));
    expect(onClose).toHaveBeenCalled();
    expect(await db.entries.get('2026-05-28__s1')).toBeUndefined();
  });

  it('renders only enabled inputs', () => {
    const inputs = defaultSymptomInputs();
    inputs.comment.enabled = true;
    const s = makeSymptom({ inputs });
    const { queryByPlaceholderText, getByPlaceholderText } = render(EntryEditor, {
      props: { open: true, date: '2026-05-28', symptom: s, onClose: () => {} }
    });
    expect(getByPlaceholderText('z.B. Auslöser, Umstände…')).toBeTruthy();
    // Slider track not in DOM (since slider is disabled)
    expect(queryByPlaceholderText(/leicht/)).toBeNull();
  });

  it('restores initial values when initial prop is provided', async () => {
    // Pre-seed an entry that should be IGNORED when initial is provided.
    await db.entries.put({
      id: '2026-05-28__s1', date: '2026-05-28', symptomId: 's1',
      sliderValue: 99, numberValue: null, comment: 'persisted',
      updatedAt: 1
    });

    const inputs = defaultSymptomInputs();
    inputs.slider.enabled = true;
    inputs.comment.enabled = true;
    const s = makeSymptom({ inputs });

    const { container } = render(EntryEditor, {
      props: {
        open: true,
        date: '2026-05-28',
        symptom: s,
        initial: { sliderValue: 42, numberValue: null, comment: 'restored' },
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
