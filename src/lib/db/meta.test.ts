import { describe, it, expect, beforeEach } from 'vitest';
import { resetDatabase } from './index';
import { getMeta, setMeta, getOrDefault } from './meta';

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
