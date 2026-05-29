import { describe, it, expect, beforeEach } from 'vitest';
import { resetDatabase, db } from '$lib/db';
import { listOccurrenceDates } from '$lib/db/entries';
import { listAllSymptoms } from '$lib/db/symptoms';
import { loadTestData } from './testdata';

describe('loadTestData', () => {
  beforeEach(() => resetDatabase());

  it('imports the template and generates cycles + entries on an empty DB', async () => {
    const res = await loadTestData();
    expect(res.symptoms).toBeGreaterThan(0);
    expect(res.cycles).toBe(6);
    expect(res.entries).toBeGreaterThan(50);

    const all = await listAllSymptoms();
    const startMens = all.find((s) => s.name === 'Start Mens')!;
    expect(startMens).toBeDefined();
    // One occurrence per generated cycle.
    expect(await listOccurrenceDates(startMens.id)).toHaveLength(6);
  });

  it('does not re-import the template when symptoms already exist', async () => {
    await loadTestData();
    const before = await db.symptoms.count();
    await loadTestData();
    const after = await db.symptoms.count();
    expect(after).toBe(before); // no duplicate template
  });
});
