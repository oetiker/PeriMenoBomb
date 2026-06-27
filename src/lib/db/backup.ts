import { getMeta, setMeta } from './meta';
import { exportAll, downloadJson } from '$lib/utils/transfer';
import { todayKey } from '$lib/utils/date';
import { coerceReminderDays } from '$lib/utils/backup';

const REMINDER_DAYS_KEY = 'backupReminderDays';
const LAST_BACKUP_KEY = 'lastBackupAt';

// Configured reminder interval in days (0 = off), normalised on read so a
// missing or corrupt value falls back to the default.
export async function getReminderDays(): Promise<number> {
  return coerceReminderDays(await getMeta(REMINDER_DAYS_KEY));
}

export async function setReminderDays(value: unknown): Promise<void> {
  await setMeta(REMINDER_DAYS_KEY, coerceReminderDays(value));
}

// Epoch ms of the last successful backup, or undefined if never backed up.
export async function getLastBackupAt(): Promise<number | undefined> {
  return getMeta<number>(LAST_BACKUP_KEY);
}

export async function recordBackupTime(now: number): Promise<void> {
  await setMeta(LAST_BACKUP_KEY, now);
}

// Export all data to a JSON download and stamp the backup time. Shared by the
// Settings export button and the day-view reminder banner so both record the
// backup identically.
export async function performBackup(now: number = Date.now()): Promise<void> {
  const payload = await exportAll();
  downloadJson(`perimenobomb-export-${todayKey()}.json`, payload);
  await recordBackupTime(now);
}
