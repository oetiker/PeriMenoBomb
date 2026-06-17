# Flexible Symptom Metadata — Design

**Date:** 2026-06-17
**Status:** Approved for planning

## Problem

The symptom metadata system is limited to a fixed set of four slots
(`slider`, `number`, `comment`, `select`), each appearing at most once per
symptom. This breaks down for symptoms that need several values of the same
type — e.g. a blood-pressure reading needs *systolic*, *diastolic*, and *pulse*
(three numbers). Today only one number per symptom is possible.

## Goal

Let a symptom carry **any number of metadata fields**, each:

- one of the four existing types — `slider`, `number`, `text` (was `comment`),
  `select`;
- with a **customizable label**;
- backed by a **stable UUID** so logged data survives label edits *and* field
  reordering;
- **reorderable** via a drag handle, like the symptom tree / status-bar editors.

## Non-goals

- Changing what the four input types do or how they render individually.
- Adding new field types beyond the existing four.
- Changing the status bar (its only item kind, `daysSince`, is presence-based
  and references a symptom, not a field).

## Chosen approach

**Single ordered field array.** Replace the fixed `SymptomInputs` struct with
`Symptom.fields: MetaField[]` — an ordered list of UUID-keyed, typed, labeled
fields. Entry values move from fixed columns to a `values` map keyed by field
UUID.

Rejected alternatives:

- **Keep four slots, make each a list** (`sliders[]`, `numbers[]`, …) — cannot
  interleave types in one display order; a single reorder handle across types
  is awkward.
- **Normalized entry-values sub-table** (`entryValues` table keyed by
  `entryId+fieldId`) — YAGNI; the app already embeds everything in the entry
  record, and an embedded map is simpler and offline-friendly.

## Data model

```ts
type FieldType = 'slider' | 'number' | 'text' | 'select';

interface BaseField {
  id: string;        // newId(); stable across label & order changes
  label: string;     // always present and customizable
  required: boolean;
  deleted?: boolean; // soft-delete; keeps historical values resolvable
}
interface SliderField extends BaseField { type: 'slider'; lowLabel: string; highLabel: string }
interface NumberField extends BaseField { type: 'number'; unit: string; integer: boolean }
interface TextField   extends BaseField { type: 'text' }
interface SelectField extends BaseField { type: 'select'; options: SelectOption[] }

type MetaField = SliderField | NumberField | TextField | SelectField;
```

`SelectOption` is unchanged (`{ key, label, value, deleted? }`, key is a stable
UUID).

### Symptom

- Remove `inputs: SymptomInputs`.
- Add `fields: MetaField[]` (ordered).
- New symptoms start with **zero fields** (author adds them explicitly);
  `defaultSymptomInputs()` → `defaultSymptomFields()` returning `[]`.

### Entry

- Remove `sliderValue`, `numberValue`, `comment`, `selectKey`.
- Add `values: Record<string, number | string | null>`, keyed by field UUID:
  - `slider`, `number` → `number | null`
  - `text` → `string`
  - `select` → option-key `string | null`

### Rules

- **Label is always present and customizable.** It is the heading in the entry
  editor and the `FieldLabel` part of `SymptomName [FieldLabel]` in the cycle
  picker and report rows. If a label is somehow empty, UI falls back to the
  symptom name (single-field) or the type name.
- **Field type is fixed after creation.** Changing a field's type would orphan
  stored values, so the UI offers no type switch — to change type, delete the
  field (soft-delete) and add a new one.
- **Deletion is soft** (`deleted: true`), mirroring select options. Deleted
  fields are hidden in the entry editor and render as `(gelöschtes Feld)` in
  reports; their stored values remain.

## Field editor UI

Replaces `InputConfigSection.svelte`. A **reorderable list of field cards**,
reusing the flat-list pointer-drag pattern from `StatusBarConfig.svelte` (the
simpler, non-tree drag), with the same `GripVertical` handle and
`touch-action: none`.

Each card:

- **Drag handle** (`GripVertical`) on the right, matching existing convention.
- **Type badge/icon** (read-only after creation).
- **Label** text input (seeded with a type default; freely editable).
- **Required** toggle.
- **Type-specific config:**
  - `slider` → low/high endpoint labels
  - `number` → unit + integer toggle
  - `select` → existing options sub-editor (add / soft-delete / restore; each
    option keeps its UUID `key`)
  - `text` → none
- **Delete** → soft-delete with restore.

**“+ Feld hinzufügen”** opens a small menu of the four types; choosing one
appends a field with `id: newId()`, `required: false`, type defaults, and a
type-based default label (see table below).

## Entry editor & validation

- `EntryEditor` iterates `symptom.fields` (skipping `deleted`) **in order**,
  rendering the matching input component (`SliderInput` / `NumberInput` /
  `SelectInput` / textarea) bound to `values[field.id]`, each headed by its
  label.
- `validateEntry` iterates fields and checks `required` against
  `values[field.id]` (null / empty / NaN per type).
- `upsertEntry` merges into the `values` map instead of fixed columns.

## Heatmap, cycle report & entry display

### Cycle heatmap (`src/routes/report/cycle/+page.svelte`)

- **Anchor** picker: lists symptoms (presence only). Persisted as
  `report.cycle.anchorId` (symptom UUID) — unchanged.
- **Value series** picker: lists **one entry per value-producing field**
  (`slider`, `number`, `select`) across all symptoms, labeled
  `SymptomName [FieldLabel]` (or just `SymptomName` when the symptom has a
  single value field). Selection persists as a `{ symptomId, fieldId }` pair:
  keep `report.cycle.valueId` (symptom UUID) and add
  `report.cycle.valueFieldId`.

### Intensity (`src/lib/report/heatmap.ts`)

- `classifyCell`, `valueDomain`, `valueNumberDomain`, `selectEntryValue`,
  `selectValueDomain` take a **`fieldId`** (or the resolved `MetaField`) and read
  `entry.values[fieldId]`, normalizing per that field's type:
  - `slider` 1–100 → 0–1
  - `number` / `select`-value → min/max domain over the selected field across
    the visible range
- The old type cascade (`slider → number → select → comment`) is removed.

### Day-level detail (`ReportEntryRow.svelte`, `EntryCard.svelte`)

- Iterate `symptom.fields`, rendering `label: value` for each non-empty value;
  text fields render as today's comment did.
- `selectLabelFor` takes a `fieldId` (or `SelectField`) to resolve a stored
  option key to its label.

### PDF (`src/lib/report/pdf.ts`)

- Update `intensityCell` / `numberCell` and value extraction to read from
  `values` by field, iterating fields rather than the four fixed slots.

## Migration (Dexie v5 → v6)

A new `this.version(6)` upgrade rewrites `symptoms` and `entries` in one
transaction.

### Per symptom

Build `fields[]` from the old `inputs`, in cascade order (slider → number →
select → text) so display order is sensible, creating a field only for each
slot that was `enabled`:

| Old slot          | New field        | Carried over                          | Default label             |
|-------------------|------------------|---------------------------------------|---------------------------|
| `slider` enabled  | `type:'slider'`  | `lowLabel`, `highLabel`, `required`   | `Intensität`              |
| `number` enabled  | `type:'number'`  | `unit`, `integer`, `required`         | existing `unit` else `Wert` |
| `select` enabled  | `type:'select'`  | `options` (keys preserved), `required`| `Auswahl`                 |
| `comment` enabled | `type:'text'`    | `required`                            | `Notiz`                   |

Each new field gets a fresh `id: newId()`. Hold a per-symptom map
`{ slider→fieldId, number→fieldId, select→fieldId, comment→fieldId }` in memory
so entries can be remapped. Delete the old `inputs` property; set `fields`.

### Per entry

Look up the entry's symptom's slot→fieldId map and build `values`:

- `sliderValue` → `values[sliderFieldId]`
- `numberValue` → `values[numberFieldId]`
- `selectKey`   → `values[selectFieldId]`
- `comment` (if non-empty) → `values[textFieldId]`

Drop the four old columns. Orphan entries (symptom gone) get `values: {}`.

### Cycle selection meta

Migrate `report.cycle.valueId`: if present, set `report.cycle.valueFieldId` to
that symptom's **first value field** id. `report.cycle.anchorId` is unchanged.

## Affected files

- `src/lib/db/index.ts` — types (`MetaField`, `Symptom.fields`, `Entry.values`),
  schema v6 + upgrade, `defaultSymptomFields()`.
- `src/lib/db/entries.ts` — `validateEntry`, `upsertEntry`, `selectLabelFor`.
- `src/lib/db/symptoms.ts` — symptom creation defaults.
- `src/lib/components/SymptomAdmin/InputConfigSection.svelte` → field-list editor
  (reorderable).
- `src/lib/components/SymptomAdmin/SymptomEditModal.svelte` — save `fields`.
- `src/lib/components/EntryEditor/EntryEditor.svelte` — render fields from
  `fields[]`, bind to `values`.
- `src/lib/report/heatmap.ts` — field-scoped intensity/domain.
- `src/routes/report/cycle/+page.svelte` — value-field picker + persistence.
- `src/lib/components/report/ReportEntryRow.svelte`,
  `src/lib/components/DayView/EntryCard.svelte` — per-field display.
- `src/lib/report/pdf.ts` — per-field export.
- Tests under `src/lib/**` and `src/routes/report/**` that assert on the old
  `inputs` / fixed entry columns.

## Open points (resolved)

- New symptoms start with **zero fields**.
- Field **type is fixed after creation** (delete + re-add to change).
- Existing data is **auto-migrated** (symptoms and entries).
