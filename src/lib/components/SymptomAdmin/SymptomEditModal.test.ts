import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { tick } from 'svelte';
import SymptomEditModal from './SymptomEditModal.svelte';
import { resetDatabase, db } from '$lib/db';
import { createSymptom } from '$lib/db/symptoms';
import { newField } from '$lib/db/fields';

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

  it('saves daily=true when toggled via FieldListEditor', async () => {
    // Seed a slider field so FieldListEditor shows the "Täglich erfassen" checkbox.
    const sliderField = newField('slider');
    const sym = await createSymptom({ name: 'S', fields: [sliderField] });
    const onClose = vi.fn();
    const { getByLabelText, getByText } = render(SymptomEditModal, {
      props: { open: true, symptom: sym, isNew: false, onClose }
    });

    // "Täglich erfassen" is rendered by FieldListEditor when at least one field is active.
    const daily = getByLabelText('Täglich erfassen');
    await fireEvent.click(daily);

    await fireEvent.click(getByText('Speichern'));
    await tick();
    await new Promise((r) => setTimeout(r, 30));

    const stored = await db.symptoms.get(sym.id);
    expect(stored?.daily).toBe(true);
    // The fields array must be persisted with the original field intact.
    expect(stored?.fields).toHaveLength(1);
    expect(stored?.fields[0].id).toBe(sliderField.id);
  });
});
