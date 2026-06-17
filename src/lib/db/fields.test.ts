import { describe, it, expect } from 'vitest';
import { newField, isValueField, selectOptionLabel, entryFieldDisplays } from './fields';
import type { Symptom, SelectField } from './index';

function sym(fields: Symptom['fields']): Symptom {
  return {
    id: 's1', name: 'S', color: '#000', icon: '⚪', tagIds: [], parentId: null,
    sortIndex: 0, depth: 0, isFolder: false, archived: false, createdAt: 1, updatedAt: 1,
    fields, daily: false, duotone: true, bg: true
  };
}

describe('newField', () => {
  it('mints a slider field with a German default label and config', () => {
    const f = newField('slider');
    expect(f.type).toBe('slider');
    expect(f.label).toBe('Intensität');
    expect(f.required).toBe(false);
    expect(f.id).toMatch(/[0-9a-f-]{8,}/);
    if (f.type === 'slider') { expect(f.lowLabel).toBe(''); expect(f.highLabel).toBe(''); }
  });
  it('mints number/text/select defaults', () => {
    expect(newField('number').label).toBe('Wert');
    expect(newField('text').label).toBe('Notiz');
    const sel = newField('select');
    expect(sel.label).toBe('Auswahl');
    if (sel.type === 'select') expect(sel.options).toEqual([]);
  });
});

describe('isValueField', () => {
  it('is true for slider/number/select, false for text', () => {
    expect(isValueField(newField('slider'))).toBe(true);
    expect(isValueField(newField('number'))).toBe(true);
    expect(isValueField(newField('select'))).toBe(true);
    expect(isValueField(newField('text'))).toBe(false);
  });
});

describe('selectOptionLabel', () => {
  const field: SelectField = {
    id: 'f', type: 'select', label: 'A', required: false,
    options: [{ key: 'k1', label: 'leicht', value: null }, { key: 'k2', label: 'stark', value: null, deleted: true }]
  };
  it('resolves active, deleted, unknown and empty keys', () => {
    expect(selectOptionLabel(field, 'k1')).toBe('leicht');
    expect(selectOptionLabel(field, 'k2')).toBe('stark (gelöscht)');
    expect(selectOptionLabel(field, 'zzz')).toBe('(unbekannte Auswahl)');
    expect(selectOptionLabel(field, null)).toBe('');
  });
});

describe('entryFieldDisplays', () => {
  it('returns ordered non-empty values, slider null → unspez, skips unlogged & deleted', () => {
    const sl = newField('slider'); const nu = newField('number');
    const tx = newField('text'); const del = { ...newField('text'), deleted: true };
    if (nu.type === 'number') nu.unit = 'Tassen';
    const s = sym([sl, nu, tx, del]);
    const out = entryFieldDisplays(s, { values: { [sl.id]: null, [nu.id]: 3, [tx.id]: 'hallo', [del.id]: 'x' } });
    expect(out.map((d) => d.text)).toEqual(['unspez', '3 Tassen', 'hallo']);
  });
  it('omits a field with no stored value', () => {
    const nu = newField('number');
    const s = sym([nu]);
    expect(entryFieldDisplays(s, { values: {} })).toEqual([]);
  });
});
