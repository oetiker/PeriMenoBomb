import Dexie, { type Table, type Transaction } from 'dexie';
import { LUCIDE_TO_EMOJI, DEFAULT_SYMPTOM_EMOJI, looksLikeEmoji } from '$lib/icons/emoji';
import { newId } from '$lib/utils/uuid';

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

// The store/index definition is identical across every version — only the
// upgrade hooks differ — so it lives here once.
export const STORES = {
  symptoms: 'id, parentId, [parentId+sortIndex], archived',
  tags:     'id, name',
  entries:  'id, date, symptomId, [date+symptomId]',
  meta:     'key'
} as const;

export const CURRENT_DB_VERSION = 6;

/** Declare the full versioned schema + upgrade chain on a Dexie instance.
    Shared by the live PeriMenoDB and by the throwaway database used to replay
    an old backup through the real migrations on import (see importMigrate.ts),
    so the migrations are the single source of truth for both paths. */
export function defineSchema(db: Dexie): void {
  db.version(1).stores(STORES);
  db.version(2).stores(STORES).upgrade(upgradeV1toV2);
  db.version(3).stores(STORES).upgrade(upgradeV2toV3);
  db.version(4).stores(STORES).upgrade(upgradeV3toV4);
  db.version(5).stores(STORES).upgrade(upgradeV4toV5);
  db.version(6).stores(STORES).upgrade(upgradeV5toV6);
}

export class PeriMenoDB extends Dexie {
  symptoms!: Table<Symptom, string>;
  tags!: Table<Tag, string>;
  entries!: Table<Entry, string>;
  meta!: Table<MetaRow, string>;

  constructor() {
    super('perimenobomb');
    defineSchema(this);
  }
}

export async function upgradeV1toV2(tx: Transaction): Promise<void> {
  await tx.table('entries').clear();
  await tx.table('symptoms').toCollection().modify((s: Record<string, unknown>) => {
    if (!s.inputs) s.inputs = {
      slider:  { enabled: false, required: false, lowLabel: '', highLabel: '' },
      number:  { enabled: false, required: false, unit: '', integer: true },
      comment: { enabled: false, required: false },
      select:  { enabled: false, required: false, options: [] }
    };
    if (typeof s.daily !== 'boolean') s.daily = false;
  });
  await tx.table('meta').delete('openDialog');
}

export async function upgradeV2toV3(tx: Transaction): Promise<void> {
  // Lucide icons → system emojis. Unknown icons fall back to ⚪ (clearly "unset"
  // so users notice and re-pick) rather than guessing wrong.
  await tx.table('symptoms').toCollection().modify((s: Record<string, unknown>) => {
    if (s.icon && typeof s.icon === 'string' && !looksLikeEmoji(s.icon)) {
      s.icon = LUCIDE_TO_EMOJI[s.icon] ?? DEFAULT_SYMPTOM_EMOJI;
    }
    if (typeof s.duotone !== 'boolean') s.duotone = true;
  });
}

export async function upgradeV3toV4(tx: Transaction): Promise<void> {
  // Default existing symptoms to "with circle background" — matches the
  // pre-v4 visual.
  await tx.table('symptoms').toCollection().modify((s: Record<string, unknown>) => {
    if (typeof s.bg !== 'boolean') s.bg = true;
  });
}

export async function upgradeV4toV5(tx: Transaction): Promise<void> {
  // Add the (disabled, empty) select-input config to existing symptoms so
  // every record carries the full input shape.
  await tx.table('symptoms').toCollection().modify((s: Record<string, unknown>) => {
    const inputs = s.inputs as Record<string, unknown> | undefined;
    if (inputs && !inputs.select) {
      inputs.select = { enabled: false, required: false, options: [] };
    }
  });
}

/** Legacy fixed input shape used in v2–v5. Kept here only so upgrade functions
    remain self-contained and independent of current types. */
interface SymptomInputsLegacy {
  slider?:  { enabled: boolean; required: boolean; lowLabel: string; highLabel: string };
  number?:  { enabled: boolean; required: boolean; unit: string; integer: boolean };
  comment?: { enabled: boolean; required: boolean };
  select?:  { enabled: boolean; required: boolean; options: SelectOption[] };
}

type SlotMap = { slider?: string; number?: string; select?: string; comment?: string };

/** v5→v6: replace the fixed `inputs` struct with an ordered `fields` array, and
    rewrite each entry's fixed value columns into a field-keyed `values` map.
    Field order follows the old cascade (slider → number → select → comment) so
    display order stays sensible. Each new field gets a fresh UUID and a German
    default label the author can rename. */
export async function upgradeV5toV6(tx: Transaction): Promise<void> {
  const slots = new Map<string, SlotMap>();

  await tx.table('symptoms').toCollection().modify((s: Record<string, unknown>) => {
    const inp = s.inputs as SymptomInputsLegacy | undefined;
    const fields: MetaField[] = [];
    const map: SlotMap = {};
    if (inp?.slider?.enabled) {
      const id = newId();
      fields.push({ id, type: 'slider', label: 'Intensität', required: inp.slider.required, lowLabel: inp.slider.lowLabel, highLabel: inp.slider.highLabel });
      map.slider = id;
    }
    if (inp?.number?.enabled) {
      const id = newId();
      fields.push({ id, type: 'number', label: inp.number.unit || 'Wert', required: inp.number.required, unit: inp.number.unit, integer: inp.number.integer });
      map.number = id;
    }
    if (inp?.select?.enabled) {
      const id = newId();
      fields.push({ id, type: 'select', label: 'Auswahl', required: inp.select.required, options: inp.select.options });
      map.select = id;
    }
    if (inp?.comment?.enabled) {
      const id = newId();
      fields.push({ id, type: 'text', label: 'Notiz', required: inp.comment.required });
      map.comment = id;
    }
    s.fields = fields;
    delete s.inputs;
    slots.set(s.id as string, map);
  });

  await tx.table('entries').toCollection().modify((e: Record<string, unknown>) => {
    const map = slots.get(e.symptomId as string);
    const values: Record<string, number | string | null> = {};
    if (map) {
      if (map.slider !== undefined && e.sliderValue !== undefined) values[map.slider] = e.sliderValue as number | null;
      if (map.number !== undefined && e.numberValue !== undefined) values[map.number] = e.numberValue as number | null;
      if (map.select !== undefined && (e.selectKey ?? null) !== null) values[map.select] = e.selectKey as string;
      if (map.comment !== undefined && typeof e.comment === 'string' && e.comment.length > 0) values[map.comment] = e.comment;
    }
    e.values = values;
    delete e.sliderValue;
    delete e.numberValue;
    delete e.comment;
    delete e.selectKey;
  });

  const valueRow = await tx.table('meta').get('report.cycle.valueId');
  if (valueRow && typeof valueRow.value === 'string') {
    const map = slots.get(valueRow.value);
    const fieldId = map?.slider ?? map?.number ?? map?.select;
    if (fieldId) await tx.table('meta').put({ key: 'report.cycle.valueFieldId', value: fieldId });
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
