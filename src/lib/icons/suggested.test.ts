import { describe, it, expect } from 'vitest';
import { SUGGESTED_ICONS } from './suggested';

describe('SUGGESTED_ICONS', () => {
  it('has at least 24 distinct icons', () => {
    expect(SUGGESTED_ICONS.length).toBeGreaterThanOrEqual(24);
    expect(new Set(SUGGESTED_ICONS).size).toBe(SUGGESTED_ICONS.length);
  });
  it('uses kebab-case names (Lucide convention)', () => {
    for (const i of SUGGESTED_ICONS) {
      expect(i).toMatch(/^[a-z][a-z0-9-]*$/);
    }
  });
});
