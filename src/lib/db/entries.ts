import { db, type Entry, type Symptom, entryKey } from './index';
import { isValidDateKey, addDays } from '$lib/utils/date';

export interface UpsertEntryInput {
  date: string;
  symptomId: string;
  sliderValue?: number | null;
  numberValue?: number | null;
  comment?: string;
  selectKey?: string | null;
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
    sliderValue: input.sliderValue !== undefined ? input.sliderValue : existing?.sliderValue ?? null,
    numberValue: input.numberValue !== undefined ? input.numberValue : existing?.numberValue ?? null,
    comment:     input.comment     !== undefined ? input.comment     : existing?.comment     ?? '',
    selectKey:   input.selectKey   !== undefined ? input.selectKey   : existing?.selectKey   ?? null,
    updatedAt:   Date.now()
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

/** Human-readable label for an entry's select choice, or '' when the symptom
    is not a select or nothing was chosen. A soft-deleted option still resolves
    (so historical logs stay legible) and is suffixed with "(gelöscht)"; a key
    with no matching option at all shows a neutral placeholder. */
export function selectLabelFor(symptom: Symptom, entry: { selectKey?: string | null }): string {
  const sel = symptom.inputs.select;
  if (!sel?.enabled) return '';
  const key = entry.selectKey;
  if (key === null || key === undefined) return '';
  const opt = sel.options.find((o) => o.key === key);
  if (!opt) return '(unbekannte Auswahl)';
  const label = opt.label || '(ohne Name)';
  return opt.deleted ? `${label} (gelöscht)` : label;
}

export type EntryValidationField = 'slider' | 'number' | 'comment' | 'select';

export interface EntryValidationResult {
  ok: boolean;
  missing: EntryValidationField[];
}

export interface EntryFieldsLike {
  sliderValue: number | null;
  numberValue: number | null;
  comment: string;
  selectKey?: string | null;
}

export function validateEntry(symptom: Symptom, entry: EntryFieldsLike): EntryValidationResult {
  const missing: EntryValidationField[] = [];
  const i = symptom.inputs;
  if (i.slider.enabled && i.slider.required && entry.sliderValue === null) missing.push('slider');
  if (i.number.enabled && i.number.required && (entry.numberValue === null || Number.isNaN(entry.numberValue))) missing.push('number');
  if (i.comment.enabled && i.comment.required && entry.comment.trim().length === 0) missing.push('comment');
  if (i.select?.enabled && i.select.required && (entry.selectKey === null || entry.selectKey === undefined)) missing.push('select');
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
