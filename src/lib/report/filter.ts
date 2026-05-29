import type { Entry, Symptom } from '$lib/db';

export interface EntryFilter {
  symptomIds?: string[];
  tagIds?: string[];
  from?: string | null;
  to?: string | null;
}

export interface DayGroup {
  date: string;
  entries: Entry[];
}

/** Narrow entries by symptom, tag (via the symptom's tagIds), and inclusive
    date range. When BOTH symptomIds and tagIds are given, an entry matches if
    its symptom is in symptomIds OR carries one of tagIds (union). An empty or
    omitted filter field is "no constraint". */
export function filterEntries(
  entries: Entry[],
  symptoms: Map<string, Symptom>,
  filter: EntryFilter
): Entry[] {
  const symIds = filter.symptomIds && filter.symptomIds.length ? new Set(filter.symptomIds) : null;
  const tagIds = filter.tagIds && filter.tagIds.length ? new Set(filter.tagIds) : null;
  const from = filter.from ?? null;
  const to = filter.to ?? null;

  return entries.filter((e) => {
    if (from && e.date < from) return false;
    if (to && e.date > to) return false;
    if (!symIds && !tagIds) return true;
    const sym = symptoms.get(e.symptomId);
    const bySym = symIds ? symIds.has(e.symptomId) : false;
    const byTag = tagIds && sym ? sym.tagIds.some((t) => tagIds.has(t)) : false;
    return bySym || byTag;
  });
}

/** Bucket entries into day groups, newest day first. Within a day, original
    entry order is preserved. */
export function groupEntriesByDay(entries: Entry[]): DayGroup[] {
  const byDate = new Map<string, Entry[]>();
  for (const e of entries) {
    const list = byDate.get(e.date) ?? [];
    list.push(e);
    byDate.set(e.date, list);
  }
  return [...byDate.keys()]
    .sort((a, b) => (a < b ? 1 : a > b ? -1 : 0)) // descending
    .map((date) => ({ date, entries: byDate.get(date)! }));
}
