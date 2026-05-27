import { describe, it, expect, beforeEach } from 'vitest';
import { resetDatabase } from './index';
import { upsertEntry, getEntry, deleteEntry, listEntriesForDate, listEntriesForRange, hasEntry } from './entries';

describe('entries', () => {
  beforeEach(() => resetDatabase());

  it('upsert creates a new entry with deterministic id', async () => {
    const e = await upsertEntry({ date: '2026-05-27', symptomId: 'sym1' });
    expect(e.id).toBe('2026-05-27__sym1');
    expect(e.intensity).toBeNull();
    expect(e.comment).toBe('');
  });

  it('upsert preserves existing values when patch is partial', async () => {
    await upsertEntry({ date: '2026-05-27', symptomId: 'sym1', intensity: 'mittel' });
    const e = await upsertEntry({ date: '2026-05-27', symptomId: 'sym1', comment: 'Notiz' });
    expect(e.intensity).toBe('mittel');
    expect(e.comment).toBe('Notiz');
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
});
