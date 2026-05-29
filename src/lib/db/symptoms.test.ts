import { describe, it, expect, beforeEach } from 'vitest';
import { resetDatabase, db, defaultSymptomInputs } from './index';
import { createSymptom, updateSymptom, getSymptom, archiveSymptom, listAllSymptoms, listChildren, listArchivedSymptoms, unarchiveSymptom } from './symptoms';
import { moveSymptom, reorderSiblings, subtreeDepth, listTree, hasEnabledInput, listDailySymptomsForDate } from './symptoms';
import { upsertEntry } from './entries';

describe('symptoms CRUD', () => {
  beforeEach(() => resetDatabase());

  it('creates a symptom with sensible defaults', async () => {
    const s = await createSymptom({ name: 'Hitzewallungen' });
    expect(s.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(s.name).toBe('Hitzewallungen');
    expect(s.icon).toBe('⚪');
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
    expect(f.icon).toBe('📁');
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

  it('createSymptom sets default inputs and daily=false', async () => {
    const s = await createSymptom({ name: 'Test' });
    expect(s.inputs).toEqual(defaultSymptomInputs());
    expect(s.daily).toBe(false);
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

describe('hasEnabledInput', () => {
  it('false when all inputs disabled', () => {
    expect(hasEnabledInput(defaultSymptomInputs())).toBe(false);
  });
  it('true when any input enabled', () => {
    const inputs = defaultSymptomInputs();
    inputs.comment.enabled = true;
    expect(hasEnabledInput(inputs)).toBe(true);
  });
});

describe('listDailySymptomsForDate', () => {
  beforeEach(() => resetDatabase());

  it('returns daily + enabled-input symptoms without entry for the date, in tree order', async () => {
    const a = await createSymptom({ name: 'A' });          // not daily
    const b = await createSymptom({ name: 'B' });          // daily but no inputs → excluded
    const c = await createSymptom({ name: 'C' });          // daily + slider → included
    const d = await createSymptom({ name: 'D' });          // daily + comment → included but archived
    const e = await createSymptom({ name: 'E' });          // daily + comment → included but has entry
    const folder = await createSymptom({ name: 'F', isFolder: true });
    const childIn = await createSymptom({ name: 'G', parentId: folder.id }); // child, daily, included
    // Configure
    await updateSymptom(b.id, { daily: true });
    const cIn = c.inputs; cIn.slider.enabled = true;
    await updateSymptom(c.id, { daily: true, inputs: cIn });
    const dIn = d.inputs; dIn.comment.enabled = true;
    await updateSymptom(d.id, { daily: true, inputs: dIn, archived: true });
    const eIn = e.inputs; eIn.comment.enabled = true;
    await updateSymptom(e.id, { daily: true, inputs: eIn });
    const gIn = childIn.inputs; gIn.comment.enabled = true;
    await updateSymptom(childIn.id, { daily: true, inputs: gIn });
    // e already has an entry → excluded
    await upsertEntry({ date: '2026-05-28', symptomId: e.id, comment: 'done' });

    const result = await listDailySymptomsForDate('2026-05-28');
    // Expected (in tree order): C (root), G (child of F).
    expect(result.map((s) => s.name)).toEqual(['C', 'G']);
  });

  it('returns empty list when no daily symptoms', async () => {
    await createSymptom({ name: 'X' });
    expect(await listDailySymptomsForDate('2026-05-28')).toEqual([]);
  });
});

describe('archive', () => {
  beforeEach(() => resetDatabase());

  it('listArchivedSymptoms returns only archived rows, newest first', async () => {
    const a = await createSymptom({ name: 'A' });
    const b = await createSymptom({ name: 'B' });
    const c = await createSymptom({ name: 'C' });
    await archiveSymptom(a.id);
    // bump b's updatedAt by archiving last so it should sort first
    await new Promise((r) => setTimeout(r, 5));
    await archiveSymptom(b.id);
    const archived = await listArchivedSymptoms();
    expect(archived.map((s) => s.name)).toEqual(['B', 'A']);
    // c is not archived → not in the list
    expect(archived.find((s) => s.id === c.id)).toBeUndefined();
  });

  it('unarchiveSymptom flips archived back and re-appears in listTree', async () => {
    const a = await createSymptom({ name: 'A' });
    await archiveSymptom(a.id);
    expect((await listTree()).find((n) => n.id === a.id)).toBeUndefined();
    await unarchiveSymptom(a.id);
    const tree = await listTree();
    expect(tree.find((n) => n.id === a.id)).toBeTruthy();
    const fresh = await db.symptoms.get(a.id);
    expect(fresh?.archived).toBe(false);
  });

  it('unarchiveSymptom on an unarchived row is a no-op', async () => {
    const a = await createSymptom({ name: 'A' });
    await unarchiveSymptom(a.id);
    expect((await db.symptoms.get(a.id))?.archived).toBe(false);
  });
});
