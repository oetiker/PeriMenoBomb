import { db, type Entry, type Symptom, entryKey } from './index';
import { isValidDateKey, addDays } from '$lib/utils/date';

export type EntryValues = Record<string, number | string | null>;

export interface UpsertEntryInput {
  date: string;
  symptomId: string;
  values?: EntryValues;
}

export async function upsertEntry(input: UpsertEntryInput): Promise<Entry> {
  if (!isValidDateKey(input.date)) {
    throw new Error(`invalid date key "${input.date}"`);
  }
  const id = entryKey(input.date, input.symptomId);
  const existing = await db.entries.get(id);
  const merged: Entry = {
    id,
    date: input.date,
    symptomId: input.symptomId,
    values: { ...(existing?.values ?? {}), ...(input.values ?? {}) },
    updatedAt: Date.now()
  };
  await db.entries.put(merged);
  return merged;
}

export async function getEntry(date: string, symptomId: string): Promise<Entry | undefined> {
  return db.entries.get(entryKey(date, symptomId));
}

export async function hasEntry(date: string, symptomId: string): Promise<boolean> {
  return (await db.entries.where('id').equals(entryKey(date, symptomId)).count()) > 0;
}

export async function deleteEntry(date: string, symptomId: string): Promise<void> {
  await db.entries.delete(entryKey(date, symptomId));
}

export async function listEntriesForDate(date: string): Promise<Entry[]> {
  return db.entries.where('date').equals(date).toArray();
}

export async function listEntriesForRange(fromDate: string, toDate: string): Promise<Entry[]> {
  return db.entries.where('date').between(fromDate, toDate, true, true).toArray();
}

export interface EntryValidationResult {
  ok: boolean;
  /** Field ids that are required, enabled (not deleted), and currently empty. */
  missing: string[];
}

export function validateEntry(symptom: Symptom, values: EntryValues): EntryValidationResult {
  const missing: string[] = [];
  for (const f of symptom.fields) {
    if (f.deleted || !f.required) continue;
    const v = values[f.id];
    if (f.type === 'slider' || f.type === 'number') {
      if (v === null || v === undefined || (typeof v === 'number' && Number.isNaN(v))) missing.push(f.id);
    } else if (f.type === 'select') {
      if (v === null || v === undefined || v === '') missing.push(f.id);
    } else { // text
      if (typeof v !== 'string' || v.trim().length === 0) missing.push(f.id);
    }
  }
  return { ok: missing.length === 0, missing };
}

/** Distinct dates (YYYY-MM-DD), ascending, on which an entry row exists for the
    symptom. The single source of truth for "an occurrence of symptom X",
    consumed by the cycle heatmap (columns) and the since-view (intervals). One
    entry per (date, symptom) is guaranteed by entryKey, so dates are unique and
    a lexical sort is chronological. An input-less event row still counts. */
export async function listOccurrenceDates(symptomId: string): Promise<string[]> {
  const rows = await db.entries.where('symptomId').equals(symptomId).toArray();
  return rows.map((e) => e.date).sort();
}

/** How many consecutive calendar days — ending on `date` — carry an occurrence
    of the symptom. Returns 0 when `date` itself has no entry, 1 for an isolated
    day, N for an N-day run ending on `date`. Used to surface "logged N days in
    a row" on the entry card. */
export async function streakEndingOn(symptomId: string, date: string): Promise<number> {
  const occurrences = new Set(await listOccurrenceDates(symptomId));
  if (!occurrences.has(date)) return 0;
  let count = 0;
  let cur = date;
  while (occurrences.has(cur)) {
    count++;
    cur = addDays(cur, -1);
  }
  return count;
}
