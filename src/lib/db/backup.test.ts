import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resetDatabase, db } from './index';
import { createSymptom } from './symptoms';
import {
  getReminderDays,
  setReminderDays,
  getLastBackupAt,
  recordBackupTime,
  performBackup
} from './backup';

describe('backup db helpers', () => {
  beforeEach(() => resetDatabase());

  it('getReminderDays defaults to 14 when unset', async () => {
    expect(await getReminderDays()).toBe(14);
  });

  it('setReminderDays stores a coerced value', async () => {
    await setReminderDays(100000);
    expect(await getReminderDays()).toBe(365);
  });

  it('setReminderDays can disable the reminder with 0', async () => {
    await setReminderDays(0);
    expect(await getReminderDays()).toBe(0);
  });

  it('getLastBackupAt is undefined before any backup', async () => {
    expect(await getLastBackupAt()).toBeUndefined();
  });

  it('recordBackupTime persists the timestamp', async () => {
    await recordBackupTime(12345);
    expect(await getLastBackupAt()).toBe(12345);
  });

  it('getLastBackupAt coerces a non-numeric/corrupt stored value to undefined', async () => {
    await db.meta.put({ key: 'lastBackupAt', value: 'corrupt' });
    expect(await getLastBackupAt()).toBeUndefined();
    await db.meta.put({ key: 'lastBackupAt', value: Number.NaN });
    expect(await getLastBackupAt()).toBeUndefined();
  });

  it('performBackup exports and records the backup time', async () => {
    const origCreate = URL.createObjectURL;
    const origRevoke = URL.revokeObjectURL;
    // jsdom does not implement object URLs; stub the download plumbing.
    URL.createObjectURL = vi.fn(() => 'blob:test');
    URL.revokeObjectURL = vi.fn();
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    try {
      await createSymptom({ name: 'Hitzewallungen' });
      await performBackup(99999);
      expect(clickSpy).toHaveBeenCalled();
      expect(await getLastBackupAt()).toBe(99999);
    } finally {
      URL.createObjectURL = origCreate;
      URL.revokeObjectURL = origRevoke;
      clickSpy.mockRestore();
    }
  });
});
