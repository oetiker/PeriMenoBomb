import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { todayKey, toDateKey, toTimeKey, fromDateKey, isValidDateKey, addDays, formatLong, daysBetweenKeys } from './date';

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

  it('toTimeKey returns zero-padded HHMMSS in local time', () => {
    expect(toTimeKey(new Date('2026-05-27T09:08:07'))).toBe('090807');
    expect(toTimeKey(new Date('2026-05-27T14:30:52'))).toBe('143052');
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

  it('daysBetweenKeys returns 0 for the same day', () => {
    expect(daysBetweenKeys('2026-05-27', '2026-05-27')).toBe(0);
  });

  it('daysBetweenKeys returns signed whole-day difference', () => {
    expect(daysBetweenKeys('2026-05-29', '2026-05-27')).toBe(2);
    expect(daysBetweenKeys('2026-05-27', '2026-05-29')).toBe(-2);
  });

  it('daysBetweenKeys is correct across month and year boundaries', () => {
    expect(daysBetweenKeys('2027-01-01', '2026-12-31')).toBe(1);
    expect(daysBetweenKeys('2026-03-01', '2026-02-28')).toBe(1);
  });

  it('daysBetweenKeys is DST-safe (round, not floor)', () => {
    // EU DST spring-forward is 2026-03-29; the 29th is a 23h day locally.
    expect(daysBetweenKeys('2026-03-30', '2026-03-28')).toBe(2);
  });
});
