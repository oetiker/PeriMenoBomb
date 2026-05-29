import { describe, it, expect } from 'vitest';
import { filterEntries, groupEntriesByDay } from './filter';
import type { Entry, Symptom } from '$lib/db';

const sym = (id: string, tagIds: string[] = []): Symptom => ({
  id, name: id, color: '#000', icon: '⚪', tagIds, parentId: null, sortIndex: 0,
  depth: 0, isFolder: false, archived: false, createdAt: 0, updatedAt: 0,
  inputs: { slider: { enabled: false, required: false, lowLabel: '', highLabel: '' },
            number: { enabled: false, required: false, unit: '', integer: true },
            comment: { enabled: false, required: false } },
  daily: false
});
const ent = (date: string, symptomId: string): Entry => ({
  id: `${date}__${symptomId}`, date, symptomId, sliderValue: null, numberValue: null, comment: '', updatedAt: 0
});

const symptoms = new Map<string, Symptom>([
  ['a', sym('a', ['t1'])],
  ['b', sym('b', ['t2'])],
  ['c', sym('c', [])]
]);

describe('filterEntries', () => {
  const entries = [ent('2026-05-10', 'a'), ent('2026-05-11', 'b'), ent('2026-05-12', 'c')];

  it('returns all when no filter is set', () => {
    expect(filterEntries(entries, symptoms, {}).length).toBe(3);
  });
  it('filters by symptom ids', () => {
    expect(filterEntries(entries, symptoms, { symptomIds: ['a', 'c'] }).map((e) => e.symptomId)).toEqual(['a', 'c']);
  });
  it('filters by tag ids (symptom must carry at least one)', () => {
    expect(filterEntries(entries, symptoms, { tagIds: ['t1'] }).map((e) => e.symptomId)).toEqual(['a']);
  });
  it('filters by inclusive date range', () => {
    expect(filterEntries(entries, symptoms, { from: '2026-05-11', to: '2026-05-12' }).map((e) => e.date))
      .toEqual(['2026-05-11', '2026-05-12']);
  });
  it('combines symptom and tag filters as union of matching symptoms', () => {
    // symptomIds ['c'] OR tagIds ['t2'] → c and b
    expect(filterEntries(entries, symptoms, { symptomIds: ['c'], tagIds: ['t2'] }).map((e) => e.symptomId).sort())
      .toEqual(['b', 'c']);
  });
});

describe('groupEntriesByDay', () => {
  it('groups entries by date, newest day first', () => {
    const entries = [ent('2026-05-10', 'a'), ent('2026-05-12', 'b'), ent('2026-05-10', 'c')];
    const groups = groupEntriesByDay(entries);
    expect(groups.map((g) => g.date)).toEqual(['2026-05-12', '2026-05-10']);
    expect(groups[1].entries.map((e) => e.symptomId)).toEqual(['a', 'c']);
  });
});
