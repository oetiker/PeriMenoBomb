import { describe, it, expect, beforeEach } from 'vitest';
import { resetDatabase } from './index';
import { getMeta, setMeta, getOrDefault, shouldShowFirstRun } from './meta';
import { createSymptom } from './symptoms';
import { upsertEntry } from './entries';

describe('meta store', () => {
  beforeEach(() => resetDatabase());

  it('returns undefined for missing key', async () => {
    expect(await getMeta('language')).toBeUndefined();
  });

  it('stores and retrieves a value', async () => {
    await setMeta('language', 'de');
    expect(await getMeta('language')).toBe('de');
  });

  it('getOrDefault returns default when missing', async () => {
    expect(await getOrDefault('lastNDays', 14)).toBe(14);
  });

  it('getOrDefault returns stored when present', async () => {
    await setMeta('lastNDays', 30);
    expect(await getOrDefault('lastNDays', 14)).toBe(30);
  });
});

describe('shouldShowFirstRun', () => {
  beforeEach(() => resetDatabase());

  it('returns true on a truly empty database', async () => {
    expect(await shouldShowFirstRun()).toBe(true);
  });

  it('returns false once firstRunCompleted is set', async () => {
    await setMeta('firstRunCompleted', true);
    expect(await shouldShowFirstRun()).toBe(false);
  });

  it('returns false when symptoms survive but the flag was lost', async () => {
    await createSymptom({ name: 'Hitzewallungen' });
    expect(await shouldShowFirstRun()).toBe(false);
  });

  it('returns false when entries survive but the flag was lost', async () => {
    await upsertEntry({ date: '2026-06-27', symptomId: 'sx' });
    expect(await shouldShowFirstRun()).toBe(false);
  });
});
