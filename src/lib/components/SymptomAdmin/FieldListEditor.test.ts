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
    // The add-menu is a disclosure: open it first, then pick a type.
    await fireEvent.click(getByRole('button', { name: 'Feld hinzufügen' }));
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

describe('check fields', () => {
  it('adds a check field from the add-menu', async () => {
    let fields: MetaField[] = [];
    const onFieldsChange = vi.fn((n: MetaField[]) => (fields = n));
    const { getByRole } = render(FieldListEditor, {
      props: { fields, daily: false, onFieldsChange, onDailyChange: vi.fn() }
    });
    await fireEvent.click(getByRole('button', { name: 'Feld hinzufügen' }));
    await fireEvent.click(getByRole('button', { name: 'Häkchen hinzufügen' }));
    expect(fields[0].type).toBe('check');
    expect(fields[0].label).toBe('Zutreffend');
  });

  it('hides the Pflicht toggle for a check field', () => {
    const { queryByText } = render(FieldListEditor, {
      props: { fields: [newField('check')], daily: false, onFieldsChange: vi.fn(), onDailyChange: vi.fn() }
    });
    expect(queryByText('Pflicht')).toBeNull();
  });

  it('still shows the Pflicht toggle for other field types', () => {
    const { queryByText } = render(FieldListEditor, {
      props: { fields: [newField('text')], daily: false, onFieldsChange: vi.fn(), onDailyChange: vi.fn() }
    });
    expect(queryByText('Pflicht')).toBeTruthy();
  });

  it('lets the author rename a check field', async () => {
    const f = newField('check');
    let fields = [f];
    const onFieldsChange = vi.fn((n: MetaField[]) => (fields = n));
    const { getByLabelText } = render(FieldListEditor, {
      props: { fields, daily: false, onFieldsChange, onDailyChange: vi.fn() }
    });
    await fireEvent.input(getByLabelText('Bezeichnung'), { target: { value: 'Nachts aufgewacht' } });
    expect(fields[0].id).toBe(f.id);
    expect(fields[0].label).toBe('Nachts aufgewacht');
  });
});
