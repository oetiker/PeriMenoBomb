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
  /** Ordered metadata fields. Empty for new symptoms until the author adds some. */
  fields: MetaField[];
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

/** One choice in a symptom's select-input. */
export interface SelectOption {
  /** Stable identity, generated once via newId() and never changed. The chosen
      key is what gets stored on the Entry, so renaming `label` later never
      breaks the continuity of historical logs. */
  key: string;
  /** Free-text display label. Safe to edit at any time. */
  label: string;
  /** Optional numeric weight. When set, the chosen option's value feeds the
      cycle-heatmap intensity (the same way a number/slider value does). */
  value: number | null;
  /** Soft-delete flag. A deleted option is hidden from the live dropdown but
      kept in the config (so past entries still resolve their label and the
      author can restore it). Absent/false means active. */
  deleted?: boolean;
}

export type FieldType = 'slider' | 'number' | 'text' | 'select';

export interface BaseField {
  /** Stable identity (newId()); never changes across label edits or reorder. */
  id: string;
  /** Always present, customizable display label. */
  label: string;
  required: boolean;
  /** Soft-delete: hidden from the editor and logging form but kept so historical
      entry values still resolve and the field can be restored. */
  deleted?: boolean;
}
export interface SliderField extends BaseField { type: 'slider'; lowLabel: string; highLabel: string }
export interface NumberField extends BaseField { type: 'number'; unit: string; integer: boolean }
export interface TextField   extends BaseField { type: 'text' }
export interface SelectField extends BaseField { type: 'select'; options: SelectOption[] }
/** One ordered, UUID-keyed metadata field on a symptom. A symptom may carry any
    number of these, in any mix of types. */
export type MetaField = SliderField | NumberField | TextField | SelectField;

export function defaultSymptomFields(): MetaField[] {
  return [];
}

export interface Entry {
  id:          string;
  date:        string;
  symptomId:   string;
  /** Logged values keyed by field id. slider/number → number|null; text →
      string; select → chosen option key (string) | null. A missing key means
      the field was not logged. */
  values: Record<string, number | string | null>;
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
    this.version(5).stores({
      symptoms: 'id, parentId, [parentId+sortIndex], archived',
      tags:     'id, name',
      entries:  'id, date, symptomId, [date+symptomId]',
      meta:     'key'
    }).upgrade(upgradeV4toV5);
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

export async function upgradeV4toV5(tx: Transaction): Promise<void> {
  // Add the (disabled, empty) select-input config to existing symptoms so
  // every record carries the full input shape.
  await tx.table('symptoms').toCollection().modify((s: Partial<Symptom>) => {
    if (s.inputs && !s.inputs.select) {
      s.inputs.select = { enabled: false, required: false, options: [] };
    }
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
