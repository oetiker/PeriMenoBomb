import { describe, it, expect } from 'vitest';
import { DEFAULT_LOCALE, SUPPORTED } from './locales';

describe('i18n locales', () => {
  it('defaults to de', () => {
    expect(DEFAULT_LOCALE).toBe('de');
    expect(SUPPORTED).toContain('de');
  });
});
