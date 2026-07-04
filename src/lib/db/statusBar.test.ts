// src/lib/db/statusBar.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { resetDatabase } from './index';
import { upsertEntry } from './entries';
import { daysSinceLastOccurrence } from './statusBar';

describe('daysSinceLastOccurrence', () => {
  beforeEach(() => resetDatabase());

  it('counts the occurrence day itself as day 1', async () => {
    await upsertEntry({ date: '2026-07-04', symptomId: 'sx' });
    expect(await daysSinceLastOccurrence('sx', '2026-07-04')).toBe(1);
  });

  it('counts yesterday as day 2', async () => {
    await upsertEntry({ date: '2026-07-03', symptomId: 'sx' });
    expect(await daysSinceLastOccurrence('sx', '2026-07-04')).toBe(2);
  });

  it('uses the most recent occurrence on or before the viewed day', async () => {
    await upsertEntry({ date: '2026-06-20', symptomId: 'sx' });
    await upsertEntry({ date: '2026-07-01', symptomId: 'sx' });
    expect(await daysSinceLastOccurrence('sx', '2026-07-04')).toBe(4);
  });

  it('ignores occurrences after the viewed day', async () => {
    await upsertEntry({ date: '2026-07-01', symptomId: 'sx' });
    await upsertEntry({ date: '2026-07-06', symptomId: 'sx' });
    expect(await daysSinceLastOccurrence('sx', '2026-07-04')).toBe(4);
  });

  it('returns null when there is no occurrence on or before the viewed day', async () => {
    await upsertEntry({ date: '2026-07-06', symptomId: 'sx' });
    expect(await daysSinceLastOccurrence('sx', '2026-07-04')).toBe(null);
    expect(await daysSinceLastOccurrence('other', '2026-07-04')).toBe(null);
  });
});
