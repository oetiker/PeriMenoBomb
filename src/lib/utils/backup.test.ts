import { describe, it, expect } from 'vitest';
import { coerceReminderDays, isBackupDue, daysSinceBackup, DEFAULT_REMINDER_DAYS } from './backup';

const DAY = 86400000;
const NOW = 1_700_000_000_000;

describe('coerceReminderDays', () => {
  it('keeps a valid integer', () => {
    expect(coerceReminderDays(7)).toBe(7);
  });
  it('allows 0 (reminder off)', () => {
    expect(coerceReminderDays(0)).toBe(0);
  });
  it('floors fractional input', () => {
    expect(coerceReminderDays(14.9)).toBe(14);
  });
  it('clamps negatives to 0', () => {
    expect(coerceReminderDays(-5)).toBe(0);
  });
  it('clamps absurdly large values to 365', () => {
    expect(coerceReminderDays(100000)).toBe(365);
  });
  it('falls back to the default for a missing value', () => {
    expect(coerceReminderDays(undefined)).toBe(DEFAULT_REMINDER_DAYS);
  });
  it('falls back to the default for a non-numeric value', () => {
    expect(coerceReminderDays('abc')).toBe(DEFAULT_REMINDER_DAYS);
  });
});

describe('isBackupDue', () => {
  it('is never due when the reminder is disabled (0)', () => {
    expect(isBackupDue(0, undefined, NOW)).toBe(false);
    expect(isBackupDue(0, NOW - 999 * DAY, NOW)).toBe(false);
  });
  it('treats a negative interval as disabled', () => {
    expect(isBackupDue(-1, undefined, NOW)).toBe(false);
  });
  it('is due when there has never been a backup', () => {
    expect(isBackupDue(14, undefined, NOW)).toBe(true);
  });
  it('is not due before the interval elapses', () => {
    expect(isBackupDue(14, NOW - 13 * DAY, NOW)).toBe(false);
  });
  it('is due exactly at the interval', () => {
    expect(isBackupDue(14, NOW - 14 * DAY, NOW)).toBe(true);
  });
  it('is due after the interval', () => {
    expect(isBackupDue(14, NOW - 20 * DAY, NOW)).toBe(true);
  });
});

describe('daysSinceBackup', () => {
  it('returns null when there has never been a backup', () => {
    expect(daysSinceBackup(undefined, NOW)).toBeNull();
  });
  it('returns whole days elapsed, floored', () => {
    expect(daysSinceBackup(NOW - 3 * DAY - DAY / 2, NOW)).toBe(3);
  });
  it('returns 0 for a backup taken today', () => {
    expect(daysSinceBackup(NOW - 1000, NOW)).toBe(0);
  });
});
