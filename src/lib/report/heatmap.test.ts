import { describe, it, expect } from 'vitest';
import { classifyCell, valueNumberDomain, selectValueDomain, valueDomain, selectEntryValue, buildHeatmap, cellColor, OFFSET_MIN, OFFSET_MAX } from './heatmap';
import { newField } from '$lib/db/fields';
import type { Entry, NumberField } from '$lib/db';

const E = (values: Record<string, number | string | null>): Entry =>
  ({ id: 'x', date: 'd', symptomId: 's', values, updatedAt: 0 });

describe('classifyCell', () => {
  it('no entry → none', () => {
    const f = newField('slider');
    expect(classifyCell(f, undefined, null)).toEqual({ kind: 'none', intensity: 0 });
  });

  it('slider field → normalized 1..100', () => {
    const f = newField('slider');
    expect(classifyCell(f, E({ [f.id]: 100 }), null)).toEqual({ kind: 'value', intensity: 1 });
    expect(classifyCell(f, E({ [f.id]: 1 }), null).intensity).toBeCloseTo(0, 5);
    expect(classifyCell(f, E({ [f.id]: null }), null)).toEqual({ kind: 'unspez', intensity: 0 });
  });

  it('number field → normalized over domain', () => {
    const f = newField('number') as NumberField;
    const dom = { min: 0, max: 10 };
    const c = classifyCell(f, E({ [f.id]: 5 }), dom);
    expect(c.kind).toBe('value');
    expect(c.intensity).toBeCloseTo(0.5, 5);
  });

  it('number field with flat domain → full intensity', () => {
    const f = newField('number') as NumberField;
    expect(classifyCell(f, E({ [f.id]: 3 }), { min: 3, max: 3 }).intensity).toBe(1);
  });

  it('number field null value → none', () => {
    const f = newField('number') as NumberField;
    expect(classifyCell(f, E({ [f.id]: null }), null)).toEqual({ kind: 'none', intensity: 0 });
  });

  it('select field uses option value, else recorded', () => {
    const f = newField('select');
    if (f.type === 'select') f.options = [{ key: 'k', label: 'a', value: 80 }, { key: 'n', label: 'b', value: null }];
    const dom = valueDomain([E({ [f.id]: 'k' })], f);
    expect(classifyCell(f, E({ [f.id]: 'k' }), dom).kind).toBe('value');
    expect(classifyCell(f, E({ [f.id]: 'n' }), null)).toEqual({ kind: 'recorded', intensity: 1 });
  });

  it('select field: no value → unspez', () => {
    const f = newField('select');
    if (f.type === 'select') f.options = [{ key: 'k', label: 'a', value: 80 }];
    expect(classifyCell(f, E({ [f.id]: null }), null)).toEqual({ kind: 'unspez', intensity: 0 });
  });

  it('text field → recorded', () => {
    const f = newField('text');
    expect(classifyCell(f, E({ [f.id]: 'hello' }), null)).toEqual({ kind: 'recorded', intensity: 1 });
  });
});

describe('valueNumberDomain', () => {
  it('returns min/max of number field values across entries', () => {
    const f = newField('number') as NumberField;
    const entries = [E({ [f.id]: 2 }), E({ [f.id]: 9 })];
    expect(valueNumberDomain(entries, f)).toEqual({ min: 2, max: 9 });
  });

  it('returns null for empty entries', () => {
    const f = newField('number') as NumberField;
    expect(valueNumberDomain([], f)).toBeNull();
  });

  it('ignores null values', () => {
    const f = newField('number') as NumberField;
    expect(valueNumberDomain([E({ [f.id]: null })], f)).toBeNull();
  });
});

describe('select input', () => {
  const makeSelectField = () => {
    const f = newField('select');
    if (f.type === 'select') {
      f.options = [
        { key: 'k1', label: 'leicht', value: 1 },
        { key: 'k2', label: 'stark', value: 5 },
        { key: 'k3', label: 'nur Notiz', value: null },
        { key: 'kd', label: 'alt', value: 3, deleted: true }
      ];
    }
    return f;
  };

  it('selectEntryValue resolves the chosen option value, incl. deleted options', () => {
    const f = makeSelectField();
    if (f.type !== 'select') throw new Error('expected select');
    expect(selectEntryValue(f, E({ [f.id]: 'k2' }))).toBe(5);
    expect(selectEntryValue(f, E({ [f.id]: 'kd' }))).toBe(3); // deleted still resolves
    expect(selectEntryValue(f, E({ [f.id]: 'k3' }))).toBeNull(); // no value
    expect(selectEntryValue(f, E({ [f.id]: null }))).toBeNull();
    expect(selectEntryValue(f, E({ [f.id]: 'gone' }))).toBeNull();
  });

  it('selectValueDomain spans option values across entries', () => {
    const f = makeSelectField();
    if (f.type !== 'select') throw new Error('expected select');
    expect(selectValueDomain([E({ [f.id]: 'k1' }), E({ [f.id]: 'k2' })], f)).toEqual({ min: 1, max: 5 });
    expect(selectValueDomain([E({ [f.id]: 'k3' })], f)).toBeNull(); // no numeric values
  });

  it('valueDomain dispatches to the select domain', () => {
    const f = makeSelectField();
    expect(valueDomain([E({ [f.id]: 'k1' }), E({ [f.id]: 'k2' })], f)).toEqual({ min: 1, max: 5 });
  });

  it('classifyCell: no choice → unspez; value option → normalized; valueless option → recorded', () => {
    const f = makeSelectField();
    if (f.type !== 'select') throw new Error('expected select');
    const domain = { min: 1, max: 5 };
    expect(classifyCell(f, E({ [f.id]: null }), domain)).toEqual({ kind: 'unspez', intensity: 0 });
    const c = classifyCell(f, E({ [f.id]: 'k2' }), domain);
    expect(c.kind).toBe('value');
    expect(c.intensity).toBeCloseTo(1, 5);
    expect(classifyCell(f, E({ [f.id]: 'k1' }), domain).intensity).toBeCloseTo(0, 5);
    expect(classifyCell(f, E({ [f.id]: 'k3' }), domain)).toEqual({ kind: 'recorded', intensity: 1 });
  });
});

describe('valueDomain', () => {
  it('number field → delegates to valueNumberDomain', () => {
    const f = newField('number') as NumberField;
    const entries = [E({ [f.id]: 0 }), E({ [f.id]: 10 })];
    const dom = valueDomain(entries, f);
    expect(dom).toEqual({ min: 0, max: 10 });
    // classifyCell at midpoint should normalize to 0.5
    expect(classifyCell(f, E({ [f.id]: 5 }), dom)).toEqual({ kind: 'value', intensity: 0.5 });
  });

  it('slider field → returns null (no domain needed)', () => {
    const f = newField('slider');
    expect(valueDomain([E({ [f.id]: 50 })], f)).toBeNull();
  });
});

describe('buildHeatmap', () => {
  it('builds one column per anchor date with a cell per offset', () => {
    const f = newField('slider');
    const byDate = new Map<string, Entry>([['2026-05-18', E({ [f.id]: 50 })]]);
    // override date for the entry lookup
    byDate.set('2026-05-18', { ...E({ [f.id]: 50 }), date: '2026-05-18' });
    const m = buildHeatmap(['2026-05-18'], byDate, f, null, OFFSET_MIN, OFFSET_MAX);
    expect(m.columns.length).toBe(1);
    expect(m.offsets.length).toBe(OFFSET_MAX - OFFSET_MIN + 1);
    expect(m.offsets[m.zeroIndex]).toBe(0);
    // offset 0 maps to the anchor date itself → the value cell
    expect(m.columns[0].cells[m.zeroIndex].kind).toBe('value');
    // some other offset → none
    expect(m.columns[0].cells[0].kind).toBe('none');
  });
});

describe('cellColor', () => {
  it('none → neutral token; value/recorded/unspez → symptom rgba', () => {
    expect(cellColor({ kind: 'none', intensity: 0 }, '#be123c')).toBe('var(--c-surface-3)');
    expect(cellColor({ kind: 'recorded', intensity: 1 }, '#be123c')).toBe('rgba(190, 18, 60, 0.9)');
    expect(cellColor({ kind: 'unspez', intensity: 0 }, '#be123c')).toBe('rgba(190, 18, 60, 0.18)');
    expect(cellColor({ kind: 'value', intensity: 1 }, '#be123c')).toBe('rgba(190, 18, 60, 1)');
  });
});
