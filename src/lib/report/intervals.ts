import { daysBetweenKeys } from '$lib/utils/date';

export interface Interval {
  from: string;
  to: string;
  days: number;
}

export interface IntervalStats {
  avg: number | null;
  min: number | null;
  max: number | null;
  count: number;
}

/** Gaps between consecutive occurrences. Input MUST be ascending date keys
    (as returned by listOccurrenceDates). Output is newest-first. */
export function computeIntervals(ascendingDates: string[]): Interval[] {
  const out: Interval[] = [];
  for (let i = 1; i < ascendingDates.length; i++) {
    const from = ascendingDates[i - 1];
    const to = ascendingDates[i];
    out.push({ from, to, days: daysBetweenKeys(to, from) });
  }
  return out.reverse();
}

export function intervalStats(intervals: Interval[]): IntervalStats {
  if (intervals.length === 0) return { avg: null, min: null, max: null, count: 0 };
  const days = intervals.map((i) => i.days);
  const sum = days.reduce((a, b) => a + b, 0);
  return {
    avg: Math.round(sum / days.length),
    min: Math.min(...days),
    max: Math.max(...days),
    count: intervals.length
  };
}
