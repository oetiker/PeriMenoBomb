export const DEFAULT_RETENTION_DAYS = 14;
const MAX_RETENTION_DAYS = 365;
// Matches both the legacy dated name (`...2026-06-27.json.gz`, still produced by
// the manual download) and the timestamped auto-backup name
// (`...2026-06-27_143052.json.gz`). The optional time group is captured so a
// foreign-but-pattern-matching file can be range-validated before we ever delete it.
const NAME_RE = /^perimenobomb-(\d{4}-\d{2}-\d{2})(?:_(\d{2})(\d{2})(\d{2}))?\.json\.gz$/;
const DAY_MS = 86_400_000;

// Legacy single-per-day name; still used for the manual download where one file
// per day is what the user wants.
export function backupFileName(dateKey: string): string {
  return `perimenobomb-${dateKey}.json.gz`;
}

// Timestamped auto-backup name. We only ever create new files and delete old
// ones (Android content-URIs support neither atomic write nor move()), so each
// run gets a unique, lexically-sortable name.
export function autoBackupFileName(dateKey: string, timeKey: string): string {
  return `perimenobomb-${dateKey}_${timeKey}.json.gz`;
}

export function parseBackupDate(name: string): string | null {
  const m = NAME_RE.exec(name);
  if (!m) return null;
  const key = m[1];
  // The regex enforces digit structure but not calendar validity. Reject dates
  // that don't round-trip (e.g. 2026-13-45, 2026-02-30) so a foreign file that
  // merely fits the pattern is never selected for pruning (no accidental delete).
  const d = new Date(`${key}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== key) return null;
  // Same caution for the time part: reject impossible clock values.
  if (m[2] !== undefined) {
    const hh = Number(m[2]);
    const mm = Number(m[3]);
    const ss = Number(m[4]);
    if (hh > 23 || mm > 59 || ss > 59) return null;
  }
  return key;
}

export function coerceRetentionDays(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return DEFAULT_RETENTION_DAYS;
  return Math.min(MAX_RETENTION_DAYS, Math.max(1, Math.floor(n)));
}

// Parse a YYYY-MM-DD key to UTC epoch ms (date-only, so DST/timezone never
// shifts the comparison).
function keyToMs(key: string): number {
  return Date.parse(`${key}T00:00:00Z`);
}

// Two rules, applied to recognised backup files only (foreign/temp/invalid names
// are never touched):
//   1. delete anything whose day is older than the N-day window;
//   2. within the window, keep only the newest file per day and delete the rest.
// "Newest" = lexically largest name: timestamps are zero-padded and a legacy
// dated name sorts before any timestamped name of the same day, so it is treated
// as the oldest and gets replaced once a timestamped backup exists.
export function selectForPruning(
  names: string[],
  today: string,
  retentionDays: number
): { keep: string[]; delete: string[] } {
  const cutoff = keyToMs(today) - (coerceRetentionDays(retentionDays) - 1) * DAY_MS;
  const keep: string[] = [];
  const del: string[] = [];
  const newestPerDay = new Map<string, string>();
  const withinWindow: { name: string; day: string }[] = [];
  for (const name of names) {
    const day = parseBackupDate(name);
    if (day === null) continue; // foreign / temp file: never touch
    if (keyToMs(day) < cutoff) {
      del.push(name);
      continue;
    }
    withinWindow.push({ name, day });
    const cur = newestPerDay.get(day);
    if (cur === undefined || name > cur) newestPerDay.set(day, name);
  }
  for (const { name, day } of withinWindow) {
    if (name === newestPerDay.get(day)) keep.push(name);
    else del.push(name);
  }
  return { keep, delete: del };
}
