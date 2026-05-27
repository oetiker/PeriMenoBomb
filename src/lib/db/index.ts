import Dexie, { type Table } from 'dexie';

export interface Symptom {
  id: string;
  name: string;
  color: string;
  icon: string;
  tagIds: string[];
  parentId: string | null;
  sortIndex: number;
  depth: number;
  isFolder: boolean;
  archived: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface Tag {
  id: string;
  name: string;
  createdAt: number;
}

export type Intensity = 'leicht' | 'mittel' | 'stark' | null;

export interface Entry {
  id: string;          // `${date}__${symptomId}`
  date: string;        // YYYY-MM-DD
  symptomId: string;
  intensity: Intensity;
  comment: string;
  updatedAt: number;
}

export interface MetaRow {
  key: string;
  value: unknown;
}

export class PeriMenoDB extends Dexie {
  symptoms!: Table<Symptom, string>;
  tags!: Table<Tag, string>;
  entries!: Table<Entry, string>;
  meta!: Table<MetaRow, string>;

  constructor() {
    super('perimenobomb');
    this.version(1).stores({
      symptoms: 'id, parentId, [parentId+sortIndex], archived',
      tags: 'id, name',
      entries: 'id, date, symptomId, [date+symptomId]',
      meta: 'key'
    });
  }
}

export const db = new PeriMenoDB();

export async function resetDatabase(): Promise<void> {
  await db.transaction('rw', db.symptoms, db.tags, db.entries, db.meta, async () => {
    await Promise.all([
      db.symptoms.clear(),
      db.tags.clear(),
      db.entries.clear(),
      db.meta.clear()
    ]);
  });
}

export function entryKey(date: string, symptomId: string): string {
  return `${date}__${symptomId}`;
}
