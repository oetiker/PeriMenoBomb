import { describe, it, expect, beforeEach } from 'vitest';
import { resetDatabase, db } from '$lib/db';
import { liveQuery } from './liveQuery.svelte';

describe('liveQuery rune adapter', () => {
  beforeEach(() => resetDatabase());

  it('returns initial value and updates on writes', async () => {
    const q = liveQuery(() => db.tags.toArray(), [] as { id: string; name: string; createdAt: number }[]);
    await new Promise((r) => setTimeout(r, 20));
    expect(q.current).toEqual([]);
    await db.tags.add({ id: '1', name: 'a', createdAt: Date.now() });
    await new Promise((r) => setTimeout(r, 30));
    expect(q.current.map((t) => t.name)).toEqual(['a']);
    q.dispose();
  });
});
