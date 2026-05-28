import Dexie, { type Table, type Transaction } from 'dexie';

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
  inputs:    SymptomInputs;
  daily:     boolean;
}

export interface Tag {
  id: string;
  name: string;
  createdAt: number;
}

export interface SymptomInputs {
  slider:  { enabled: boolean; required: boolean; lowLabel: string; highLabel: string };
  number:  { enabled: boolean; required: boolean; unit: string; integer: boolean };
  comment: { enabled: boolean; required: boolean };
}

export function defaultSymptomInputs(): SymptomInputs {
  return {
    slider:  { enabled: false, required: false, lowLabel: '', highLabel: '' },
    number:  { enabled: false, required: false, unit: '', integer: true },
    comment: { enabled: false, required: false }
  };
}

export interface Entry {
  id:          string;
  date:        string;
  symptomId:   string;
  sliderValue: number | null;
  numberValue: number | null;
  comment:     string;
  updatedAt:   number;
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
    this.version(2).stores({
      symptoms: 'id, parentId, [parentId+sortIndex], archived',
      tags:     'id, name',
      entries:  'id, date, symptomId, [date+symptomId]',
      meta:     'key'
    }).upgrade(upgradeV1toV2);
  }
}

export async function upgradeV1toV2(tx: Transaction): Promise<void> {
  await tx.table('entries').clear();
  await tx.table('symptoms').toCollection().modify((s: Partial<Symptom>) => {
    if (!s.inputs) s.inputs = defaultSymptomInputs();
    if (typeof s.daily !== 'boolean') s.daily = false;
  });
  await tx.table('meta').delete('openDialog');
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
