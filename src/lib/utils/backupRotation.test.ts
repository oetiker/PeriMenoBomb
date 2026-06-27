import { describe, it, expect } from 'vitest';
import { backupFileName, parseBackupDate, selectForPruning, coerceRetentionDays, DEFAULT_RETENTION_DAYS } from './backupRotation';

describe('backup file names', () => {
  it('builds and parses a dated name', () => {
    expect(backupFileName('2026-06-27')).toBe('perimenobomb-2026-06-27.json.gz');
    expect(parseBackupDate('perimenobomb-2026-06-27.json.gz')).toBe('2026-06-27');
  });
  it('returns null for non-backup names (incl. our temp file)', () => {
    expect(parseBackupDate('perimenobomb-2026-06-27.json.gz.tmp')).toBeNull();
    expect(parseBackupDate('notes.txt')).toBeNull();
  });
});

describe('coerceRetentionDays', () => {
  it('defaults / clamps', () => {
    expect(coerceRetentionDays(undefined)).toBe(DEFAULT_RETENTION_DAYS);
    expect(coerceRetentionDays(0)).toBe(1);
    expect(coerceRetentionDays(10000)).toBe(365);
    expect(coerceRetentionDays(7.9)).toBe(7);
  });
});

describe('selectForPruning', () => {
  const names = [
    'perimenobomb-2026-06-27.json.gz', // today
    'perimenobomb-2026-06-26.json.gz',
    'perimenobomb-2026-06-14.json.gz', // exactly 14th day back (keep, N=14)
    'perimenobomb-2026-06-13.json.gz', // older than 14 days (delete)
    'perimenobomb-2026-06-27.json.gz.tmp', // stray temp — left alone
    'README.txt' // foreign — left alone
  ];
  it('keeps files within N days, deletes older, ignores foreign/temp', () => {
    const { keep, delete: del } = selectForPruning(names, '2026-06-27', 14);
    expect(keep).toContain('perimenobomb-2026-06-14.json.gz');
    expect(keep).toContain('perimenobomb-2026-06-27.json.gz');
    expect(del).toEqual(['perimenobomb-2026-06-13.json.gz']);
  });
});
