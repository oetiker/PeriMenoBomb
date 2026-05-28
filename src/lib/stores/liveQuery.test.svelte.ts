import { describe, it, expect, beforeEach } from 'vitest';
import { flushSync } from 'svelte';
import { resetDatabase, db } from '$lib/db';
import { liveQuery, liveQueryEffect } from './liveQuery.svelte';

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

  it('liveQueryEffect re-subscribes when deps change', async () => {
    await db.entries.bulkAdd([
      { id: '2026-05-27__s1', date: '2026-05-27', symptomId: 's1', sliderValue: null, numberValue: null, comment: '', updatedAt: 1 },
      { id: '2026-05-28__s1', date: '2026-05-28', symptomId: 's1', sliderValue: 50, numberValue: null, comment: '', updatedAt: 1 }
    ]);

    let date = $state('2026-05-27');
    let q!: { readonly current: { date: string }[] };
    const cleanup = $effect.root(() => {
      q = liveQueryEffect(
        () => db.entries.where('date').equals(date).toArray() as Promise<{ date: string }[]>,
        [] as { date: string }[],
        () => date
      );
    });

    await new Promise((r) => setTimeout(r, 30));
    expect(q.current.map((e) => e.date)).toEqual(['2026-05-27']);

    date = '2026-05-28';
    flushSync();
    await new Promise((r) => setTimeout(r, 30));
    expect(q.current.map((e) => e.date)).toEqual(['2026-05-28']);

    cleanup();
  });
});
