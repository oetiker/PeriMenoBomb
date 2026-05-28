import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { tick } from 'svelte';
import SymptomEditModal from './SymptomEditModal.svelte';
import { resetDatabase, db } from '$lib/db';
import { createSymptom } from '$lib/db/symptoms';

describe('SymptomEditModal', () => {
  beforeEach(() => resetDatabase());

  it('persists name + color edits on save', async () => {
    const s = await createSymptom({ name: 'A', color: '#6b7280' });
    const { getByLabelText, getByText } = render(SymptomEditModal, {
      props: { open: true, symptom: s, onClose: () => {} }
    });
    const nameInput = getByLabelText('Name') as HTMLInputElement;
    await fireEvent.input(nameInput, { target: { value: 'B' } });
    await fireEvent.click(getByText('Speichern'));
    await tick();
    await new Promise((r) => setTimeout(r, 30));
    const after = await db.symptoms.get(s.id);
    expect(after?.name).toBe('B');
  });

  it('saves toggled comment.enabled and daily=true', async () => {
    const sym = await createSymptom({ name: 'S' });
    const onClose = vi.fn();
    const { getAllByLabelText, getByLabelText, getByText } = render(SymptomEditModal, {
      props: { open: true, symptom: sym, isNew: false, onClose }
    });

    // Toggle comment Aktiv (3rd of three Aktiv checkboxes).
    const aktiv = getAllByLabelText('Aktiv') as HTMLInputElement[];
    await fireEvent.click(aktiv[2]);

    // Daily becomes visible; tick it.
    const daily = getByLabelText('Täglich erfassen');
    await fireEvent.click(daily);

    await fireEvent.click(getByText('Speichern'));
    await tick();
    await new Promise((r) => setTimeout(r, 30));

    const stored = await db.symptoms.get(sym.id);
    expect(stored?.inputs.comment.enabled).toBe(true);
    expect(stored?.daily).toBe(true);
  });
});
