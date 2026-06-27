// src/lib/db/fsBackup.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { resetDatabase } from './index';
import { isAutoBackupSupported, getRetentionDays, setRetentionDays, isAutoBackupEnabled, setAutoBackupEnabled } from './fsBackup';

describe('fsBackup config', () => {
  beforeEach(() => resetDatabase());

  it('reports unsupported when showDirectoryPicker is absent (jsdom)', () => {
    expect(isAutoBackupSupported()).toBe(false);
  });

  it('retention defaults to 14 and clamps', async () => {
    expect(await getRetentionDays()).toBe(14);
    await setRetentionDays(1000);
    expect(await getRetentionDays()).toBe(365);
  });

  it('enabled flag round-trips', async () => {
    expect(await isAutoBackupEnabled()).toBe(false);
    await setAutoBackupEnabled(true);
    expect(await isAutoBackupEnabled()).toBe(true);
  });
});
