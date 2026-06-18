# Flexible Symptom Metadata Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the fixed four-slot symptom metadata (`SymptomInputs`) with an ordered, reorderable array of UUID-keyed, labeled `MetaField`s (types: slider / number / text / select), and move logged values from fixed `Entry` columns into a field-keyed `values` map.

**Architecture:** A symptom owns `fields: MetaField[]`. Each field has a stable `id`, a customizable `label`, a `required` flag, an optional `deleted` soft-delete flag, and type-specific config. An `Entry` stores `values: Record<fieldId, number | string | null>`. The cycle heatmap is driven by a *specific selected field* (picked as `Symptom [FieldLabel]`), not a per-symptom type cascade. A Dexie v5→v6 migration converts existing symptoms' enabled inputs into fields and rewrites existing entries' values.

**Tech Stack:** Svelte 5 (runes), SvelteKit 2, Dexie 4 (IndexedDB), TypeScript, Vitest + fake-indexeddb, `@lucide/svelte`.

## Global Constraints

- **Package manager: pnpm** — never npm/yarn. Run scripts with `pnpm`.
- **Parallelism cap:** never let test/build use more than 4 cores. Vitest: append `--no-file-parallelism` or `--poolOptions.threads.maxThreads=4` only if a run spawns heavy parallelism; the default single-file runs below are fine.
- **Comments / code identifiers in English; user-facing UI strings in German.** German UI must avoid the generic masculine (use neutral terms or `:innen`).
- **Offline-first PWA:** no new runtime network fetches, no CDN. All logic stays local.
- **`$state` + Dexie:** always `$state.snapshot(...)` reactive state before persisting to Dexie or `structuredClone`, else `DataCloneError`.
- **UUIDs:** mint via `newId()` from `$lib/utils/uuid` (it has the non-secure-context fallback). Never call `crypto.randomUUID()` directly.
- **No existing real users:** auto-migration must still be correct (the developer dogfoods data), but no compatibility shims beyond the v6 upgrade are required.
- **Type-check timing:** because the core type change in Task 1 touches every consumer, a full `pnpm check` / `pnpm build` will NOT pass until Task 15. Per-task verification runs the task's own Vitest file (Vitest transpiles per-file and does not fail on unrelated type errors). Task 15 is the integration gate that must pass `pnpm check` and `pnpm build`.

---

## Shared Interfaces (defined in Task 1, referenced everywhere)

```ts
// src/lib/db/index.ts
export type FieldType = 'slider' | 'number' | 'text' | 'select';

export interface BaseField {
  id: string;        // newId(); stable across label & order changes
  label: string;     // always present, customizable
  required: boolean;
  deleted?: boolean; // soft-delete; keeps historical values resolvable
}
export interface SliderField extends BaseField { type: 'slider'; lowLabel: string; highLabel: string }
export interface NumberField extends BaseField { type: 'number'; unit: string; integer: boolean }
export interface TextField   extends BaseField { type: 'text' }
export interface SelectField extends BaseField { type: 'select'; options: SelectOption[] }
export type MetaField = SliderField | NumberField | TextField | SelectField;

// Symptom: `inputs: SymptomInputs` REMOVED, replaced by:
fields: MetaField[];

// Entry: sliderValue/numberValue/comment/selectKey REMOVED, replaced by:
values: Record<string, number | string | null>;
```

```ts
// src/lib/db/fields.ts (Task 1)
export function newField(type: FieldType): MetaField
export function isValueField(f: MetaField): boolean            // slider | number | select
export function selectOptionLabel(field: SelectField, key: string | null | undefined): string
export interface FieldDisplay { field: MetaField; text: string }
export function entryFieldDisplays(symptom: Symptom, entry: Pick<Entry, 'values'>): FieldDisplay[]
```

```ts
// src/lib/db/entries.ts (Task 2)
export type EntryValues = Record<string, number | string | null>;
export interface UpsertEntryInput { date: string; symptomId: string; values?: EntryValues }
export interface EntryValidationResult { ok: boolean; missing: string[] }  // missing = field ids
export function validateEntry(symptom: Symptom, values: EntryValues): EntryValidationResult
// selectLabelFor() and EntryFieldsLike/EntryValidationField are REMOVED.
```

```ts
// src/lib/report/heatmap.ts (Task 6) — now field-scoped
export function valueNumberDomain(entries: Entry[], field: NumberField): NumberDomain | null
export function selectEntryValue(field: SelectField, entry: Entry): number | null
export function selectValueDomain(entries: Entry[], field: SelectField): NumberDomain | null
export function valueDomain(entries: Entry[], field: MetaField): NumberDomain | null
export function classifyCell(field: MetaField, entry: Entry | undefined, domain: NumberDomain | null): Cell
```

---

## File Structure

- **Modify** `src/lib/db/index.ts` — new types, `defaultSymptomFields()`, schema v6 + `upgradeV5toV6`.
- **Create** `src/lib/db/fields.ts` — field factory + display/label helpers.
- **Modify** `src/lib/db/entries.ts` — `values`-based upsert/validate; drop `selectLabelFor`.
- **Modify** `src/lib/db/symptoms.ts` — `fields` in create input; `hasEnabledField`.
- **Modify** `src/lib/templates/perimeno-default.ts` + `src/lib/templates/import.ts` — emit `fields`.
- **Modify** `src/lib/report/heatmap.ts` — field-scoped intensity/domain.
- **Modify** `src/lib/stores/openDialog.svelte.ts` — payload shapes (`values`, `fields`).
- **Modify** `src/routes/day/[date]/+page.svelte` — restore via `values`.
- **Rename+rewrite** `src/lib/components/SymptomAdmin/InputConfigSection.svelte` → `FieldListEditor.svelte` (reorderable field list).
- **Modify** `src/lib/components/SymptomAdmin/SymptomEditModal.svelte` — `fields` wiring.
- **Modify** `src/lib/components/EntryEditor/EntryEditor.svelte` — render fields, bind `values`.
- **Modify** `src/lib/components/DayView/EntryCard.svelte` + `src/lib/components/report/ReportEntryRow.svelte` — render via `entryFieldDisplays`.
- **Modify** `src/routes/report/cycle/+page.svelte` — value-field picker + persistence.
- **Modify** `src/lib/report/pdf.ts` — per-field export.
- **Modify** `src/lib/dev/testdata.ts` — seed via `values`.
- **No change needed:** `src/lib/utils/transfer.ts` (copies records generically), input sub-components `SliderInput.svelte` / `NumberInput.svelte` / `SelectInput.svelte` (already prop-driven).

---

### Task 1: Core types, `defaultSymptomFields`, and field helpers

**Files:**
- Modify: `src/lib/db/index.ts`
- Create: `src/lib/db/fields.ts`
- Test: `src/lib/db/fields.test.ts`

**Interfaces:**
- Produces: all the types in *Shared Interfaces* above plus `defaultSymptomFields()`, and the `fields.ts` helpers.

- [ ] **Step 1: Write the failing test** — create `src/lib/db/fields.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { newField, isValueField, selectOptionLabel, entryFieldDisplays } from './fields';
import type { Symptom, SelectField } from './index';

function sym(fields: Symptom['fields']): Symptom {
  return {
    id: 's1', name: 'S', color: '#000', icon: '⚪', tagIds: [], parentId: null,
    sortIndex: 0, depth: 0, isFolder: false, archived: false, createdAt: 1, updatedAt: 1,
    fields, daily: false, duotone: true, bg: true
  };
}

describe('newField', () => {
  it('mints a slider field with a German default label and config', () => {
    const f = newField('slider');
    expect(f.type).toBe('slider');
    expect(f.label).toBe('Intensität');
    expect(f.required).toBe(false);
    expect(f.id).toMatch(/[0-9a-f-]{8,}/);
    if (f.type === 'slider') { expect(f.lowLabel).toBe(''); expect(f.highLabel).toBe(''); }
  });
  it('mints number/text/select defaults', () => {
    expect(newField('number').label).toBe('Wert');
    expect(newField('text').label).toBe('Notiz');
    const sel = newField('select');
    expect(sel.label).toBe('Auswahl');
    if (sel.type === 'select') expect(sel.options).toEqual([]);
  });
});

describe('isValueField', () => {
  it('is true for slider/number/select, false for text', () => {
    expect(isValueField(newField('slider'))).toBe(true);
    expect(isValueField(newField('number'))).toBe(true);
    expect(isValueField(newField('select'))).toBe(true);
    expect(isValueField(newField('text'))).toBe(false);
  });
});

describe('selectOptionLabel', () => {
  const field: SelectField = {
    id: 'f', type: 'select', label: 'A', required: false,
    options: [{ key: 'k1', label: 'leicht', value: null }, { key: 'k2', label: 'stark', value: null, deleted: true }]
  };
  it('resolves active, deleted, unknown and empty keys', () => {
    expect(selectOptionLabel(field, 'k1')).toBe('leicht');
    expect(selectOptionLabel(field, 'k2')).toBe('stark (gelöscht)');
    expect(selectOptionLabel(field, 'zzz')).toBe('(unbekannte Auswahl)');
    expect(selectOptionLabel(field, null)).toBe('');
  });
});

describe('entryFieldDisplays', () => {
  it('returns ordered non-empty values, slider null → unspez, skips unlogged & deleted', () => {
    const sl = newField('slider'); const nu = newField('number');
    const tx = newField('text'); const del = { ...newField('text'), deleted: true };
    if (nu.type === 'number') nu.unit = 'Tassen';
    const s = sym([sl, nu, tx, del]);
    const out = entryFieldDisplays(s, { values: { [sl.id]: null, [nu.id]: 3, [tx.id]: 'hallo', [del.id]: 'x' } });
    expect(out.map((d) => d.text)).toEqual(['unspez', '3 Tassen', 'hallo']);
  });
  it('omits a field with no stored value', () => {
    const nu = newField('number');
    const s = sym([nu]);
    expect(entryFieldDisplays(s, { values: {} })).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test — verify it fails**

Run: `pnpm exec vitest run src/lib/db/fields.test.ts`
Expected: FAIL — `Cannot find module './fields'` (and type imports unresolved).

- [ ] **Step 3: Add the new types and `defaultSymptomFields` to `src/lib/db/index.ts`**

Keep `SelectOption` as-is. Insert the field types right after the `SelectOption` interface (after line 54), and REPLACE the `SymptomInputs` interface + `defaultSymptomInputs` (lines 56–73) with:

```ts
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
```

In the `Symptom` interface, REPLACE `inputs: SymptomInputs;` (line 19) with:

```ts
  /** Ordered metadata fields. Empty for new symptoms until the author adds some. */
  fields: MetaField[];
```

In the `Entry` interface, REPLACE the four value fields (`sliderValue`, `numberValue`, `comment`, `selectKey` — lines 79–85) with:

```ts
  /** Logged values keyed by field id. slider/number → number|null; text →
      string; select → chosen option key (string) | null. A missing key means
      the field was not logged. */
  values: Record<string, number | string | null>;
```

- [ ] **Step 4: Create `src/lib/db/fields.ts`**

```ts
import { newId } from '$lib/utils/uuid';
import type { MetaField, FieldType, SelectField, Symptom, Entry } from './index';

/** Mint a new field of the given type with a German default label the author
    can immediately rename. The label is what keeps multi-value symptoms legible
    (e.g. "Systolisch" / "Diastolisch"). */
export function newField(type: FieldType): MetaField {
  const id = newId();
  switch (type) {
    case 'slider': return { id, type, label: 'Intensität', required: false, lowLabel: '', highLabel: '' };
    case 'number': return { id, type, label: 'Wert', required: false, unit: '', integer: true };
    case 'text':   return { id, type, label: 'Notiz', required: false };
    case 'select': return { id, type, label: 'Auswahl', required: false, options: [] };
  }
}

/** Field types that can drive heatmap intensity / be picked as a value series. */
export function isValueField(f: MetaField): boolean {
  return f.type === 'slider' || f.type === 'number' || f.type === 'select';
}

/** Human label for a stored select-option key. A soft-deleted option still
    resolves (suffixed "(gelöscht)"); an unknown key shows a neutral placeholder;
    null/undefined → ''. */
export function selectOptionLabel(field: SelectField, key: string | null | undefined): string {
  if (key === null || key === undefined) return '';
  const opt = field.options.find((o) => o.key === key);
  if (!opt) return '(unbekannte Auswahl)';
  const label = opt.label || '(ohne Name)';
  return opt.deleted ? `${label} (gelöscht)` : label;
}

export interface FieldDisplay { field: MetaField; text: string }

/** Ordered, human-readable values for an entry's non-deleted fields. A slider
    logged as null reads 'unspez'; fields with no stored value are omitted. */
export function entryFieldDisplays(symptom: Symptom, entry: Pick<Entry, 'values'>): FieldDisplay[] {
  const out: FieldDisplay[] = [];
  const values = entry.values ?? {};
  for (const f of symptom.fields) {
    if (f.deleted) continue;
    const v = values[f.id];
    if (f.type === 'slider') {
      if (v === undefined) continue;
      out.push({ field: f, text: v === null ? 'unspez' : String(v) });
    } else if (f.type === 'number') {
      if (v === null || v === undefined || (typeof v === 'number' && Number.isNaN(v))) continue;
      out.push({ field: f, text: f.unit ? `${v} ${f.unit}` : String(v) });
    } else if (f.type === 'select') {
      const label = selectOptionLabel(f, typeof v === 'string' ? v : null);
      if (!label) continue;
      out.push({ field: f, text: label });
    } else {
      if (typeof v !== 'string' || v.trim().length === 0) continue;
      out.push({ field: f, text: v });
    }
  }
  return out;
}
```

- [ ] **Step 5: Run the test — verify it passes**

Run: `pnpm exec vitest run src/lib/db/fields.test.ts`
Expected: PASS (all cases green).

- [ ] **Step 6: Commit**

```bash
git add src/lib/db/index.ts src/lib/db/fields.ts src/lib/db/fields.test.ts
git commit -m "feat(db): add MetaField types and field helpers"
```

---

### Task 2: Entry persistence & validation on `values`

**Files:**
- Modify: `src/lib/db/entries.ts`
- Test: `src/lib/db/entries.test.ts` (rewrite the affected cases)

**Interfaces:**
- Consumes: `MetaField`, `Symptom`, `Entry` from Task 1.
- Produces: `EntryValues`, `UpsertEntryInput {values?}`, `validateEntry(symptom, values)`, `EntryValidationResult {ok, missing: string[]}`. Removes `selectLabelFor`, `EntryFieldsLike`, `EntryValidationField`.

- [ ] **Step 1: Rewrite the validation/upsert tests** in `src/lib/db/entries.test.ts`. First read the file to see existing structure, then replace cases that referenced `sliderValue`/`numberValue`/`comment`/`selectKey`/`validateEntry`/`selectLabelFor` with field-based equivalents. Add this focused block (adapt the existing `beforeEach`/db-reset harness already in the file):

```ts
import { newField } from './fields';
// inside the existing describe with a real `db`:

it('upsertEntry merges values by field id', async () => {
  const f1 = newField('number'); const f2 = newField('text');
  await upsertEntry({ date: '2026-06-01', symptomId: 'sx', values: { [f1.id]: 2 } });
  await upsertEntry({ date: '2026-06-01', symptomId: 'sx', values: { [f2.id]: 'hi' } });
  const e = await getEntry('2026-06-01', 'sx');
  expect(e!.values).toEqual({ [f1.id]: 2, [f2.id]: 'hi' });
});

it('validateEntry flags required-but-missing fields by id', () => {
  const req = { ...newField('number'), required: true };
  const opt = newField('text');
  const symptom = {
    id: 's', name: 'S', color: '#000', icon: '⚪', tagIds: [], parentId: null,
    sortIndex: 0, depth: 0, isFolder: false, archived: false, createdAt: 1, updatedAt: 1,
    fields: [req, opt], daily: false, duotone: true, bg: true
  } as Symptom;
  expect(validateEntry(symptom, {}).missing).toEqual([req.id]);
  expect(validateEntry(symptom, { [req.id]: 5 }).ok).toBe(true);
});

it('validateEntry ignores deleted required fields', () => {
  const del = { ...newField('number'), required: true, deleted: true };
  const symptom = { /* same shape */ fields: [del] } as unknown as Symptom;
  expect(validateEntry(symptom, {}).ok).toBe(true);
});
```

Ensure `Symptom` and `validateEntry`/`upsertEntry`/`getEntry` are imported at the top of the test file.

- [ ] **Step 2: Run the test — verify it fails**

Run: `pnpm exec vitest run src/lib/db/entries.test.ts`
Expected: FAIL — `validateEntry` signature mismatch / `values` undefined on Entry.

- [ ] **Step 3: Rewrite the affected exports in `src/lib/db/entries.ts`**

Replace the `UpsertEntryInput` interface + `upsertEntry` body (lines 4–31) with:

```ts
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
```

DELETE `selectLabelFor` (lines 53–66) entirely — its replacement is `selectOptionLabel` in `fields.ts`.

Replace the validation block (lines 68–90) with:

```ts
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
```

(`listOccurrenceDates` / `streakEndingOn` below stay unchanged — they're presence-based.)

- [ ] **Step 4: Run the test — verify it passes**

Run: `pnpm exec vitest run src/lib/db/entries.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/entries.ts src/lib/db/entries.test.ts
git commit -m "feat(db): value-map upsert and field-based entry validation"
```

---

### Task 3: Dexie v5 → v6 migration

**Files:**
- Modify: `src/lib/db/index.ts` (add `version(6)` + `upgradeV5toV6`)
- Test: `src/lib/db/migration.test.ts` (add a v5→v6 describe block)

**Interfaces:**
- Consumes: `MetaField` types from Task 1.
- Produces: `upgradeV5toV6(tx: Transaction): Promise<void>`.

- [ ] **Step 1: Write the failing test** — append to `src/lib/db/migration.test.ts`:

```ts
import { upgradeV5toV6 } from './index';

describe('Dexie schema v5 → v6 upgrade', () => {
  beforeEach(deleteDb);

  it('converts inputs→fields, rewrites entry values, and remaps the cycle value series', async () => {
    const v5 = new Dexie(DB_NAME);
    v5.version(5).stores(STORES);
    await v5.open();
    await v5.table('symptoms').add({
      id: 's1', name: 'Hitze', color: '#000', icon: '🔥', tagIds: [], parentId: null,
      sortIndex: 0, depth: 0, isFolder: false, archived: false, createdAt: 1, updatedAt: 1,
      daily: false, duotone: true, bg: true,
      inputs: {
        slider:  { enabled: true,  required: false, lowLabel: 'kurz', highLabel: 'lang' },
        number:  { enabled: true,  required: true,  unit: 'Schübe', integer: true },
        comment: { enabled: true,  required: false },
        select:  { enabled: false, required: false, options: [] }
      }
    });
    await v5.table('entries').add({
      id: '2026-06-01__s1', date: '2026-06-01', symptomId: 's1',
      sliderValue: 50, numberValue: 3, comment: 'warm', selectKey: null, updatedAt: 1
    });
    await v5.table('meta').add({ key: 'report.cycle.valueId', value: 's1' });
    v5.close();

    const v6 = new Dexie(DB_NAME);
    v6.version(5).stores(STORES);
    v6.version(6).stores(STORES).upgrade(upgradeV5toV6);
    await v6.open();

    const sym = await v6.table('symptoms').get('s1');
    expect(sym.inputs).toBeUndefined();
    expect(sym.fields.map((f: { type: string; label: string }) => `${f.type}:${f.label}`))
      .toEqual(['slider:Intensität', 'number:Schübe', 'text:Notiz']);
    const sliderId = sym.fields[0].id, numberId = sym.fields[1].id, textId = sym.fields[2].id;
    expect(sym.fields[1].required).toBe(true);

    const e = await v6.table('entries').get('2026-06-01__s1');
    expect(e.values).toEqual({ [sliderId]: 50, [numberId]: 3, [textId]: 'warm' });
    expect(e.sliderValue).toBeUndefined();

    const meta = await v6.table('meta').get('report.cycle.valueFieldId');
    expect(meta.value).toBe(sliderId);
    v6.close();
  });
});
```

- [ ] **Step 2: Run the test — verify it fails**

Run: `pnpm exec vitest run src/lib/db/migration.test.ts`
Expected: FAIL — `upgradeV5toV6` is not exported.

- [ ] **Step 3: Implement the migration in `src/lib/db/index.ts`**

Add the import at the top (after the existing imports):

```ts
import { newId } from '$lib/utils/uuid';
```

Add a `version(6)` line in the constructor right after the `version(5)...upgrade(upgradeV4toV5);` block:

```ts
    this.version(6).stores({
      symptoms: 'id, parentId, [parentId+sortIndex], archived',
      tags:     'id, name',
      entries:  'id, date, symptomId, [date+symptomId]',
      meta:     'key'
    }).upgrade(upgradeV5toV6);
```

Add the upgrade function after `upgradeV4toV5`:

```ts
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
```

Because `SymptomInputs` no longer exists as an exported type after Task 1, add a local legacy shape near the upgrade (used only here):

```ts
interface SymptomInputsLegacy {
  slider?:  { enabled: boolean; required: boolean; lowLabel: string; highLabel: string };
  number?:  { enabled: boolean; required: boolean; unit: string; integer: boolean };
  comment?: { enabled: boolean; required: boolean };
  select?:  { enabled: boolean; required: boolean; options: SelectOption[] };
}
```

- [ ] **Step 4: Run the test — verify it passes**

Run: `pnpm exec vitest run src/lib/db/migration.test.ts`
Expected: PASS. (The pre-existing v1→v2 test asserts `sym.inputs` equals `defaultSymptomInputs()`; since v1→v2 only runs up to v2 it still uses the in-place legacy default object literal — see note. If that test now fails to compile because `defaultSymptomInputs` is gone, update its import to drop `defaultSymptomInputs` and change its assertion to `expect(sym.inputs).toBeDefined()` — the v6 upgrade is what removes `inputs`, and that test only opens v2.)

> Note for the v1→v2 test: replace `import { defaultSymptomInputs, upgradeV1toV2, upgradeV4toV5 } from './index';` with `import { upgradeV1toV2, upgradeV4toV5, upgradeV5toV6 } from './index';` and change the `expect(sym.inputs).toEqual(defaultSymptomInputs());` line to assert the concrete legacy default object:
> ```ts
> expect(sym.inputs).toEqual({
>   slider:  { enabled: false, required: false, lowLabel: '', highLabel: '' },
>   number:  { enabled: false, required: false, unit: '', integer: true },
>   comment: { enabled: false, required: false },
>   select:  { enabled: false, required: false, options: [] }
> });
> ```
> But `upgradeV1toV2` calls `defaultSymptomInputs()` internally — which we removed. Fix `upgradeV1toV2` (line 138) to inline the legacy default literal instead of calling `defaultSymptomInputs()`:
> ```ts
>     if (!s.inputs) s.inputs = {
>       slider:  { enabled: false, required: false, lowLabel: '', highLabel: '' },
>       number:  { enabled: false, required: false, unit: '', integer: true },
>       comment: { enabled: false, required: false },
>       select:  { enabled: false, required: false, options: [] }
>     };
> ```
> This keeps every historical upgrade self-contained and independent of current types.

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/index.ts src/lib/db/migration.test.ts
git commit -m "feat(db): v6 migration converting inputs to fields and entry values"
```

---

### Task 4: Symptom CRUD on `fields`

**Files:**
- Modify: `src/lib/db/symptoms.ts`
- Test: `src/lib/db/symptoms.test.ts` (update references)

**Interfaces:**
- Consumes: `MetaField`, `defaultSymptomFields` (Task 1).
- Produces: `CreateSymptomInput { fields?: MetaField[] }`, `hasEnabledField(fields: MetaField[]): boolean`. Removes `hasEnabledInput`.

- [ ] **Step 1: Write/adjust the failing test** — in `src/lib/db/symptoms.test.ts` add:

```ts
import { newField } from './fields';
import { hasEnabledField, createSymptom, getSymptom } from './symptoms';

it('createSymptom defaults to empty fields', async () => {
  const s = await createSymptom({ name: 'X' });
  expect((await getSymptom(s.id))!.fields).toEqual([]);
});

it('hasEnabledField is false for empty/all-deleted, true otherwise', () => {
  expect(hasEnabledField([])).toBe(false);
  expect(hasEnabledField([{ ...newField('text'), deleted: true }])).toBe(false);
  expect(hasEnabledField([newField('slider')])).toBe(true);
});
```

Replace any existing test references to `inputs:`/`hasEnabledInput` with the above shape. (Read the file first; the daily-symptoms test seeds symptoms with `inputs` — change those to `fields: [newField('slider')]` and import `newField`.)

- [ ] **Step 2: Run the test — verify it fails**

Run: `pnpm exec vitest run src/lib/db/symptoms.test.ts`
Expected: FAIL — `hasEnabledField` undefined / `fields` not set.

- [ ] **Step 3: Edit `src/lib/db/symptoms.ts`**

Update the import (line 1):

```ts
import { db, type Symptom, type MetaField, defaultSymptomFields, entryKey } from './index';
```

In `CreateSymptomInput` (lines 5–16) replace `inputs?: SymptomInputs;` with `fields?: MetaField[];`.

In `createSymptom` (line 55) replace `inputs: input.inputs ?? defaultSymptomInputs(),` with `fields: input.fields ?? defaultSymptomFields(),`.

Replace `hasEnabledInput` (lines 205–207) with:

```ts
export function hasEnabledField(fields: MetaField[]): boolean {
  return fields.some((f) => !f.deleted);
}
```

In `listDailySymptomsForDate` (line 226) replace `hasEnabledInput(s.inputs)` with `hasEnabledField(s.fields)`.

- [ ] **Step 4: Run the test — verify it passes**

Run: `pnpm exec vitest run src/lib/db/symptoms.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/symptoms.ts src/lib/db/symptoms.test.ts
git commit -m "feat(db): symptom CRUD on fields, hasEnabledField"
```

---

### Task 5: Default template + importer emit `fields`

**Files:**
- Modify: `src/lib/templates/perimeno-default.ts`
- Modify: `src/lib/templates/import.ts`
- Test: `src/lib/templates/perimeno-default.test.ts`, `src/lib/templates/import.test.ts`

**Interfaces:**
- Consumes: `MetaField`, `newField` (Tasks 1).
- Produces: `TemplateSymptom { fields?: MetaField[] }`; `importTemplate` writes `fields`.

- [ ] **Step 1: Adjust the failing tests.** Read both test files. They assert symptoms get the right `inputs`. Change assertions to inspect `fields`. Example for `import.test.ts`:

```ts
import { newField } from '$lib/db/fields';
// after importing the default template:
const hitze = all.find((s) => s.name === 'Hitzewallungen')!;
expect(hitze.fields.map((f) => f.type)).toEqual(['slider', 'number', 'text']);
expect(hitze.fields.find((f) => f.type === 'number')!.label).toBe('Schübe');
```

For `perimeno-default.test.ts`, assert the builder helpers produce field arrays (see Step 3 shape).

- [ ] **Step 2: Run — verify fail**

Run: `pnpm exec vitest run src/lib/templates/perimeno-default.test.ts src/lib/templates/import.test.ts`
Expected: FAIL.

- [ ] **Step 3: Rewrite `src/lib/templates/perimeno-default.ts`**

Replace the top type import and the three builder helpers (lines 1–28) with field-array builders. Each builder returns `MetaField[]`; ids are minted via `newField` then overridden config is applied:

```ts
import type { MetaField } from '$lib/db';
import { newField } from '$lib/db/fields';

export interface TemplateTag { name: string; }
export interface TemplateSymptom {
  name: string;
  icon: string;
  color: string;
  tags?: string[];
  children?: TemplateSymptom[];
  fields?: MetaField[];
  daily?: boolean;
}
export interface Template {
  tags: TemplateTag[];
  roots: TemplateSymptom[];
}

// A symptom with a slider (labeled "Intensität") plus a free-text note.
const slider = (low: string, high: string, required = true): MetaField[] => {
  const s = newField('slider');
  if (s.type === 'slider') { s.lowLabel = low; s.highLabel = high; s.required = required; }
  return [s, newField('text')];
};
// A symptom with a number (unit becomes the label) plus a free-text note.
const number = (unit: string, integer = true): MetaField[] => {
  const n = newField('number');
  if (n.type === 'number') { n.unit = unit; n.integer = integer; n.required = true; n.label = unit; }
  return [n, newField('text')];
};
// An event symptom: just a free-text note.
const event = (): MetaField[] => [newField('text')];
```

Then in `DEFAULT_TEMPLATE`, replace every `inputs:` key with `fields:` and every spread combo accordingly. The combined slider+number case (Hitzewallungen, line 48) becomes:

```ts
{ name: 'Hitzewallungen', icon: '🔥', color: '#f59e0b', tags: ['körperlich', 'hormonell'], fields: (() => { const f = slider('kurz', 'lang'); const n = number('Schübe'); return [f[0], n[0], f[1]]; })() },
```

(That yields order slider, number, text — matching the migration's cascade order. All other entries: `inputs: slider(...)` → `fields: slider(...)`, `inputs: number(...)` → `fields: number(...)`, `inputs: event()` → `fields: event()`.)

- [ ] **Step 4: Rewrite `src/lib/templates/import.ts`**

Replace the whole file with:

```ts
import { db, defaultSymptomFields, type MetaField } from '$lib/db';
import { createTag } from '$lib/db/tags';
import { createSymptom } from '$lib/db/symptoms';
import type { Template, TemplateSymptom } from './perimeno-default';

function fieldsFor(s: TemplateSymptom): MetaField[] {
  return s.fields ?? defaultSymptomFields();
}

export async function importTemplate(t: Template): Promise<void> {
  await db.transaction('rw', db.tags, db.symptoms, async () => {
    const tagIdByName = new Map<string, string>();
    for (const tg of t.tags) {
      const created = await createTag(tg.name);
      tagIdByName.set(tg.name, created.id);
    }
    async function recur(s: TemplateSymptom, parentId: string | null) {
      const isFolder = !!s.children && s.children.length > 0;
      const created = await createSymptom({
        name: s.name,
        icon: s.icon,
        color: s.color,
        isFolder,
        parentId,
        tagIds: (s.tags ?? []).map((n) => tagIdByName.get(n)).filter((x): x is string => !!x),
        fields: isFolder ? undefined : fieldsFor(s),
        daily: isFolder ? false : (s.daily ?? false)
      });
      if (s.children) for (const c of s.children) await recur(c, created.id);
    }
    for (const r of t.roots) await recur(r, null);
  });
}
```

- [ ] **Step 5: Run — verify pass**

Run: `pnpm exec vitest run src/lib/templates/perimeno-default.test.ts src/lib/templates/import.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/templates/perimeno-default.ts src/lib/templates/import.ts src/lib/templates/perimeno-default.test.ts src/lib/templates/import.test.ts
git commit -m "feat(templates): emit fields instead of inputs"
```

---

### Task 6: Field-scoped heatmap intensity

**Files:**
- Modify: `src/lib/report/heatmap.ts`
- Test: `src/lib/report/heatmap.test.ts`

**Interfaces:**
- Consumes: `MetaField`, `NumberField`, `SelectField`, `Entry` (Task 1).
- Produces: the field-scoped signatures in *Shared Interfaces*.

- [ ] **Step 1: Rewrite the failing tests** in `src/lib/report/heatmap.test.ts`. Read it, then convert symptom-based calls to field-based. Core cases:

```ts
import { newField } from '$lib/db/fields';
import { classifyCell, valueDomain } from './heatmap';
import type { Entry, NumberField } from '$lib/db';

const E = (values: Record<string, number | string | null>): Entry =>
  ({ id: 'x', date: 'd', symptomId: 's', values, updatedAt: 0 });

it('slider field → normalized 1..100', () => {
  const f = newField('slider');
  expect(classifyCell(f, E({ [f.id]: 100 }), null)).toEqual({ kind: 'value', intensity: 1 });
  expect(classifyCell(f, E({ [f.id]: null }), null)).toEqual({ kind: 'unspez', intensity: 0 });
});

it('number field → normalized over domain', () => {
  const f = newField('number') as NumberField;
  const entries = [E({ [f.id]: 0 }), E({ [f.id]: 10 })];
  const dom = valueDomain(entries, f);
  expect(classifyCell(f, E({ [f.id]: 5 }), dom)).toEqual({ kind: 'value', intensity: 0.5 });
});

it('select field uses option value, else recorded', () => {
  const f = newField('select');
  if (f.type === 'select') f.options = [{ key: 'k', label: 'a', value: 80 }, { key: 'n', label: 'b', value: null }];
  const dom = valueDomain([E({ [f.id]: 'k' })], f);
  expect(classifyCell(f, E({ [f.id]: 'k' }), dom).kind).toBe('value');
  expect(classifyCell(f, E({ [f.id]: 'n' }), null)).toEqual({ kind: 'recorded', intensity: 1 });
});
```

- [ ] **Step 2: Run — verify fail**

Run: `pnpm exec vitest run src/lib/report/heatmap.test.ts`
Expected: FAIL.

- [ ] **Step 3: Rewrite the value functions in `src/lib/report/heatmap.ts`**

Update the import (line 1) to include the field types:

```ts
import type { Entry, MetaField, NumberField, SelectField } from '$lib/db';
```

Replace `valueNumberDomain` / `selectEntryValue` / `selectValueDomain` / `valueDomain` / `classifyCell` (lines 22–86) with:

```ts
export function valueNumberDomain(entries: Entry[], field: NumberField): NumberDomain | null {
  const nums = entries
    .map((e) => e.values?.[field.id])
    .filter((v): v is number => typeof v === 'number' && !Number.isNaN(v));
  if (nums.length === 0) return null;
  return { min: Math.min(...nums), max: Math.max(...nums) };
}

export function selectEntryValue(field: SelectField, entry: Entry): number | null {
  const key = entry.values?.[field.id];
  if (typeof key !== 'string') return null;
  const opt = field.options.find((o) => o.key === key);
  if (!opt || opt.value === null || opt.value === undefined || Number.isNaN(opt.value)) return null;
  return opt.value;
}

export function selectValueDomain(entries: Entry[], field: SelectField): NumberDomain | null {
  const nums = entries
    .map((e) => selectEntryValue(field, e))
    .filter((v): v is number => v !== null);
  if (nums.length === 0) return null;
  return { min: Math.min(...nums), max: Math.max(...nums) };
}

/** Normalization domain for the selected value field (number or select). */
export function valueDomain(entries: Entry[], field: MetaField): NumberDomain | null {
  if (field.type === 'number') return valueNumberDomain(entries, field);
  if (field.type === 'select') return selectValueDomain(entries, field);
  return null;
}

export function classifyCell(field: MetaField, entry: Entry | undefined, domain: NumberDomain | null): Cell {
  if (!entry) return NONE;
  const v = entry.values?.[field.id];
  if (field.type === 'slider') {
    if (v === null || v === undefined) return { kind: 'unspez', intensity: 0 };
    const t = (Math.max(1, Math.min(100, v as number)) - 1) / 99;
    return { kind: 'value', intensity: t };
  }
  if (field.type === 'number') {
    if (v === null || v === undefined || (typeof v === 'number' && Number.isNaN(v))) return NONE;
    if (!domain || domain.max === domain.min) return { kind: 'value', intensity: 1 };
    const t = ((v as number) - domain.min) / (domain.max - domain.min);
    return { kind: 'value', intensity: Math.max(0, Math.min(1, t)) };
  }
  if (field.type === 'select') {
    if (v === null || v === undefined) return { kind: 'unspez', intensity: 0 };
    const sv = selectEntryValue(field, entry);
    if (sv === null) return { kind: 'recorded', intensity: 1 };
    if (!domain || domain.max === domain.min) return { kind: 'value', intensity: 1 };
    const t = (sv - domain.min) / (domain.max - domain.min);
    return { kind: 'value', intensity: Math.max(0, Math.min(1, t)) };
  }
  return { kind: 'recorded', intensity: 1 }; // text — presence only
}
```

Also update `buildHeatmap` (lines 91–106): rename its `valueSymptom: Symptom` param to `field: MetaField` and pass `field` to `classifyCell`. Update the import to drop `Symptom` if now unused.

- [ ] **Step 4: Run — verify pass**

Run: `pnpm exec vitest run src/lib/report/heatmap.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/report/heatmap.ts src/lib/report/heatmap.test.ts
git commit -m "feat(report): field-scoped heatmap intensity and domain"
```

---

### Task 7: openDialog payload shapes + day-page restore

**Files:**
- Modify: `src/lib/stores/openDialog.svelte.ts`
- Modify: `src/routes/day/[date]/+page.svelte`
- Test: `src/lib/stores/openDialog.test.svelte.ts` (adjust shape references)

**Interfaces:**
- Consumes: `MetaField`, `EntryValues` (Tasks 1–2).
- Produces: `entry-editor` payload `{ date; symptomId; values: Record<string, number|string|null> }`; `symptom-edit` payload `{ ...; fields: MetaField[]; ... }`.

- [ ] **Step 1: Adjust the failing test.** Read `src/lib/stores/openDialog.test.svelte.ts`; wherever it builds an `entry-editor` payload with `sliderValue`/etc., replace with `values: {}`. Wherever a `symptom-edit` payload has `inputs`, replace with `fields: []`.

- [ ] **Step 2: Run — verify fail**

Run: `pnpm exec vitest run src/lib/stores/openDialog.test.svelte.ts`
Expected: FAIL (type/shape mismatch in assertions).

- [ ] **Step 3: Edit `src/lib/stores/openDialog.svelte.ts`**

Update the import (line 1):

```ts
import { db, type MetaField } from '$lib/db';
```

In the `entry-editor` payload (lines 8–14) replace the four value fields with:

```ts
        date: string;
        symptomId: string;
        values: Record<string, number | string | null>;
```

In the `symptom-edit` payload (line 28) replace `inputs: SymptomInputs;` with `fields: MetaField[];`.

- [ ] **Step 4: Edit `src/routes/day/[date]/+page.svelte`**

Replace the `restoreInitial` state type (lines 23–26) with:

```ts
  let restoreInitial = $state<
    | { values: Record<string, number | string | null>; workingDate: string }
    | null
  >(null);
```

Replace the restore assignment (lines 65–71) with:

```ts
    editing = { symptom: sym };
    restoreInitial = {
      values: r.payload.values,
      workingDate: r.payload.date
    };
```

Replace the `initial=` prop (lines 105–107) with:

```ts
      initial={restoreInitial ? { values: restoreInitial.values } : undefined}
```

- [ ] **Step 5: Run — verify pass**

Run: `pnpm exec vitest run src/lib/stores/openDialog.test.svelte.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/stores/openDialog.svelte.ts src/routes/day/'[date]'/+page.svelte src/lib/stores/openDialog.test.svelte.ts
git commit -m "feat(store): values-based entry-editor restore, fields-based symptom-edit restore"
```

---

### Task 8: `FieldListEditor` — reorderable field-list editor

**Files:**
- Create: `src/lib/components/SymptomAdmin/FieldListEditor.svelte`
- Delete: `src/lib/components/SymptomAdmin/InputConfigSection.svelte`
- Rename test: `src/lib/components/SymptomAdmin/InputConfigSection.test.ts` → `FieldListEditor.test.ts`

**Interfaces:**
- Consumes: `MetaField`, `SelectOption`, `newField` (Tasks 1), `newId`.
- Produces: component props `{ fields: MetaField[]; daily: boolean; onFieldsChange: (next: MetaField[]) => void; onDailyChange: (next: boolean) => void }`.

- [ ] **Step 1: Write the failing test** — create `src/lib/components/SymptomAdmin/FieldListEditor.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import FieldListEditor from './FieldListEditor.svelte';
import { newField } from '$lib/db/fields';
import type { MetaField } from '$lib/db';

describe('FieldListEditor', () => {
  it('adds a field of a chosen type', async () => {
    let fields: MetaField[] = [];
    const onFieldsChange = vi.fn((n: MetaField[]) => (fields = n));
    const { getByRole } = render(FieldListEditor, {
      props: { fields, daily: false, onFieldsChange, onDailyChange: vi.fn() }
    });
    await fireEvent.click(getByRole('button', { name: 'Zahl hinzufügen' }));
    expect(onFieldsChange).toHaveBeenCalled();
    expect(fields[0].type).toBe('number');
    expect(fields[0].label).toBe('Wert');
  });

  it('edits a field label without changing its id', async () => {
    const f = newField('number');
    let fields = [f];
    const onFieldsChange = vi.fn((n: MetaField[]) => (fields = n));
    const { getByLabelText } = render(FieldListEditor, {
      props: { fields, daily: false, onFieldsChange, onDailyChange: vi.fn() }
    });
    await fireEvent.input(getByLabelText('Bezeichnung'), { target: { value: 'Systolisch' } });
    expect(fields[0].id).toBe(f.id);
    expect(fields[0].label).toBe('Systolisch');
  });

  it('soft-deletes a field', async () => {
    const f = newField('text');
    let fields = [f];
    const onFieldsChange = vi.fn((n: MetaField[]) => (fields = n));
    const { getByRole } = render(FieldListEditor, {
      props: { fields, daily: false, onFieldsChange, onDailyChange: vi.fn() }
    });
    await fireEvent.click(getByRole('button', { name: 'Feld löschen' }));
    expect(fields[0].deleted).toBe(true);
  });
});
```

- [ ] **Step 2: Run — verify fail**

Run: `pnpm exec vitest run src/lib/components/SymptomAdmin/FieldListEditor.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `src/lib/components/SymptomAdmin/FieldListEditor.svelte`**

```svelte
<script lang="ts">
  import type { MetaField, SelectOption, FieldType } from '$lib/db';
  import { newField } from '$lib/db/fields';
  import { newId } from '$lib/utils/uuid';
  import { GripVertical, Trash2, RotateCcw, Plus } from '@lucide/svelte';

  type Props = {
    fields: MetaField[];
    daily: boolean;
    onFieldsChange: (next: MetaField[]) => void;
    onDailyChange: (next: boolean) => void;
  };
  let { fields, daily, onFieldsChange, onDailyChange }: Props = $props();

  const TYPE_LABELS: Record<FieldType, string> = {
    slider: 'Slider', number: 'Zahl', select: 'Auswahl', text: 'Notiz'
  };
  const ADD_ORDER: FieldType[] = ['slider', 'number', 'select', 'text'];

  const hasEnabled = $derived(fields.some((f) => !f.deleted));
  let addOpen = $state(false);

  function patch(id: string, p: Partial<MetaField>) {
    onFieldsChange(fields.map((f) => (f.id === id ? ({ ...f, ...p } as MetaField) : f)));
  }
  function add(type: FieldType) {
    onFieldsChange([...fields, newField(type)]);
    addOpen = false;
  }
  function removeField(id: string) { patch(id, { deleted: true }); }
  function restoreField(id: string) { patch(id, { deleted: false }); }

  // ── select-option sub-editor (per select field) ───────────────────────────
  function setOptions(id: string, options: SelectOption[]) { patch(id, { options } as Partial<MetaField>); }
  function addOption(f: MetaField) {
    if (f.type !== 'select') return;
    setOptions(f.id, [...f.options, { key: newId(), label: '', value: null }]);
  }
  function updateOption(f: MetaField, key: string, p: Partial<SelectOption>) {
    if (f.type !== 'select') return;
    setOptions(f.id, f.options.map((o) => (o.key === key ? { ...o, ...p } : o)));
  }
  function setOptionValue(f: MetaField, key: string, raw: string) {
    const t = raw.trim();
    if (t === '') { updateOption(f, key, { value: null }); return; }
    const n = parseFloat(t.replace(',', '.'));
    updateOption(f, key, { value: Number.isFinite(n) ? n : null });
  }

  // ── drag-to-reorder (lift + dashed placeholder, like the status bar) ───────
  const rowRefs = new Map<string, HTMLElement>();
  function trackRow(node: HTMLElement, id: string) {
    rowRefs.set(id, node);
    return { destroy() { rowRefs.delete(id); } };
  }
  let listEl = $state<HTMLElement | null>(null);
  type DragState = { id: string; rowHeight: number; grabOffsetY: number; currentY: number };
  let dragState = $state<DragState | null>(null);
  let activePointerId: number | null = null;

  function startDrag(e: PointerEvent, id: string) {
    e.preventDefault();
    const li = rowRefs.get(id);
    if (!li) return;
    const rect = li.getBoundingClientRect();
    dragState = { id, rowHeight: rect.height, grabOffsetY: e.clientY - rect.top, currentY: e.clientY };
    activePointerId = e.pointerId;
    window.addEventListener('pointermove', onDragMove, { passive: false });
    window.addEventListener('pointerup', onDragEnd);
    window.addEventListener('pointercancel', onDragEnd);
  }
  function onDragMove(e: PointerEvent) {
    if (!dragState || e.pointerId !== activePointerId) return;
    e.preventDefault();
    dragState.currentY = e.clientY;
    const y = e.clientY;
    let idx = 0;
    for (const f of fields) {
      if (f.id === dragState.id) continue;
      const el = rowRefs.get(f.id);
      if (!el) { idx++; continue; }
      const r = el.getBoundingClientRect();
      if (y < r.top + r.height / 2) break;
      idx++;
    }
    reorderTo(dragState.id, idx);
  }
  function onDragEnd(e: PointerEvent) {
    if (e.pointerId !== activePointerId) return;
    window.removeEventListener('pointermove', onDragMove);
    window.removeEventListener('pointerup', onDragEnd);
    window.removeEventListener('pointercancel', onDragEnd);
    activePointerId = null;
    dragState = null;
  }
  function reorderTo(id: string, insertIdx: number) {
    const cur = fields.findIndex((f) => f.id === id);
    if (cur === -1) return;
    const without = fields.filter((f) => f.id !== id);
    const clamped = Math.max(0, Math.min(insertIdx, without.length));
    const next = [...without.slice(0, clamped), fields[cur], ...without.slice(clamped)];
    if (next.some((f, i) => f.id !== fields[i].id)) onFieldsChange(next);
  }
  function dragTransform(id: string): string {
    const ds = dragState;
    if (!ds || ds.id !== id || !listEl) return '';
    const idx = fields.findIndex((f) => f.id === id);
    if (idx < 0) return '';
    const listTop = listEl.getBoundingClientRect().top;
    const naturalTop = listTop + idx * ds.rowHeight;
    const wantedTop = ds.currentY - ds.grabOffsetY;
    return `translateY(${wantedTop - naturalTop}px)`;
  }
  function draggedIndex(): number {
    return dragState ? fields.findIndex((f) => f.id === dragState!.id) : -1;
  }
</script>

<section class="config">
  <div class="caption">Felder</div>

  <ul class="fields" bind:this={listEl}>
    {#each fields as f (f.id)}
      <li class="card" class:dragging={dragState?.id === f.id} class:deleted={f.deleted} use:trackRow={f.id} style:transform={dragTransform(f.id)}>
        <header>
          <span class="type">{TYPE_LABELS[f.type]}</span>
          {#if f.deleted}
            <span class="del-label">{f.label || '(ohne Name)'} (gelöscht)</span>
            <button type="button" class="icon-action" aria-label="Feld wiederherstellen" title="Wiederherstellen" onclick={() => restoreField(f.id)}><RotateCcw size={16} /></button>
          {:else}
            <input type="text" class="label" aria-label="Bezeichnung" placeholder="z.B. Systolisch" value={f.label} oninput={(e) => patch(f.id, { label: (e.currentTarget as HTMLInputElement).value })} />
            <label class="req"><input type="checkbox" checked={f.required} onchange={(e) => patch(f.id, { required: (e.currentTarget as HTMLInputElement).checked })} /> Pflicht</label>
            <button type="button" class="icon-action" aria-label="Feld löschen" title="Löschen" onclick={() => removeField(f.id)}><Trash2 size={16} /></button>
            <button type="button" class="handle" aria-label="Verschieben" onpointerdown={(e) => startDrag(e, f.id)}><GripVertical size={18} /></button>
          {/if}
        </header>

        {#if !f.deleted && f.type === 'slider'}
          <div class="body">
            <label class="field"><span>Linker Endpunkt</span>
              <input type="text" value={f.lowLabel} placeholder="z.B. kaum spürbar" oninput={(e) => patch(f.id, { lowLabel: (e.currentTarget as HTMLInputElement).value } as Partial<MetaField>)} /></label>
            <label class="field"><span>Rechter Endpunkt</span>
              <input type="text" value={f.highLabel} placeholder="z.B. unerträglich" oninput={(e) => patch(f.id, { highLabel: (e.currentTarget as HTMLInputElement).value } as Partial<MetaField>)} /></label>
          </div>
        {:else if !f.deleted && f.type === 'number'}
          <div class="body">
            <label class="field"><span>Einheit</span>
              <input type="text" value={f.unit} placeholder="z.B. Tassen" oninput={(e) => patch(f.id, { unit: (e.currentTarget as HTMLInputElement).value } as Partial<MetaField>)} /></label>
            <label class="field row"><input type="checkbox" checked={f.integer} onchange={(e) => patch(f.id, { integer: (e.currentTarget as HTMLInputElement).checked } as Partial<MetaField>)} /><span>Nur ganze Zahlen</span></label>
          </div>
        {:else if !f.deleted && f.type === 'select'}
          <div class="body">
            <p class="hint">Optionen mit optionalem Zahlenwert (fließt in die Heatmap ein).</p>
            <ul class="options">
              {#each f.options as o (o.key)}
                <li class="option" class:deleted={o.deleted}>
                  {#if o.deleted}
                    <span class="opt-label-deleted">{o.label || '(ohne Name)'}</span>
                    <button type="button" class="icon-action" aria-label="Option wiederherstellen" title="Wiederherstellen" onclick={() => updateOption(f, o.key, { deleted: false })}><RotateCcw size={16} /></button>
                  {:else}
                    <input type="text" class="opt-label" aria-label="Option" placeholder="z.B. leicht" value={o.label} oninput={(e) => updateOption(f, o.key, { label: (e.currentTarget as HTMLInputElement).value })} />
                    <input type="number" class="opt-value" aria-label="Wert" inputmode="decimal" step="any" placeholder="Wert" value={o.value ?? ''} oninput={(e) => setOptionValue(f, o.key, (e.currentTarget as HTMLInputElement).value)} />
                    <button type="button" class="icon-action" aria-label="Option löschen" title="Löschen" onclick={() => updateOption(f, o.key, { deleted: true })}><Trash2 size={16} /></button>
                  {/if}
                </li>
              {/each}
              {#if f.options.length === 0}<li class="opt-empty">Noch keine Optionen.</li>{/if}
            </ul>
            <button type="button" class="add-opt" onclick={() => addOption(f)}><Plus size={16} /> Option hinzufügen</button>
          </div>
        {/if}
      </li>
    {/each}
    {#if dragState}
      <li class="drop-placeholder" aria-hidden="true" style:top="{draggedIndex() * dragState.rowHeight}px" style:height="{dragState.rowHeight}px"></li>
    {/if}
  </ul>

  <div class="add-wrap">
    <button type="button" class="add" onclick={() => (addOpen = !addOpen)}><Plus size={18} /> Feld hinzufügen</button>
    {#if addOpen}
      <div class="add-menu" role="menu">
        {#each ADD_ORDER as t}
          <button type="button" role="menuitem" aria-label="{TYPE_LABELS[t]} hinzufügen" onclick={() => add(t)}>{TYPE_LABELS[t]}</button>
        {/each}
      </div>
    {/if}
  </div>

  {#if hasEnabled}
    <label class="daily">
      <input type="checkbox" checked={daily} onchange={(e) => onDailyChange((e.currentTarget as HTMLInputElement).checked)} />
      <span>Täglich erfassen</span>
    </label>
    <p class="hint">Erscheint jeden Tag als graue Erinnerungs-Karte oben in der Liste, bis ein Eintrag erfasst ist.</p>
  {/if}
</section>

<style>
  .config { display: flex; flex-direction: column; gap: var(--sp-3); margin-bottom: var(--sp-4); }
  .caption { font-size: var(--fs-xs); color: var(--c-text-dim); text-transform: uppercase; letter-spacing: 0.05em; }
  .fields { list-style: none; margin: 0; padding: 0; position: relative; display: flex; flex-direction: column; gap: var(--sp-2); }
  .card { border: 1px solid var(--c-border); border-radius: var(--r-2); padding: var(--sp-2) var(--sp-3); background: var(--c-surface); will-change: transform; }
  .card.dragging { z-index: 10; box-shadow: var(--shadow-2); }
  .card.deleted header .del-label { flex: 1; color: var(--c-text-dim); text-decoration: line-through; font-size: var(--fs-sm); }
  .card header { display: flex; align-items: center; gap: var(--sp-2); }
  .type { font-size: var(--fs-xs); color: var(--c-text-dim); flex-shrink: 0; min-width: 3.5em; }
  .label { flex: 1; min-width: 0; padding: var(--sp-2) var(--sp-3); border: 1px solid var(--c-border); border-radius: var(--r-2); }
  .req { font-size: var(--fs-sm); display: inline-flex; align-items: center; gap: 4px; flex-shrink: 0; }
  .body { display: flex; flex-direction: column; gap: var(--sp-2); margin-top: var(--sp-2); }
  .field { display: flex; flex-direction: column; gap: 4px; font-size: var(--fs-sm); }
  .field > span { color: var(--c-text-dim); }
  .field input[type="text"] { padding: var(--sp-2) var(--sp-3); border: 1px solid var(--c-border); border-radius: var(--r-2); }
  .field.row { flex-direction: row; align-items: center; gap: var(--sp-2); }
  .handle { border: 0; background: none; color: var(--c-text-dim); cursor: grab; padding: var(--sp-1); display: flex; align-items: center; flex-shrink: 0; touch-action: none; }
  .handle:active { cursor: grabbing; }
  .icon-action { display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; flex-shrink: 0; border: 0; background: none; color: var(--c-text-dim); cursor: pointer; }
  .icon-action:hover { color: var(--c-text); }
  .options { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--sp-2); }
  .option { display: flex; align-items: center; gap: var(--sp-2); }
  .option input[type="text"], .option input[type="number"] { padding: var(--sp-2) var(--sp-3); border: 1px solid var(--c-border); border-radius: var(--r-2); font-size: var(--fs-sm); }
  .opt-label { flex: 1; min-width: 0; }
  .opt-value { width: 5em; text-align: right; }
  .opt-label-deleted { flex: 1; min-width: 0; color: var(--c-text-dim); text-decoration: line-through; font-size: var(--fs-sm); }
  .opt-empty { font-size: var(--fs-xs); color: var(--c-text-dim); }
  .hint { font-size: var(--fs-xs); color: var(--c-text-dim); margin: 0; }
  .add-wrap { position: relative; }
  .add { display: inline-flex; align-items: center; gap: var(--sp-2); width: 100%; justify-content: center; border: 1px dashed var(--c-border-strong); background: none; color: var(--c-text); border-radius: var(--r-2); padding: var(--sp-3); cursor: pointer; font-size: var(--fs-sm); font-weight: var(--fw-medium); }
  .add-menu { display: flex; flex-wrap: wrap; gap: var(--sp-2); margin-top: var(--sp-2); }
  .add-menu button { flex: 1; padding: var(--sp-2) var(--sp-3); border: 1px solid var(--c-border); border-radius: var(--r-2); background: var(--c-surface); cursor: pointer; font-size: var(--fs-sm); }
  .add-opt { display: inline-flex; align-items: center; gap: 4px; align-self: flex-start; padding: var(--sp-2) var(--sp-3); border: 1px solid var(--c-border); border-radius: var(--r-2); background: var(--c-surface); color: var(--c-text); cursor: pointer; font-size: var(--fs-sm); }
  .daily { display: inline-flex; align-items: center; gap: var(--sp-2); margin-top: var(--sp-2); }
  .drop-placeholder { position: absolute; left: 0; right: 0; box-sizing: border-box; border: 1px dashed var(--c-accent, var(--c-text-dim)); border-radius: var(--r-2); background: color-mix(in srgb, var(--c-accent, var(--c-text-dim)) 10%, transparent); pointer-events: none; z-index: 1; }
</style>
```

- [ ] **Step 4: Delete the old component**

```bash
git rm src/lib/components/SymptomAdmin/InputConfigSection.svelte
git rm src/lib/components/SymptomAdmin/InputConfigSection.test.ts
```

(The new `FieldListEditor.test.ts` from Step 1 replaces it.)

- [ ] **Step 5: Run — verify pass**

Run: `pnpm exec vitest run src/lib/components/SymptomAdmin/FieldListEditor.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/components/SymptomAdmin/FieldListEditor.svelte src/lib/components/SymptomAdmin/FieldListEditor.test.ts
git commit -m "feat(admin): reorderable FieldListEditor replacing InputConfigSection"
```

---

### Task 9: Wire `SymptomEditModal` to `fields`

**Files:**
- Modify: `src/lib/components/SymptomAdmin/SymptomEditModal.svelte`
- Test: `src/lib/components/SymptomAdmin/SymptomEditModal.test.ts` (adjust)

**Interfaces:**
- Consumes: `FieldListEditor` (Task 8), `defaultSymptomFields`, `MetaField`, `createSymptom`/`updateSymptom` with `fields` (Task 4).

- [ ] **Step 1: Adjust the failing test.** Read `SymptomEditModal.test.ts`; replace `inputs` references with `fields` and any `InputConfigSection` query with the new editor. If the test seeds `symptom.inputs`, change to `symptom.fields`.

- [ ] **Step 2: Run — verify fail**

Run: `pnpm exec vitest run src/lib/components/SymptomAdmin/SymptomEditModal.test.ts`
Expected: FAIL.

- [ ] **Step 3: Edit `src/lib/components/SymptomAdmin/SymptomEditModal.svelte`**

- Import (line 6): `import InputConfigSection from './InputConfigSection.svelte';` → `import FieldListEditor from './FieldListEditor.svelte';`
- Import (line 17): replace `defaultSymptomInputs, type SymptomInputs` with `defaultSymptomFields, type MetaField`.
- State (line 34): `let inputs = $state<SymptomInputs>(untrack(() => symptom.inputs ?? defaultSymptomInputs()));` → `let fields = $state<MetaField[]>(untrack(() => symptom.fields ?? defaultSymptomFields()));`
- Reset effect (line 46): `inputs = symptom.inputs ?? defaultSymptomInputs();` → `fields = symptom.fields ?? defaultSymptomFields();`
- persistDialog payload (line 65) and updateDialogPayload (line 81): `inputs: $state.snapshot(inputs),` → `fields: $state.snapshot(fields),`
- `save()` (line 100): `const snapInputs = $state.snapshot(inputs) as SymptomInputs;` → `const snapFields = $state.snapshot(fields) as MetaField[];`
- createSymptom call (line 109): `inputs: snapInputs,` → `fields: snapFields,`
- updateSymptom call (line 115): `inputs: snapInputs,` → `fields: snapFields,`
- Component usage (lines 185–190):

```svelte
      <FieldListEditor
        {fields}
        {daily}
        onFieldsChange={(n) => (fields = n)}
        onDailyChange={(n) => (daily = n)}
      />
```

- [ ] **Step 4: Run — verify pass**

Run: `pnpm exec vitest run src/lib/components/SymptomAdmin/SymptomEditModal.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/SymptomAdmin/SymptomEditModal.svelte src/lib/components/SymptomAdmin/SymptomEditModal.test.ts
git commit -m "feat(admin): SymptomEditModal edits fields"
```

---

### Task 10: `EntryEditor` renders fields and binds `values`

**Files:**
- Modify: `src/lib/components/EntryEditor/EntryEditor.svelte`
- Test: `src/lib/components/EntryEditor/EntryEditor.test.ts` (adjust)

**Interfaces:**
- Consumes: `MetaField` (Task 1), `validateEntry`/`upsertEntry`/`getEntry` (Task 2), input sub-components (unchanged).

- [ ] **Step 1: Adjust the failing test.** Read `EntryEditor.test.ts`; symptoms seeded with `inputs` → `fields: [newField('slider'), ...]`. Assertions reading `e.sliderValue` → `e.values[fieldId]`. Restore-`initial` props → `{ values: {...} }`.

- [ ] **Step 2: Run — verify fail**

Run: `pnpm exec vitest run src/lib/components/EntryEditor/EntryEditor.test.ts`
Expected: FAIL.

- [ ] **Step 3: Rewrite `src/lib/components/EntryEditor/EntryEditor.svelte`**

Script changes:
- Props `initial` type (line 24): `initial?: { values: Record<string, number | string | null> };`
- Replace the four value states (lines 30–33) with:

```ts
  let values = $state<Record<string, number | string | null>>(untrack(() => ({ ...(initial?.values ?? {}) })));
```

- Load effect (lines 37–55): replace body with:

```ts
  $effect(() => {
    if (!open) return;
    workingDate = date;
    if (initial) return;
    (async () => {
      const e = await getEntry(date, symptom.id);
      values = e ? { ...e.values } : {};
    })();
  });
```

- persist snapshot (lines 71–84): replace the snapshot payload's value fields with `values: $state.snapshot(values)`:

```ts
    const snapshot = untrack(() => ({
      date: workingDate,
      symptomId: symptom.id,
      values: $state.snapshot(values)
    }));
```

- updateDialogPayload effect (line 88): `void updateDialogPayload({ date: workingDate, values: $state.snapshot(values) });`
- validation (line 91): `const validation = $derived(validateEntry(symptom, values));`
- `onSave` (lines 95–99): `await upsertEntry({ date: workingDate, symptomId: symptom.id, values: $state.snapshot(values) });`
- `onDelete` undo (lines 117–124): `await upsertEntry({ date: existing.date, symptomId: existing.symptomId, values: existing.values });`
- `onConfigClose` payload (lines 154–159): replace value fields with `values: $state.snapshot(values)`.

Helper to set one field value (add to script):

```ts
  function setValue(id: string, v: number | string | null) {
    values = { ...values, [id]: v };
  }
```

Template — replace the four conditional sections (lines 184–237) with a single loop over non-deleted fields:

```svelte
  {#each symptom.fields.filter((f) => !f.deleted) as field (field.id)}
    <section>
      <div class="caption">
        {field.label || symptom.name}
        {#if field.required}<span class="req">*</span>{/if}
      </div>
      {#if field.type === 'slider'}
        <SliderInput
          value={(values[field.id] ?? null) as number | null}
          lowLabel={field.lowLabel}
          highLabel={field.highLabel}
          step={settings.sliderStep}
          onChange={(v) => setValue(field.id, v)}
        />
      {:else if field.type === 'number'}
        <NumberInput
          value={(values[field.id] ?? null) as number | null}
          unit={field.unit}
          integer={field.integer}
          onChange={(v) => setValue(field.id, v)}
        />
      {:else if field.type === 'select'}
        <SelectInput
          value={(values[field.id] ?? null) as string | null}
          options={field.options}
          onChange={(k) => setValue(field.id, k)}
        />
      {:else}
        <textarea class="comment" rows={3} placeholder="z.B. Auslöser, Umstände…"
          value={(values[field.id] ?? '') as string}
          oninput={(e) => setValue(field.id, (e.currentTarget as HTMLTextAreaElement).value)}></textarea>
      {/if}
    </section>
  {/each}
```

(Note: for a slider field the stored value can legitimately be `null` meaning "unspecified"; passing `null` to `SliderInput` is correct. The `?? null` guards the `undefined` not-yet-logged case.)

- [ ] **Step 4: Run — verify pass**

Run: `pnpm exec vitest run src/lib/components/EntryEditor/EntryEditor.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/EntryEditor/EntryEditor.svelte src/lib/components/EntryEditor/EntryEditor.test.ts
git commit -m "feat(entry): render dynamic fields and persist values map"
```

---

### Task 11: Entry display components via `entryFieldDisplays`

**Files:**
- Modify: `src/lib/components/report/ReportEntryRow.svelte`
- Modify: `src/lib/components/DayView/EntryCard.svelte`
- Test: `src/lib/components/report/ReportEntryRow.test.ts` (adjust)

**Interfaces:**
- Consumes: `entryFieldDisplays` (Task 1).

- [ ] **Step 1: Adjust the failing test.** Read `ReportEntryRow.test.ts`; seed `fields` + `values`, assert rendered text per field. Example:

```ts
import { newField } from '$lib/db/fields';
// number field labeled with unit + a text field:
const nu = newField('number'); if (nu.type === 'number') nu.unit = 'Tassen';
const tx = newField('text');
// symptom.fields = [nu, tx]; entry.values = { [nu.id]: 2, [tx.id]: 'morgens' }
// expect the row to show '2 Tassen' and 'morgens'
```

- [ ] **Step 2: Run — verify fail**

Run: `pnpm exec vitest run src/lib/components/report/ReportEntryRow.test.ts`
Expected: FAIL.

- [ ] **Step 3: Rewrite `src/lib/components/report/ReportEntryRow.svelte`**

Replace the `<script>` derived block (lines 4–21) with:

```ts
  import Badge from '$lib/components/ui/Badge.svelte';
  import { base } from '$app/paths';
  import { entryFieldDisplays } from '$lib/db/fields';
  import type { Entry, Symptom } from '$lib/db';

  type Props = { entry: Entry; symptom: Symptom; tagNames: string[] };
  let { entry, symptom, tagNames }: Props = $props();

  const displays = $derived(entryFieldDisplays(symptom, entry));
```

Replace the `.meta` block (lines 28–34) with:

```svelte
    <div class="meta">
      {#each displays as d (d.field.id)}
        <span class:comment={d.field.type === 'text'}>{d.text}</span>
      {/each}
      {#if displays.length === 0}<span class="empty">erfasst</span>{/if}
    </div>
```

- [ ] **Step 4: Rewrite `src/lib/components/DayView/EntryCard.svelte`**

Replace the `<script>` derived block (lines 5–25) with:

```ts
  import Badge from '$lib/components/ui/Badge.svelte';
  import SwipeRow from '$lib/components/ui/SwipeRow.svelte';
  import { MessageCircle, Flame } from '@lucide/svelte';
  import { entryFieldDisplays } from '$lib/db/fields';
  import type { Symptom, Entry } from '$lib/db';

  type Props = { entry: Entry; symptom: Symptom; streak?: number; onTap: () => void; onSwipe: () => void };
  let { entry, symptom, streak = 1, onTap, onSwipe }: Props = $props();

  const displays = $derived(entryFieldDisplays(symptom, entry));
  const valueDisplays = $derived(displays.filter((d) => d.field.type !== 'text'));
  const hasComment = $derived(displays.some((d) => d.field.type === 'text'));
```

Replace the `.meta` block (lines 33–42) with:

```svelte
      <div class="meta">
        {#each valueDisplays as d (d.field.id)}<span>{d.text}</span>{/each}
        {#if hasComment}<MessageCircle size={14} />{/if}
        {#if valueDisplays.length === 0 && !hasComment}<span class="empty">erfasst</span>{/if}
        {#if streak >= 2}
          <span class="streak" title="{streak} Tage in Folge erfasst"><Flame size={13} />{streak}</span>
        {/if}
      </div>
```

- [ ] **Step 5: Run — verify pass**

Run: `pnpm exec vitest run src/lib/components/report/ReportEntryRow.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/components/report/ReportEntryRow.svelte src/lib/components/DayView/EntryCard.svelte src/lib/components/report/ReportEntryRow.test.ts
git commit -m "feat(display): render entry values from fields"
```

---

### Task 12: Cycle heatmap value-field picker

**Files:**
- Modify: `src/routes/report/cycle/+page.svelte`
- Test: `src/routes/report/cycle/cycle-page.test.ts` (adjust)

**Interfaces:**
- Consumes: field-scoped `classifyCell`/`valueDomain` (Task 6), `isValueField` (Task 1), meta keys `report.cycle.valueId` + `report.cycle.valueFieldId`.

- [ ] **Step 1: Adjust the failing test.** Read `cycle-page.test.ts`; seed symptoms with `fields` and entries with `values`. The Fokus picker now offers `Symptom [FieldLabel]`; assert an option labeled accordingly exists and that picking it renders colored cells. (Use the option's composite value `${symptomId}::${fieldId}`.)

- [ ] **Step 2: Run — verify fail**

Run: `pnpm exec vitest run src/routes/report/cycle/cycle-page.test.ts`
Expected: FAIL.

- [ ] **Step 3: Edit `src/routes/report/cycle/+page.svelte`**

Add import for `isValueField`:

```ts
  import { isValueField } from '$lib/db/fields';
  import type { MetaField } from '$lib/db';
```

Build the value-series option list (after the `symptoms` derived, ~line 25):

```ts
  interface ValueSeries { symptomId: string; field: MetaField; key: string; label: string }
  const valueSeries = $derived<ValueSeries[]>(
    symptoms.flatMap((s) => {
      const vfields = s.fields.filter((f) => !f.deleted && isValueField(f));
      return vfields.map((f) => ({
        symptomId: s.id,
        field: f,
        key: `${s.id}::${f.id}`,
        label: vfields.length === 1 ? s.name : `${s.name} [${f.label}]`
      }));
    })
  );
```

Replace the value-selection state + persistence (lines 27–45). Keep `anchorId` as-is. Replace `valueId` handling with a composite selection:

```ts
  let anchorId = $state<string | null>(null);
  let valueId = $state<string | null>(null);        // symptomId
  let valueFieldId = $state<string | null>(null);   // field id
  let loaded = $state(false);
  $effect(() => {
    if (loaded) return;
    loaded = true;
    void Promise.all([
      getMeta<string>('report.cycle.anchorId'),
      getMeta<string>('report.cycle.valueId'),
      getMeta<string>('report.cycle.valueFieldId')
    ]).then(([a, v, vf]) => { anchorId = a ?? null; valueId = v ?? null; valueFieldId = vf ?? null; });
  });
  const valueKey = $derived(valueId && valueFieldId ? `${valueId}::${valueFieldId}` : '');
  $effect(() => {
    if (symptoms.length === 0) return;
    if (!anchorId || !symptoms.some((s) => s.id === anchorId)) anchorId = symptoms[0].id;
    if (!valueSeries.some((vs) => vs.key === valueKey)) {
      const first = valueSeries[0];
      if (first) { valueId = first.symptomId; valueFieldId = first.field.id; }
    }
  });
  function onAnchor(e: Event) { anchorId = (e.target as HTMLSelectElement).value; void setMeta('report.cycle.anchorId', anchorId); }
  function onValue(e: Event) {
    const [sid, fid] = (e.target as HTMLSelectElement).value.split('::');
    valueId = sid; valueFieldId = fid;
    void setMeta('report.cycle.valueId', sid);
    void setMeta('report.cycle.valueFieldId', fid);
  }

  const anchorSym = $derived(symptoms.find((s) => s.id === anchorId) ?? null);
  const valueSym = $derived(symptoms.find((s) => s.id === valueId) ?? null);
  const valueField = $derived(valueSym?.fields.find((f) => f.id === valueFieldId) ?? null);
```

Update the value-entries query and domain (lines 58–66):

```ts
  const entriesByDate = $derived(new Map(valueEntriesQ.current.map((e) => [e.date, e])));
  const numberDomain = $derived(valueField ? valueDomain(valueEntriesQ.current, valueField) : null);
  const hasData = $derived(!!valueField && N > 0);
```

Update every `classifyCell(valueSym!, ...)` call (line 134) to `classifyCell(valueField!, ...)`.

Update the Fokus `<select>` markup (lines 246–250):

```svelte
    <label><span class="cap">Fokus</span>
      <select onchange={onValue} value={valueKey} aria-label="Fokus-Serie wählen">
        {#each valueSeries as vs (vs.key)}<option value={vs.key}>{vs.label}</option>{/each}
      </select>
    </label>
```

Update the legend's color references (lines 295–296) that use `valueSym?.color` — keep `valueSym?.color` (color still comes from the symptom; a field has no color). No change needed there beyond confirming `valueSym` still resolves.

- [ ] **Step 4: Run — verify pass**

Run: `pnpm exec vitest run src/routes/report/cycle/cycle-page.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/routes/report/cycle/+page.svelte src/routes/report/cycle/cycle-page.test.ts
git commit -m "feat(cycle): pick a value field as the heatmap series"
```

---

### Task 13: PDF export per field

**Files:**
- Modify: `src/lib/report/pdf.ts`
- Test: `src/lib/report/pdf.test.ts` (adjust)

**Interfaces:**
- Consumes: `entryFieldDisplays` (Task 1).

- [ ] **Step 1: Adjust the failing test.** Read `pdf.test.ts`; seed `fields` + `values`. The table model changes from fixed `[Symptom, Intensität, Anzahl, Kommentar, Tags]` to `[Symptom, Werte, Tags]` where `Werte` joins all field displays. Assert the joined values string.

- [ ] **Step 2: Run — verify fail**

Run: `pnpm exec vitest run src/lib/report/pdf.test.ts`
Expected: FAIL.

- [ ] **Step 3: Rewrite `src/lib/report/pdf.ts`**

Replace the top of the file (lines 1–34) with:

```ts
import type { Symptom, Tag } from '$lib/db';
import { entryFieldDisplays } from '$lib/db/fields';
import type { Entry } from '$lib/db';
import type { DayGroup } from './filter';

export interface PdfRow {
  date: string;
  /** [Symptom, Werte, Tags] */
  cells: [string, string, string];
}

export interface PdfHeader {
  title: string;
  rangeLabel: string;
  filterLabel: string;
  generatedLabel: string;
}

/** All field values for an entry, "Label: Wert" joined with " · ". */
function valuesCell(s: Symptom, e: Entry): string {
  return entryFieldDisplays(s, e).map((d) => `${d.field.label}: ${d.text}`).join(' · ');
}
function tagsCell(s: Symptom, tags: Map<string, Tag>): string {
  return s.tagIds.map((id) => tags.get(id)?.name).filter(Boolean).join(', ');
}
```

Replace the `entriesToPdfBody` push (lines 47–56) with:

```ts
      rows.push({
        date: g.date,
        cells: [s.name, valuesCell(s, e), tagsCell(s, tags)]
      });
```

Update the `autoTable` head (line 87): `head: [[g.date, 'Werte', 'Tags']],`.

- [ ] **Step 4: Run — verify pass**

Run: `pnpm exec vitest run src/lib/report/pdf.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/report/pdf.ts src/lib/report/pdf.test.ts
git commit -m "feat(pdf): export entry values per field"
```

---

### Task 14: Dev test-data seeding via `values`

**Files:**
- Modify: `src/lib/dev/testdata.ts`

**Interfaces:**
- Consumes: `upsertEntry({ values })` (Task 2), template symptoms now carry `fields`.

- [ ] **Step 1: Edit `src/lib/dev/testdata.ts`.** The seeder references each symptom's value field. Since template symptoms have exactly one slider/number field (plus a text note), look it up by type. Replace the `put` helper (lines 36–44) with a field-aware version:

```ts
  const fieldId = (sym: Symptom | undefined, type: 'slider' | 'number' | 'text'): string | null =>
    sym?.fields.find((f) => !f.deleted && f.type === type)?.id ?? null;

  const put = async (
    sym: Symptom | undefined,
    date: string,
    spec: { slider?: number | null; number?: number | null; comment?: string }
  ) => {
    if (!sym) return;
    const values: Record<string, number | string | null> = {};
    if (spec.slider !== undefined) { const id = fieldId(sym, 'slider'); if (id) values[id] = spec.slider; }
    if (spec.number !== undefined) { const id = fieldId(sym, 'number'); if (id) values[id] = spec.number; }
    if (spec.comment !== undefined) { const id = fieldId(sym, 'text'); if (id) values[id] = spec.comment; }
    await upsertEntry({ date, symptomId: sym.id, values });
    entries++;
  };
```

Add `import type { Symptom } from '$lib/db';` at the top. Then update each `put(...)` call to use the new keys: `{ comment: 'Beginn' }` stays; `{ sliderValue: 35 }` → `{ slider: 35 }`; `{ numberValue: 1 + (d % 3) }` → `{ number: 1 + (d % 3) }`. (The `byName` symptoms come from the template; `kopf`/`reiz`/`mued`/`schlaf` are sliders, `kaffee` is a number — each has the matching field.)

- [ ] **Step 2: Verify it runs** — `testdata.ts` has no dedicated unit test; it's exercised by the cycle-page test indirectly and at runtime. Confirm it transpiles by running the broader db/report suite:

Run: `pnpm exec vitest run src/lib/dev src/lib/report/heatmap.test.ts`
Expected: PASS (no test failures; `testdata.ts` imports cleanly).

- [ ] **Step 3: Commit**

```bash
git add src/lib/dev/testdata.ts
git commit -m "feat(dev): seed test data via field value map"
```

---

### Task 15: Integration gate — full check, build, and sweep for stragglers

**Files:**
- Any remaining files flagged by `pnpm check` (e.g. `EntryList.svelte`, `DailyPromptCard.test.ts`, `filter.test.ts`, `tags.test.ts`, `liveQuery.test.svelte.ts`, `transfer.test.ts`) that still reference the old API.

**Interfaces:**
- Consumes: everything above.

- [ ] **Step 1: Run the full type-check and fix every error**

Run: `pnpm check`
Expected initially: errors in any file still referencing `inputs`, `sliderValue`, `numberValue`, `selectKey`, `comment`, `SymptomInputs`, `defaultSymptomInputs`, `selectLabelFor`, `hasEnabledInput`, or `EntryFieldsLike`. Fix each:
- `EntryList.svelte` — read it; if it builds `EntryCard`/entry props it likely passes `entry` + `symptom` straight through (no change). If it references old value fields, switch to `entryFieldDisplays` or the `values` map.
- Test files (`DailyPromptCard.test.ts`, `filter.test.ts`, `tags.test.ts`, `liveQuery.test.svelte.ts`, `transfer.test.ts`) — update any seeded `inputs:`→`fields:` and `sliderValue`/etc.→`values:{}` to the new shapes (import `newField` where a concrete field is needed).

- [ ] **Step 2: Grep for any missed references**

Run: `grep -rn "\.inputs\b\|SymptomInputs\|defaultSymptomInputs\|sliderValue\|numberValue\|selectKey\|selectLabelFor\|hasEnabledInput\|EntryFieldsLike" src`
Expected: no matches (except inside the v6 migration's intentional legacy reads in `index.ts` and the historical `upgradeV1toV2` literal).

- [ ] **Step 3: Run the entire test suite**

Run: `pnpm test`
Expected: all suites PASS.

- [ ] **Step 4: Production build**

Run: `pnpm build`
Expected: build succeeds with no type or import errors.

- [ ] **Step 5: Manual smoke (developer, optional but recommended)**

Run: `pnpm dev`, then in the browser: create a symptom, add three number fields (Systolisch / Diastolisch / Puls), reorder them via the drag handle, log an entry, open the cycle report and confirm the Fokus picker lists `<Symptom> [Systolisch]` etc., and that the heatmap colors by the chosen field. Confirm existing dogfood data migrated (entries still show their values).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: finish flexible-metadata migration; full check & build green"
```

---

## Self-Review

**Spec coverage:**
- Arbitrary number of fields, any of 4 types → Task 1 (`MetaField`), Task 8/9/10 (editor + logging). ✓
- Customizable label per field → Task 1 (`label`), Task 5 (migration defaults), Task 8 (label input). ✓
- UUID-backed stability across rename/reorder → Task 1 (`id`), Task 8 (reorder keeps id), Task 2 (`values` keyed by id). ✓
- Reorder handle like symptom tree/status bar → Task 8 (ported `StatusBarConfig` drag). ✓
- Heatmap one series per value field, picked as `Symptom [Field]` → Task 6 + Task 12. ✓
- Auto-migration of existing symptoms + entries + cycle selection → Task 3. ✓
- Field type fixed after creation; new symptoms start empty → Task 1 (`defaultSymptomFields → []`), Task 8 (type chosen at add only). ✓
- PDF / report / day display per field → Tasks 11, 13. ✓
- Status bar unaffected (presence-based) → no task needed; confirmed by Task 15 grep. ✓

**Placeholder scan:** No "TBD"/"similar to"/"add error handling" — all steps carry concrete code or exact edits. ✓

**Type consistency:** `values: Record<string, number | string | null>` used identically in `Entry` (T1), `upsertEntry`/`validateEntry` (T2), editor (T10), display (T11), heatmap reads (T6). `MetaField` discriminated union consumed consistently. `entryFieldDisplays(symptom, entry)` signature matches all callers (T11, T13). Meta keys `report.cycle.valueId` + `report.cycle.valueFieldId` consistent between T3 (migration) and T12 (page). ✓
