import { describe, it, expect } from 'vitest';
import { classifyCell, valueNumberDomain, buildHeatmap, cellColor, OFFSET_MIN, OFFSET_MAX } from './heatmap';
import type { Entry, Symptom } from '$lib/db';

const base = (over: Partial<Symptom['inputs']> = {}): Symptom['inputs'] => ({
  slider: { enabled: false, required: false, lowLabel: '', highLabel: '' },
  number: { enabled: false, required: false, unit: '', integer: true },
  comment: { enabled: false, required: false },
  ...over
});
const sym = (inputs: Symptom['inputs']): Symptom => ({
  id: 'v', name: 'v', color: '#be123c', icon: '⚪', tagIds: [], parentId: null, sortIndex: 0,
  depth: 0, isFolder: false, archived: false, createdAt: 0, updatedAt: 0, inputs, daily: false
});
const ent = (date: string, over: Partial<Entry> = {}): Entry => ({
  id: `${date}__v`, date, symptomId: 'v', sliderValue: null, numberValue: null, comment: '', updatedAt: 0, ...over
});

describe('classifyCell', () => {
  it('no entry → none', () => {
    expect(classifyCell(sym(base()), undefined, null)).toEqual({ kind: 'none', intensity: 0 });
  });
  it('slider null → unspez', () => {
    const s = sym(base({ slider: { enabled: true, required: false, lowLabel: '', highLabel: '' } }));
    expect(classifyCell(s, ent('2026-05-01', { sliderValue: null }), null)).toEqual({ kind: 'unspez', intensity: 0 });
  });
  it('slider value → value with intensity on 1..100 scale', () => {
    const s = sym(base({ slider: { enabled: true, required: false, lowLabel: '', highLabel: '' } }));
    const c = classifyCell(s, ent('2026-05-01', { sliderValue: 100 }), null);
    expect(c.kind).toBe('value');
    expect(c.intensity).toBeCloseTo(1, 5);
    expect(classifyCell(s, ent('2026-05-01', { sliderValue: 1 }), null).intensity).toBeCloseTo(0, 5);
  });
  it('number value → value normalized over domain', () => {
    const s = sym(base({ number: { enabled: true, required: false, unit: 'x', integer: true } }));
    const c = classifyCell(s, ent('2026-05-01', { numberValue: 5 }), { min: 0, max: 10 });
    expect(c.kind).toBe('value');
    expect(c.intensity).toBeCloseTo(0.5, 5);
  });
  it('number with flat domain → full intensity', () => {
    const s = sym(base({ number: { enabled: true, required: false, unit: 'x', integer: true } }));
    expect(classifyCell(s, ent('2026-05-01', { numberValue: 3 }), { min: 3, max: 3 }).intensity).toBe(1);
  });
  it('no value input but entry exists → recorded', () => {
    const s = sym(base({ comment: { enabled: true, required: false } }));
    expect(classifyCell(s, ent('2026-05-01', { comment: 'x' }), null)).toEqual({ kind: 'recorded', intensity: 1 });
  });
});

describe('valueNumberDomain', () => {
  it('returns min/max of numberValue for number symptoms', () => {
    const s = sym(base({ number: { enabled: true, required: false, unit: 'x', integer: true } }));
    expect(valueNumberDomain([ent('a', { numberValue: 2 }), ent('b', { numberValue: 9 })], s)).toEqual({ min: 2, max: 9 });
  });
  it('returns null for non-number symptoms or no data', () => {
    expect(valueNumberDomain([], sym(base()))).toBeNull();
  });
});

describe('buildHeatmap', () => {
  it('builds one column per anchor date with a cell per offset', () => {
    const s = sym(base({ slider: { enabled: true, required: false, lowLabel: '', highLabel: '' } }));
    const byDate = new Map<string, Entry>([['2026-05-18', ent('2026-05-18', { sliderValue: 50 })]]);
    const m = buildHeatmap(['2026-05-18'], byDate, s, null, OFFSET_MIN, OFFSET_MAX);
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
