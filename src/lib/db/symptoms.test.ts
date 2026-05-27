import { describe, it, expect, beforeEach } from 'vitest';
import { resetDatabase, db } from './index';
import { createSymptom, updateSymptom, getSymptom, archiveSymptom, listAllSymptoms, listChildren } from './symptoms';
import { moveSymptom, reorderSiblings, subtreeDepth, listTree } from './symptoms';

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

describe('symptoms hierarchy', () => {
  beforeEach(() => resetDatabase());

  it('moveSymptom changes parent and recomputes depth', async () => {
    const r1 = await createSymptom({ name: 'R1', isFolder: true });
    const r2 = await createSymptom({ name: 'R2', isFolder: true });
    const child = await createSymptom({ name: 'C', parentId: r1.id });
    await moveSymptom(child.id, r2.id);
    const after = await getSymptom(child.id);
    expect(after?.parentId).toBe(r2.id);
    expect(after?.depth).toBe(1);
  });

  it('moveSymptom rejects move that would exceed MAX_DEPTH', async () => {
    const a = await createSymptom({ name: 'A', isFolder: true });
    const b = await createSymptom({ name: 'B', isFolder: true, parentId: a.id });
    const c = await createSymptom({ name: 'C', parentId: b.id });
    const d = await createSymptom({ name: 'D', isFolder: true });
    await expect(moveSymptom(a.id, d.id)).rejects.toThrow(/depth/i);
    void c;
  });

  it('moveSymptom rejects moving a node into its own subtree (cycle)', async () => {
    const a = await createSymptom({ name: 'A', isFolder: true });
    const b = await createSymptom({ name: 'B', isFolder: true, parentId: a.id });
    await expect(moveSymptom(a.id, b.id)).rejects.toThrow(/cycle/i);
  });

  it('reorderSiblings updates sortIndex for the given order', async () => {
    const r = await createSymptom({ name: 'R', isFolder: true });
    const x = await createSymptom({ name: 'X', parentId: r.id });
    const y = await createSymptom({ name: 'Y', parentId: r.id });
    const z = await createSymptom({ name: 'Z', parentId: r.id });
    await reorderSiblings(r.id, [z.id, x.id, y.id]);
    const kids = await listChildren(r.id);
    expect(kids.map((k) => k.name)).toEqual(['Z', 'X', 'Y']);
  });

  it('subtreeDepth returns max depth diff under a node', async () => {
    const a = await createSymptom({ name: 'A', isFolder: true });
    const b = await createSymptom({ name: 'B', isFolder: true, parentId: a.id });
    await createSymptom({ name: 'C', parentId: b.id });
    expect(await subtreeDepth(a.id)).toBe(2);
  });

  it('listTree returns roots and children sorted', async () => {
    const r = await createSymptom({ name: 'R', isFolder: true });
    await createSymptom({ name: 'Child', parentId: r.id });
    const tree = await listTree();
    expect(tree[0].name).toBe('R');
    expect(tree[0].children[0].name).toBe('Child');
  });
});
