import { describe, it, expect, beforeEach } from 'vitest';
import { resetDatabase, db } from './index';
import { createSymptom, updateSymptom, getSymptom, archiveSymptom, listAllSymptoms, listChildren } from './symptoms';

describe('symptoms CRUD', () => {
  beforeEach(() => resetDatabase());

  it('creates a symptom with sensible defaults', async () => {
    const s = await createSymptom({ name: 'Hitzewallungen' });
    expect(s.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(s.name).toBe('Hitzewallungen');
    expect(s.icon).toBe('circle');
    expect(s.color).toBe('#6b7280');
    expect(s.tagIds).toEqual([]);
    expect(s.parentId).toBeNull();
    expect(s.depth).toBe(0);
    expect(s.isFolder).toBe(false);
    expect(s.archived).toBe(false);
  });

  it('creates a folder with default folder icon', async () => {
    const f = await createSymptom({ name: 'Körperlich', isFolder: true });
    expect(f.isFolder).toBe(true);
    expect(f.icon).toBe('folder');
  });

  it('honors overrides', async () => {
    const s = await createSymptom({ name: 'Migräne', icon: 'brain', color: '#ef4444', tagIds: ['t1'] });
    expect(s.icon).toBe('brain');
    expect(s.color).toBe('#ef4444');
    expect(s.tagIds).toEqual(['t1']);
  });

  it('assigns sortIndex sequentially within parent', async () => {
    await createSymptom({ name: 'A' });
    await createSymptom({ name: 'B' });
    const all = await listAllSymptoms();
    const indexes = all.map((s) => s.sortIndex).sort();
    expect(indexes).toEqual([0, 1]);
  });

  it('update merges fields and refreshes updatedAt', async () => {
    const s = await createSymptom({ name: 'A' });
    const before = s.updatedAt;
    await new Promise((r) => setTimeout(r, 5));
    await updateSymptom(s.id, { name: 'B', color: '#3b82f6' });
    const after = await getSymptom(s.id);
    expect(after?.name).toBe('B');
    expect(after?.color).toBe('#3b82f6');
    expect(after!.updatedAt).toBeGreaterThan(before);
  });

  it('archive sets archived=true', async () => {
    const s = await createSymptom({ name: 'A' });
    await archiveSymptom(s.id);
    const a = await getSymptom(s.id);
    expect(a?.archived).toBe(true);
  });

  it('listChildren returns sorted children of a parent', async () => {
    const root = await createSymptom({ name: 'R', isFolder: true });
    const b = await createSymptom({ name: 'B', parentId: root.id });
    const a = await createSymptom({ name: 'A', parentId: root.id });
    await db.symptoms.update(a.id, { sortIndex: 0 });
    await db.symptoms.update(b.id, { sortIndex: 1 });
    const kids = await listChildren(root.id);
    expect(kids.map((k) => k.name)).toEqual(['A', 'B']);
  });
});
