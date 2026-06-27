import { describe, it, expect } from 'vitest';
import { backupFileName, autoBackupFileName, parseBackupDate, selectForPruning, coerceRetentionDays, DEFAULT_RETENTION_DAYS } from './backupRotation';

describe('backup file names', () => {
  it('builds and parses a dated download name', () => {
    expect(backupFileName('2026-06-27')).toBe('perimenobomb-2026-06-27.json.gz');
    expect(parseBackupDate('perimenobomb-2026-06-27.json.gz')).toBe('2026-06-27');
  });
  it('builds and parses a timestamped auto-backup name', () => {
    expect(autoBackupFileName('2026-06-27', '143052')).toBe('perimenobomb-2026-06-27_143052.json.gz');
    expect(parseBackupDate('perimenobomb-2026-06-27_143052.json.gz')).toBe('2026-06-27');
  });
  it('returns null for non-backup names (incl. our old temp file)', () => {
    expect(parseBackupDate('perimenobomb-2026-06-27.json.gz.tmp')).toBeNull();
    expect(parseBackupDate('perimenobomb-2026-06-27_143052.json.gz.tmp')).toBeNull();
    expect(parseBackupDate('notes.txt')).toBeNull();
  });
  it('returns null for pattern-matching names with an invalid calendar date', () => {
    expect(parseBackupDate('perimenobomb-2026-13-45.json.gz')).toBeNull();
    expect(parseBackupDate('perimenobomb-2026-02-30.json.gz')).toBeNull();
  });
  it('returns null for a timestamped name with an out-of-range time', () => {
    expect(parseBackupDate('perimenobomb-2026-06-27_250000.json.gz')).toBeNull();
    expect(parseBackupDate('perimenobomb-2026-06-27_006099.json.gz')).toBeNull();
  });
});

describe('selectForPruning ignores invalid-date files', () => {
  it('never deletes a pattern-matching file whose date is not a real calendar date', () => {
    const { keep, delete: del } = selectForPruning(
      ['perimenobomb-2026-13-45.json.gz', 'perimenobomb-2000-01-01_090000.json.gz'],
      '2026-06-27',
      14
    );
    expect(del).toEqual(['perimenobomb-2000-01-01_090000.json.gz']); // real old date still pruned
    expect(keep).not.toContain('perimenobomb-2026-13-45.json.gz'); // invalid date left alone
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

describe('selectForPruning N-day window', () => {
  const names = [
    'perimenobomb-2026-06-27_120000.json.gz', // today
    'perimenobomb-2026-06-26_120000.json.gz',
    'perimenobomb-2026-06-14_120000.json.gz', // exactly 14th day back (keep, N=14)
    'perimenobomb-2026-06-13_120000.json.gz', // older than 14 days (delete)
    'perimenobomb-2026-06-27.json.gz.tmp', // stray temp — left alone
    'README.txt' // foreign — left alone
  ];
  it('keeps files within N days, deletes older, ignores foreign/temp', () => {
    const { keep, delete: del } = selectForPruning(names, '2026-06-27', 14);
    expect(keep).toContain('perimenobomb-2026-06-14_120000.json.gz');
    expect(keep).toContain('perimenobomb-2026-06-27_120000.json.gz');
    expect(del).toEqual(['perimenobomb-2026-06-13_120000.json.gz']);
  });
});

describe('selectForPruning keeps only the newest backup per day', () => {
  it('deletes older same-day backups, keeps the latest timestamp', () => {
    const { keep, delete: del } = selectForPruning(
      [
        'perimenobomb-2026-06-27_080000.json.gz',
        'perimenobomb-2026-06-27_143052.json.gz',
        'perimenobomb-2026-06-27_120000.json.gz'
      ],
      '2026-06-27',
      14
    );
    expect(keep).toEqual(['perimenobomb-2026-06-27_143052.json.gz']);
    expect(del.sort()).toEqual([
      'perimenobomb-2026-06-27_080000.json.gz',
      'perimenobomb-2026-06-27_120000.json.gz'
    ]);
  });

  it('keeps newest-per-day across days and prunes days older than N', () => {
    const { keep, delete: del } = selectForPruning(
      [
        'perimenobomb-2026-06-27_080000.json.gz',
        'perimenobomb-2026-06-27_143052.json.gz',
        'perimenobomb-2026-06-26_090000.json.gz',
        'perimenobomb-2026-06-13_090000.json.gz' // older than 14 days
      ],
      '2026-06-27',
      14
    );
    expect(keep.sort()).toEqual([
      'perimenobomb-2026-06-26_090000.json.gz',
      'perimenobomb-2026-06-27_143052.json.gz'
    ]);
    expect(del.sort()).toEqual([
      'perimenobomb-2026-06-13_090000.json.gz',
      'perimenobomb-2026-06-27_080000.json.gz'
    ]);
  });

  it('treats a legacy dated file as older than a timestamped one the same day', () => {
    const { keep, delete: del } = selectForPruning(
      ['perimenobomb-2026-06-27.json.gz', 'perimenobomb-2026-06-27_143052.json.gz'],
      '2026-06-27',
      14
    );
    expect(keep).toEqual(['perimenobomb-2026-06-27_143052.json.gz']);
    expect(del).toEqual(['perimenobomb-2026-06-27.json.gz']);
  });
});
