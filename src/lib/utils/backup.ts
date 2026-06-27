// Pure backup-reminder logic. No DOM or DB access so it can be unit-tested in
// isolation; the db/UI wiring lives in src/lib/db/backup.ts and the components.

const DAY_MS = 86_400_000;

export const DEFAULT_REMINDER_DAYS = 14;
export const MAX_REMINDER_DAYS = 365;

// Normalise a stored or user-entered reminder interval into a whole number of
// days in [0, 365]. 0 means "reminder off". Non-numeric / missing input falls
// back to the default so a corrupt value never disables the reminder silently.
export function coerceReminderDays(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return DEFAULT_REMINDER_DAYS;
  return Math.min(MAX_REMINDER_DAYS, Math.max(0, Math.floor(n)));
}

// Whether a backup reminder is currently due. Disabled intervals are never due;
// a never-backed-up state (undefined) is always due once enabled.
export function isBackupDue(
  reminderDays: number,
  lastBackupAt: number | undefined,
  now: number
): boolean {
  if (reminderDays <= 0) return false;
  if (lastBackupAt === undefined) return true;
  return now - lastBackupAt >= reminderDays * DAY_MS;
}

// Whole days since the last backup, floored; null if there has never been one.
export function daysSinceBackup(lastBackupAt: number | undefined, now: number): number | null {
  if (lastBackupAt === undefined) return null;
  return Math.floor((now - lastBackupAt) / DAY_MS);
}
