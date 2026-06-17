import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import FieldListEditor from './FieldListEditor.svelte';
import { newField } from '$lib/db/fields';
import type { MetaField } from '$lib/db';

describe('FieldListEditor', () => {
  it('adds a field of a chosen type', async () => {
    let fields: MetaField[] = [];
    const onFieldsChange = vi.fn((n: MetaField[]) => (fields = n));
    const { getByRole } = render(FieldListEditor, {
      props: { fields, daily: false, onFieldsChange, onDailyChange: vi.fn() }
    });
    await fireEvent.click(getByRole('button', { name: 'Zahl hinzufügen' }));
    expect(onFieldsChange).toHaveBeenCalled();
    expect(fields[0].type).toBe('number');
    expect(fields[0].label).toBe('Wert');
  });

  it('edits a field label without changing its id', async () => {
    const f = newField('number');
    let fields = [f];
    const onFieldsChange = vi.fn((n: MetaField[]) => (fields = n));
    const { getByLabelText } = render(FieldListEditor, {
      props: { fields, daily: false, onFieldsChange, onDailyChange: vi.fn() }
    });
    await fireEvent.input(getByLabelText('Bezeichnung'), { target: { value: 'Systolisch' } });
    expect(fields[0].id).toBe(f.id);
    expect(fields[0].label).toBe('Systolisch');
  });

  it('soft-deletes a field', async () => {
    const f = newField('text');
    let fields = [f];
    const onFieldsChange = vi.fn((n: MetaField[]) => (fields = n));
    const { getByRole } = render(FieldListEditor, {
      props: { fields, daily: false, onFieldsChange, onDailyChange: vi.fn() }
    });
    await fireEvent.click(getByRole('button', { name: 'Feld löschen' }));
    expect(fields[0].deleted).toBe(true);
  });
});
