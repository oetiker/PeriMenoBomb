import { describe, it, expect, beforeEach } from 'vitest';
import { resetDatabase } from '$lib/db';
import { createSymptom, reorderSiblings, listChildren } from '$lib/db/symptoms';

describe('reorder integration helper', () => {
  beforeEach(() => resetDatabase());
  it('reorders children sequentially', async () => {
    const r = await createSymptom({ name: 'R', isFolder: true });
    const a = await createSymptom({ name: 'A', parentId: r.id });
    const b = await createSymptom({ name: 'B', parentId: r.id });
    const c = await createSymptom({ name: 'C', parentId: r.id });
    await reorderSiblings(r.id, [c.id, a.id, b.id]);
    const ordered = await listChildren(r.id);
    expect(ordered.map((s) => s.name)).toEqual(['C', 'A', 'B']);
  });
});
