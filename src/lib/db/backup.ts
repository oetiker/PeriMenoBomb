import { getMeta, setMeta } from './meta';
import { exportAll, gzipExport, downloadBlob } from '$lib/utils/transfer';
import { backupFileName } from '$lib/utils/backupRotation';
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
// Meta values are `unknown` at runtime and may be missing or corrupt (e.g.
// restored from an older/hand-edited backup); coerce anything non-finite to
// undefined so the reminder math never sees NaN and silently hides the banner.
export async function getLastBackupAt(): Promise<number | undefined> {
  const v = await getMeta<unknown>(LAST_BACKUP_KEY);
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

export async function recordBackupTime(now: number): Promise<void> {
  await setMeta(LAST_BACKUP_KEY, now);
}

// Export all data to a JSON download and stamp the backup time. Shared by the
// Settings export button and the day-view reminder banner so both record the
// backup identically.
export async function performBackup(now: number = Date.now()): Promise<void> {
  const payload = await exportAll();
  const blob = await gzipExport(payload);
  downloadBlob(backupFileName(todayKey()), blob);
  await recordBackupTime(now);
}
