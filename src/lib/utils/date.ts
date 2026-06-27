const KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function todayKey(): string {
  return toDateKey(new Date());
}

export function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Local-time HHMMSS, zero-padded. Used to make auto-backup filenames unique
// within a day (no colons — illegal on filesystems and Android's SAF).
export function toTimeKey(d: Date): string {
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  const s = String(d.getSeconds()).padStart(2, '0');
  return `${h}${m}${s}`;
}

export function fromDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

export function isValidDateKey(key: string): boolean {
  if (!KEY_RE.test(key)) return false;
  const d = fromDateKey(key);
  return toDateKey(d) === key;
}

export function addDays(key: string, delta: number): string {
  const d = fromDateKey(key);
  d.setDate(d.getDate() + delta);
  return toDateKey(d);
}

export function formatLong(key: string, locale = 'de-CH'): string {
  return fromDateKey(key).toLocaleDateString(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

/** Whole-day difference a − b for two YYYY-MM-DD keys. Uses round() so DST
    transitions (23h/25h local days) don't shift the result by one. */
export function daysBetweenKeys(a: string, b: string): number {
  const MS_PER_DAY = 86_400_000;
  return Math.round((fromDateKey(a).getTime() - fromDateKey(b).getTime()) / MS_PER_DAY);
}
