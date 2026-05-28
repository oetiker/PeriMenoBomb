import { db, type Entry, entryKey } from './index';
import { isValidDateKey } from '$lib/utils/date';

export interface UpsertEntryInput {
  date: string;
  symptomId: string;
  sliderValue?: number | null;
  numberValue?: number | null;
  comment?: string;
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
