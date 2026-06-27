export const DEFAULT_RETENTION_DAYS = 14;
const MAX_RETENTION_DAYS = 365;
const NAME_RE = /^perimenobomb-(\d{4}-\d{2}-\d{2})\.json\.gz$/;
const DAY_MS = 86_400_000;

export function backupFileName(dateKey: string): string {
  return `perimenobomb-${dateKey}.json.gz`;
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

export function selectForPruning(
  names: string[],
  today: string,
  retentionDays: number
): { keep: string[]; delete: string[] } {
  const cutoff = keyToMs(today) - (coerceRetentionDays(retentionDays) - 1) * DAY_MS;
  const keep: string[] = [];
  const del: string[] = [];
  for (const name of names) {
    const date = parseBackupDate(name);
    if (date === null) continue; // foreign / temp file: never touch
    if (keyToMs(date) >= cutoff) keep.push(name);
    else del.push(name);
  }
  return { keep, delete: del };
}
