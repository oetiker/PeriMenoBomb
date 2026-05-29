import Dexie, { type Table, type Transaction } from 'dexie';
import { LUCIDE_TO_EMOJI, DEFAULT_SYMPTOM_EMOJI, looksLikeEmoji } from '$lib/icons/emoji';

export interface Symptom {
  id: string;
  name: string;
  color: string;
  /** Emoji glyph rendered by Badge. Legacy Lucide names are auto-migrated at
      v3; any value not matching an emoji is replaced with ⚪. */
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
  /** When true, Badge recolours the emoji to the symptom's chosen hue. When
      false, the native colourful emoji shows through. Per-symptom so users can
      mix and match. Optional in the type because pre-v3 records are upgraded
      lazily; the upgrade hook fills it in. */
  duotone?:  boolean;
  /** When true, Badge renders the chosen-colour circle behind the emoji. When
      false the emoji floats free at a larger size — useful for users who want
      a more minimal look or whose chosen emoji already carries enough visual
      weight on its own. Lazily backfilled in v4. */
  bg?:       boolean;
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
    this.version(3).stores({
      symptoms: 'id, parentId, [parentId+sortIndex], archived',
      tags:     'id, name',
      entries:  'id, date, symptomId, [date+symptomId]',
      meta:     'key'
    }).upgrade(upgradeV2toV3);
    this.version(4).stores({
      symptoms: 'id, parentId, [parentId+sortIndex], archived',
      tags:     'id, name',
      entries:  'id, date, symptomId, [date+symptomId]',
      meta:     'key'
    }).upgrade(upgradeV3toV4);
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

export async function upgradeV2toV3(tx: Transaction): Promise<void> {
  // Lucide icons → system emojis. Unknown icons fall back to ⚪ (clearly "unset"
  // so users notice and re-pick) rather than guessing wrong.
  await tx.table('symptoms').toCollection().modify((s: Partial<Symptom>) => {
    if (s.icon && !looksLikeEmoji(s.icon)) {
      s.icon = LUCIDE_TO_EMOJI[s.icon] ?? DEFAULT_SYMPTOM_EMOJI;
    }
    if (typeof s.duotone !== 'boolean') s.duotone = true;
  });
}

export async function upgradeV3toV4(tx: Transaction): Promise<void> {
  // Default existing symptoms to "with circle background" — matches the
  // pre-v4 visual.
  await tx.table('symptoms').toCollection().modify((s: Partial<Symptom>) => {
    if (typeof s.bg !== 'boolean') s.bg = true;
  });
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
