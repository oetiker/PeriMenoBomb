import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { todayKey, toDateKey, fromDateKey, isValidDateKey, addDays, formatLong } from './date';

describe('date utils', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-27T10:00:00'));
  });
  afterEach(() => vi.useRealTimers());

  it('todayKey returns ISO YYYY-MM-DD in local time', () => {
    expect(todayKey()).toBe('2026-05-27');
  });

  it('toDateKey converts Date to ISO key', () => {
    expect(toDateKey(new Date('2026-01-04T15:00:00'))).toBe('2026-01-04');
  });

  it('fromDateKey parses key back to Date at local midnight', () => {
    const d = fromDateKey('2026-05-27');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(4);
    expect(d.getDate()).toBe(27);
  });

  it('isValidDateKey accepts valid keys, rejects nonsense', () => {
    expect(isValidDateKey('2026-05-27')).toBe(true);
    expect(isValidDateKey('2026-13-01')).toBe(false);
    expect(isValidDateKey('not-a-date')).toBe(false);
  });

  it('addDays moves the key', () => {
    expect(addDays('2026-05-27', 1)).toBe('2026-05-28');
    expect(addDays('2026-05-01', -1)).toBe('2026-04-30');
  });

  it('formatLong renders German long form', () => {
    expect(formatLong('2026-05-27')).toMatch(/Mi.*27.*Mai.*2026/);
  });
});
