import { describe, it, expect, beforeEach } from 'vitest';
import { resetDatabase } from './index';
import type { Symptom } from './index';
import { upsertEntry, getEntry, deleteEntry, listEntriesForDate, listEntriesForRange, hasEntry, listOccurrenceDates } from './entries';
import { validateEntry } from './entries';
import { newField } from './fields';

describe('entries', () => {
  beforeEach(() => resetDatabase());

  it('upsert creates a new entry with deterministic id', async () => {
    const e = await upsertEntry({ date: '2026-05-27', symptomId: 'sym1' });
    expect(e.id).toBe('2026-05-27__sym1');
    expect(e.values).toEqual({});
  });

  it('upsertEntry merges values by field id', async () => {
    const f1 = newField('number'); const f2 = newField('text');
    await upsertEntry({ date: '2026-06-01', symptomId: 'sx', values: { [f1.id]: 2 } });
    await upsertEntry({ date: '2026-06-01', symptomId: 'sx', values: { [f2.id]: 'hi' } });
    const e = await getEntry('2026-06-01', 'sx');
    expect(e!.values).toEqual({ [f1.id]: 2, [f2.id]: 'hi' });
  });

  it('upsert preserves existing values when patch is partial', async () => {
    const f1 = newField('number');
    const f2 = newField('text');
    await upsertEntry({ date: '2026-05-27', symptomId: 'sym1', values: { [f1.id]: 50 } });
    const e = await upsertEntry({ date: '2026-05-27', symptomId: 'sym1', values: { [f2.id]: 'Notiz' } });
    expect(e.values[f1.id]).toBe(50);
    expect(e.values[f2.id]).toBe('Notiz');
  });

  it('hasEntry reports presence', async () => {
    expect(await hasEntry('2026-05-27', 'sym1')).toBe(false);
    await upsertEntry({ date: '2026-05-27', symptomId: 'sym1' });
    expect(await hasEntry('2026-05-27', 'sym1')).toBe(true);
  });

  it('delete removes the entry', async () => {
    await upsertEntry({ date: '2026-05-27', symptomId: 'sym1' });
    await deleteEntry('2026-05-27', 'sym1');
    expect(await getEntry('2026-05-27', 'sym1')).toBeUndefined();
  });

  it('listEntriesForDate returns all entries of a day', async () => {
    await upsertEntry({ date: '2026-05-27', symptomId: 'a' });
    await upsertEntry({ date: '2026-05-27', symptomId: 'b' });
    await upsertEntry({ date: '2026-05-26', symptomId: 'c' });
    const today = await listEntriesForDate('2026-05-27');
    expect(today.map((e) => e.symptomId).sort()).toEqual(['a', 'b']);
  });

  it('listEntriesForRange returns entries between dates inclusive', async () => {
    await upsertEntry({ date: '2026-05-25', symptomId: 'a' });
    await upsertEntry({ date: '2026-05-26', symptomId: 'b' });
    await upsertEntry({ date: '2026-05-28', symptomId: 'c' });
    const r = await listEntriesForRange('2026-05-26', '2026-05-27');
    expect(r.map((e) => e.symptomId)).toEqual(['b']);
  });

  it('rejects invalid date format', async () => {
    await expect(upsertEntry({ date: '27.05.2026', symptomId: 'x' })).rejects.toThrow();
  });

  it('listOccurrenceDates returns ascending dates for a symptom', async () => {
    await upsertEntry({ date: '2026-05-20', symptomId: 'a' });
    await upsertEntry({ date: '2026-05-10', symptomId: 'a' });
    await upsertEntry({ date: '2026-05-15', symptomId: 'b' });
    expect(await listOccurrenceDates('a')).toEqual(['2026-05-10', '2026-05-20']);
    expect(await listOccurrenceDates('b')).toEqual(['2026-05-15']);
  });

  it('listOccurrenceDates returns empty array when the symptom has no entries', async () => {
    expect(await listOccurrenceDates('nope')).toEqual([]);
  });

  it('listOccurrenceDates counts an input-less event entry as an occurrence', async () => {
    await upsertEntry({ date: '2026-05-18', symptomId: 'mens' }); // no values
    expect(await listOccurrenceDates('mens')).toEqual(['2026-05-18']);
  });
});

describe('validateEntry', () => {
  it('validateEntry flags required-but-missing fields by id', () => {
    const req = { ...newField('number'), required: true };
    const opt = newField('text');
    const symptom = {
      id: 's', name: 'S', color: '#000', icon: '⚪', tagIds: [], parentId: null,
      sortIndex: 0, depth: 0, isFolder: false, archived: false, createdAt: 1, updatedAt: 1,
      fields: [req, opt], daily: false, duotone: true, bg: true
    } as Symptom;
    expect(validateEntry(symptom, {}).missing).toEqual([req.id]);
    expect(validateEntry(symptom, { [req.id]: 5 }).ok).toBe(true);
  });

  it('validateEntry ignores deleted required fields', () => {
    const del = { ...newField('number'), required: true, deleted: true };
    const symptom = { /* same shape */ fields: [del] } as unknown as Symptom;
    expect(validateEntry(symptom, {}).ok).toBe(true);
  });

  it('ok when no fields are required', () => {
    const f = newField('number'); // required: false by default
    const symptom = {
      id: 's', name: 'S', color: '#000', icon: '⚪', tagIds: [], parentId: null,
      sortIndex: 0, depth: 0, isFolder: false, archived: false, createdAt: 1, updatedAt: 1,
      fields: [f], daily: false
    } as Symptom;
    expect(validateEntry(symptom, {})).toEqual({ ok: true, missing: [] });
  });

  it('slider required and null → missing', () => {
    const req = { ...newField('slider'), required: true };
    const symptom = {
      id: 's', name: 'S', color: '#000', icon: '⚪', tagIds: [], parentId: null,
      sortIndex: 0, depth: 0, isFolder: false, archived: false, createdAt: 1, updatedAt: 1,
      fields: [req], daily: false
    } as Symptom;
    expect(validateEntry(symptom, { [req.id]: null }).missing).toContain(req.id);
    expect(validateEntry(symptom, { [req.id]: 50 }).ok).toBe(true);
  });

  it('select required and empty string → missing', () => {
    const req = { ...newField('select'), required: true };
    const symptom = {
      id: 's', name: 'S', color: '#000', icon: '⚪', tagIds: [], parentId: null,
      sortIndex: 0, depth: 0, isFolder: false, archived: false, createdAt: 1, updatedAt: 1,
      fields: [req], daily: false
    } as Symptom;
    expect(validateEntry(symptom, { [req.id]: '' }).missing).toContain(req.id);
    expect(validateEntry(symptom, { [req.id]: 'opt1' }).ok).toBe(true);
  });

  it('text required and whitespace → missing', () => {
    const req = { ...newField('text'), required: true };
    const symptom = {
      id: 's', name: 'S', color: '#000', icon: '⚪', tagIds: [], parentId: null,
      sortIndex: 0, depth: 0, isFolder: false, archived: false, createdAt: 1, updatedAt: 1,
      fields: [req], daily: false
    } as Symptom;
    expect(validateEntry(symptom, { [req.id]: '   ' }).missing).toContain(req.id);
    expect(validateEntry(symptom, { [req.id]: 'note' }).ok).toBe(true);
  });

  it('aggregates multiple missing fields in order', () => {
    const r1 = { ...newField('slider'), required: true };
    const r2 = { ...newField('number'), required: true };
    const r3 = { ...newField('text'), required: true };
    const symptom = {
      id: 's', name: 'S', color: '#000', icon: '⚪', tagIds: [], parentId: null,
      sortIndex: 0, depth: 0, isFolder: false, archived: false, createdAt: 1, updatedAt: 1,
      fields: [r1, r2, r3], daily: false
    } as Symptom;
    expect(validateEntry(symptom, {}).missing).toEqual([r1.id, r2.id, r3.id]);
  });
});
