import { describe, it, expect, beforeEach } from 'vitest';
import { resetDatabase } from './index';
import { createTag, listTags, renameTag, deleteTag, countSymptomsUsingTag } from './tags';
import { db, type Symptom, defaultSymptomInputs } from './index';

describe('tags', () => {
  beforeEach(() => resetDatabase());

  it('creates a tag with an id and timestamp', async () => {
    const t = await createTag('körperlich');
    expect(t.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(t.name).toBe('körperlich');
    expect(t.createdAt).toBeGreaterThan(0);
  });

  it('lists tags alphabetically (case-insensitive)', async () => {
    await createTag('Schlaf');
    await createTag('emotional');
    await createTag('körperlich');
    const names = (await listTags()).map((t) => t.name);
    expect(names).toEqual(['emotional', 'körperlich', 'Schlaf']);
  });

  it('rename updates name', async () => {
    const t = await createTag('alt');
    await renameTag(t.id, 'neu');
    const list = await listTags();
    expect(list[0].name).toBe('neu');
  });

  it('delete removes tag and clears references from symptoms', async () => {
    const t = await createTag('emotional');
    const sym: Symptom = {
      id: 'sym1', name: 'Reizbarkeit', color: '#ef4444', icon: 'frown',
      tagIds: [t.id], parentId: null, sortIndex: 0, depth: 0,
      isFolder: false, archived: false, createdAt: 1, updatedAt: 1,
      inputs: defaultSymptomInputs(), daily: false
    };
    await db.symptoms.add(sym);
    await deleteTag(t.id);
    expect(await listTags()).toHaveLength(0);
    const after = await db.symptoms.get('sym1');
    expect(after?.tagIds).toEqual([]);
  });

  it('countSymptomsUsingTag counts only non-archived', async () => {
    const t = await createTag('schlafrelevant');
    await db.symptoms.bulkAdd([
      { id: 'a', name: 'A', color: '#000', icon: 'moon', tagIds: [t.id], parentId: null, sortIndex: 0, depth: 0, isFolder: false, archived: false, createdAt: 1, updatedAt: 1, inputs: defaultSymptomInputs(), daily: false },
      { id: 'b', name: 'B', color: '#000', icon: 'moon', tagIds: [t.id], parentId: null, sortIndex: 1, depth: 0, isFolder: false, archived: true,  createdAt: 1, updatedAt: 1, inputs: defaultSymptomInputs(), daily: false }
    ]);
    expect(await countSymptomsUsingTag(t.id)).toBe(1);
  });
});
