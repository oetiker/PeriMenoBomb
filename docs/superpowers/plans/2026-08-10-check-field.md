# Check Field Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a fifth symptom metadata field type — `check`, a plain tick-box — so a symptom can carry checkable sub-aspects instead of forcing a slider for every detail.

**Architecture:** `Symptom.fields` is already an ordered array of a discriminated-union type `MetaField`. This adds one variant (`CheckField`), widens `Entry.values` to accept booleans, and extends the five places that switch on `field.type`: `newField`, `entryFieldDisplays`, `isValueField`, `classifyCell`/`valueDomain`, plus the two UI components (`FieldListEditor` config, `EntryEditor` logging). No Dexie schema change and no migration — `fields` and `values` are free-form blobs inside existing stores.

**Tech Stack:** SvelteKit 2 + Svelte 5 (runes), TypeScript, Dexie 4, Vitest + @testing-library/svelte, pnpm.

**Spec:** `docs/superpowers/specs/2026-08-10-check-field-design.md`

## Global Constraints

- Package manager is **pnpm**. Never npm/yarn.
- `CURRENT_DB_VERSION` stays **6**. Do not add a Dexie version or upgrade hook.
- Code identifiers, comments and doc-comments in **English**. User-facing UI strings in **German**.
- German UI copy must avoid the generic masculine (this feature's strings are neutral already: "Häkchen", "Zutreffend", "ja").
- Field type slug is `check`; German UI label for the type is **`Häkchen`**; default field label for a new check field is **`Zutreffend`**.
- Stored values: checked → `true`, unchecked → `false`, never-touched → key absent. Only `true` is ever surfaced (display, PDF, heatmap).
- `required` is never `true` on a check field; the "Pflicht" toggle is hidden for this type.
- Tests run with `pnpm test` (vitest, single run). Type check with `pnpm check`.
- Run at most 4 parallel jobs — vitest defaults are fine, do not raise concurrency.
- Commit after each task with the messages given. Do not push.

---

### Task 1: Type model — `CheckField` and boolean entry values

**Files:**
- Modify: `src/lib/db/index.ts` (FieldType at :58, field interfaces at :69-76, `Entry.values` at :80-88)
- Modify: `src/lib/db/entries.ts:4` (`EntryValues`)
- Modify: `src/lib/stores/openDialog.svelte.ts:10` (`payload.values`)
- Modify: `src/lib/db/fields.ts:7-15` (`newField`)
- Test: `src/lib/db/fields.test.ts`

**Interfaces:**
- Consumes: nothing (first task).
- Produces:
  - `export interface CheckField extends BaseField { type: 'check' }` exported from `$lib/db`
  - `FieldType` now includes `'check'`
  - `MetaField` union includes `CheckField`
  - `EntryValues = Record<string, number | string | boolean | null>` (exported from `$lib/db/entries`)
  - `newField('check')` → `{ id, type: 'check', label: 'Zutreffend', required: false }`

- [ ] **Step 1: Write the failing test**

Append to `src/lib/db/fields.test.ts` (inside the existing top-level `describe` for `newField` if there is one — otherwise add this block at the end of the file):

```ts
describe('newField("check")', () => {
  it('mints a check field with the German default label and required=false', () => {
    const f = newField('check');
    expect(f.type).toBe('check');
    expect(f.label).toBe('Zutreffend');
    expect(f.required).toBe(false);
    expect(f.id).toBeTruthy();
  });

  it('gives each check field a distinct id', () => {
    expect(newField('check').id).not.toBe(newField('check').id);
  });
});
```

Make sure `newField` and `describe/it/expect` are already imported at the top of that file; they are.

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test src/lib/db/fields.test.ts`
Expected: FAIL — TypeScript/vitest rejects `newField('check')` because `'check'` is not assignable to `FieldType`, or the switch returns `undefined`.

- [ ] **Step 3: Add the type variant**

In `src/lib/db/index.ts`, change the `FieldType` union (currently line 58) to:

```ts
export type FieldType = 'slider' | 'number' | 'text' | 'select' | 'check';
```

Add the interface next to the other field interfaces (after `SelectField`):

```ts
/** Boolean tick-box. Carries no config beyond BaseField — the label IS the
    question ("nachts aufgewacht"). Only a `true` value is ever surfaced;
    `false` and a missing key read identically everywhere. */
export interface CheckField extends BaseField { type: 'check' }
```

Extend the union:

```ts
export type MetaField = SliderField | NumberField | TextField | SelectField | CheckField;
```

Widen the `Entry.values` declaration and its doc comment:

```ts
  /** Logged values keyed by field id. slider/number → number|null; text →
      string; select → chosen option key (string) | null; check → boolean.
      A missing key means the field was not logged. */
  values: Record<string, number | string | boolean | null>;
```

- [ ] **Step 4: Widen the two mirror types**

In `src/lib/db/entries.ts` line 4:

```ts
export type EntryValues = Record<string, number | string | boolean | null>;
```

In `src/lib/stores/openDialog.svelte.ts`, inside the `'entry-editor'` payload:

```ts
        values: Record<string, number | string | boolean | null>;
```

- [ ] **Step 5: Extend `newField`**

In `src/lib/db/fields.ts`, add a case to the switch (after `'select'`):

```ts
    case 'check':  return { id, type, label: 'Zutreffend', required: false };
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `pnpm test src/lib/db/fields.test.ts`
Expected: PASS

- [ ] **Step 7: Type check**

Run: `pnpm check`
Expected: no new errors. Existing exhaustive switches over `MetaField` may now flag the missing `check` branch — that is expected and gets fixed in Tasks 2 and 3. If `pnpm check` reports errors **only** in `src/lib/db/fields.ts` (`entryFieldDisplays`) or `src/lib/report/heatmap.ts`, leave them; anything else must be fixed now.

- [ ] **Step 8: Commit**

```bash
git add src/lib/db/index.ts src/lib/db/entries.ts src/lib/db/fields.ts src/lib/stores/openDialog.svelte.ts src/lib/db/fields.test.ts
git commit -m "feat(fields): add the check field type to the data model"
```

---

### Task 2: Display and validation

**Files:**
- Modify: `src/lib/db/fields.ts` (`entryFieldDisplays`, ~:37-59)
- Modify: `src/lib/db/entries.ts:55-69` (`validateEntry`)
- Test: `src/lib/db/fields.test.ts`, `src/lib/db/entries.test.ts`

**Interfaces:**
- Consumes: `CheckField`, `newField('check')`, widened `EntryValues` from Task 1.
- Produces: `entryFieldDisplays` emits `{ field, text: 'ja' }` for a `true` check value and omits the field otherwise. `validateEntry` never reports a check field as missing.

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/db/fields.test.ts`. The file already has a helper for building a symptom; if it does not, use this local one (check first — do not duplicate an existing helper):

```ts
describe('entryFieldDisplays with a check field', () => {
  function symptomWith(fields: MetaField[]): Symptom {
    return {
      id: 's1', name: 'X', color: '#000', icon: '⚪',
      tagIds: [], parentId: null, sortIndex: 0, depth: 0,
      isFolder: false, archived: false, createdAt: 0, updatedAt: 0,
      fields, daily: false
    };
  }

  it('shows "ja" when the box is ticked', () => {
    const f = { ...newField('check'), label: 'Nachts aufgewacht' };
    const out = entryFieldDisplays(symptomWith([f]), { values: { [f.id]: true } });
    expect(out).toEqual([{ field: f, text: 'ja' }]);
  });

  it('omits the field when the value is false', () => {
    const f = newField('check');
    expect(entryFieldDisplays(symptomWith([f]), { values: { [f.id]: false } })).toEqual([]);
  });

  it('omits the field when no value was logged', () => {
    const f = newField('check');
    expect(entryFieldDisplays(symptomWith([f]), { values: {} })).toEqual([]);
  });

  it('omits a soft-deleted check field even when ticked', () => {
    const f = { ...newField('check'), deleted: true };
    expect(entryFieldDisplays(symptomWith([f]), { values: { [f.id]: true } })).toEqual([]);
  });
});
```

Ensure the file imports `MetaField` and `Symptom` types and `entryFieldDisplays`; add to the existing import lines if missing.

Append to `src/lib/db/entries.test.ts`:

```ts
describe('validateEntry with a check field', () => {
  it('never blocks saving on a check field, even one flagged required', () => {
    const f = { ...newField('check'), required: true };
    const s: Symptom = {
      id: 's1', name: 'X', color: '#000', icon: '⚪',
      tagIds: [], parentId: null, sortIndex: 0, depth: 0,
      isFolder: false, archived: false, createdAt: 0, updatedAt: 0,
      fields: [f], daily: false
    };
    expect(validateEntry(s, {})).toEqual({ ok: true, missing: [] });
    expect(validateEntry(s, { [f.id]: false })).toEqual({ ok: true, missing: [] });
  });
});
```

Add `newField` to that file's imports (`import { newField } from './fields';`) if it is not already there, plus `Symptom` and `validateEntry`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test src/lib/db/fields.test.ts src/lib/db/entries.test.ts`
Expected: FAIL — `entryFieldDisplays` currently falls into its text branch and drops the check field (so the "ja" test fails), and `validateEntry`'s `else` branch treats a required check field as an empty text field (so `ok` is `false`).

- [ ] **Step 3: Handle `check` in `entryFieldDisplays`**

In `src/lib/db/fields.ts`, inside the `for` loop, add a branch **before** the final `else` (which handles text):

```ts
    } else if (f.type === 'check') {
      // Only a tick is information. false and "never logged" read the same.
      if (v !== true) continue;
      out.push({ field: f, text: 'ja' });
    } else {
```

- [ ] **Step 4: Make `validateEntry`'s text branch explicit**

In `src/lib/db/entries.ts`, replace the trailing `else { // text` branch so the text rule only applies to text fields — a check field can then never land in it:

```ts
    } else if (f.type === 'text') {
      if (typeof v !== 'string' || v.trim().length === 0) missing.push(f.id);
    }
    // check: an unticked box is a valid answer, so `required` is meaningless
    // and never enforced. The config UI hides the toggle entirely.
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm test src/lib/db/fields.test.ts src/lib/db/entries.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/db/fields.ts src/lib/db/entries.ts src/lib/db/fields.test.ts src/lib/db/entries.test.ts
git commit -m "feat(fields): render ticked check fields as 'ja' and exempt them from validation"
```

---

### Task 3: Cycle heatmap support

**Files:**
- Modify: `src/lib/db/fields.ts:17-20` (`isValueField`)
- Modify: `src/lib/report/heatmap.ts` (`valueDomain` ~:55-59, `classifyCell` ~:61-85)
- Test: `src/lib/db/fields.test.ts`, `src/lib/report/heatmap.test.ts`

**Interfaces:**
- Consumes: `CheckField` from Task 1.
- Produces: `isValueField(checkField) === true`; `valueDomain(entries, checkField) === null`; `classifyCell(checkField, entry, null)` → `{ kind: 'value', intensity: 1 }` when ticked, `{ kind: 'none', intensity: 0 }` otherwise. `src/routes/report/cycle/+page.svelte` picks check fields up automatically — it filters via `isValueField` and needs no edit.

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/db/fields.test.ts`:

```ts
describe('isValueField with check', () => {
  it('accepts a check field as a heatmap value series', () => {
    expect(isValueField(newField('check'))).toBe(true);
  });
});
```

Append to `src/lib/report/heatmap.test.ts` (reuse the file's existing helper for building an `Entry` if one exists; otherwise use the literal below):

```ts
describe('check fields in the heatmap', () => {
  const f = newField('check');
  const entry = (values: Record<string, number | string | boolean | null>): Entry => ({
    id: '2026-08-10__s1', date: '2026-08-10', symptomId: 's1', values, updatedAt: 0
  });

  it('has no normalization domain', () => {
    expect(valueDomain([entry({ [f.id]: true })], f)).toBeNull();
  });

  it('paints a ticked box at full intensity', () => {
    expect(classifyCell(f, entry({ [f.id]: true }), null)).toEqual({ kind: 'value', intensity: 1 });
  });

  it('leaves an unticked box empty', () => {
    expect(classifyCell(f, entry({ [f.id]: false }), null)).toEqual({ kind: 'none', intensity: 0 });
  });

  it('leaves a day without the value empty', () => {
    expect(classifyCell(f, entry({}), null)).toEqual({ kind: 'none', intensity: 0 });
  });

  it('leaves a day without any entry empty', () => {
    expect(classifyCell(f, undefined, null)).toEqual({ kind: 'none', intensity: 0 });
  });
});
```

Add `newField` and the `Entry` type to that file's imports if missing.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test src/lib/db/fields.test.ts src/lib/report/heatmap.test.ts`
Expected: FAIL — `isValueField` returns `false`, and `classifyCell` falls through to its text fallback `{ kind: 'recorded', intensity: 1 }` for every case including an unticked box.

- [ ] **Step 3: Extend `isValueField`**

In `src/lib/db/fields.ts`:

```ts
/** Field types that can drive heatmap intensity / be picked as a value series.
    A check field has no scale — it is on (full colour) or absent. */
export function isValueField(f: MetaField): boolean {
  return f.type === 'slider' || f.type === 'number' || f.type === 'select' || f.type === 'check';
}
```

- [ ] **Step 4: Handle `check` in the heatmap**

In `src/lib/report/heatmap.ts`, `valueDomain` already returns `null` for anything that is not `number`/`select`, so it needs no change — but update its doc comment to say so:

```ts
/** Normalization domain for the selected value field (number or select).
    slider, text and check need none: their intensity is fixed. */
```

In `classifyCell`, add a branch before the trailing text fallback:

```ts
  if (field.type === 'check') {
    // Binary: ticked means "happened", nothing else carries information.
    return v === true ? { kind: 'value', intensity: 1 } : NONE;
  }
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm test src/lib/db/fields.test.ts src/lib/report/heatmap.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/db/fields.ts src/lib/report/heatmap.ts src/lib/db/fields.test.ts src/lib/report/heatmap.test.ts
git commit -m "feat(report): allow a check field as a cycle-heatmap value series"
```

---

### Task 4: `CheckInput` component

**Files:**
- Create: `src/lib/components/EntryEditor/CheckInput.svelte`
- Test: `src/lib/components/EntryEditor/CheckInput.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks (pure presentational component).
- Produces: `CheckInput` with props `{ value: boolean; label: string; onChange: (v: boolean) => void }`. The rendered `<input type="checkbox">` is reachable via `getByLabelText(label)`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/components/EntryEditor/CheckInput.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import CheckInput from './CheckInput.svelte';

describe('CheckInput', () => {
  it('renders the label next to the box', () => {
    const { getByLabelText } = render(CheckInput, {
      props: { value: false, label: 'Nachts aufgewacht', onChange: () => {} }
    });
    expect(getByLabelText('Nachts aufgewacht')).toBeTruthy();
  });

  it('reflects the current value', () => {
    const { getByLabelText } = render(CheckInput, {
      props: { value: true, label: 'A', onChange: () => {} }
    });
    expect((getByLabelText('A') as HTMLInputElement).checked).toBe(true);
  });

  it('emits true when ticked', async () => {
    const onChange = vi.fn();
    const { getByLabelText } = render(CheckInput, {
      props: { value: false, label: 'A', onChange }
    });
    await fireEvent.click(getByLabelText('A'));
    expect(onChange).toHaveBeenLastCalledWith(true);
  });

  it('emits false when unticked', async () => {
    const onChange = vi.fn();
    const { getByLabelText } = render(CheckInput, {
      props: { value: true, label: 'A', onChange }
    });
    await fireEvent.click(getByLabelText('A'));
    expect(onChange).toHaveBeenLastCalledWith(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test src/lib/components/EntryEditor/CheckInput.test.ts`
Expected: FAIL — cannot resolve `./CheckInput.svelte`.

- [ ] **Step 3: Create the component**

Create `src/lib/components/EntryEditor/CheckInput.svelte`:

```svelte
<script lang="ts">
  type Props = {
    value: boolean;
    label: string;
    onChange: (v: boolean) => void;
  };
  let { value, label, onChange }: Props = $props();
</script>

<label class="check">
  <input
    type="checkbox"
    checked={value}
    onchange={(e) => onChange((e.currentTarget as HTMLInputElement).checked)}
  />
  <span>{label}</span>
</label>

<style>
  /* Whole row is the tap target: 44px is the iOS minimum for a comfortable
     thumb hit, and this control is meant to be tapped in a hurry. */
  .check {
    display: flex;
    align-items: center;
    gap: var(--sp-3);
    min-height: 44px;
    padding: 0 var(--sp-2);
    border: 1px solid var(--c-border);
    border-radius: var(--r-2);
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }
  .check input[type='checkbox'] { width: 20px; height: 20px; flex-shrink: 0; }
  .check span { font-weight: var(--fw-medium); }
</style>
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test src/lib/components/EntryEditor/CheckInput.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/EntryEditor/CheckInput.svelte src/lib/components/EntryEditor/CheckInput.test.ts
git commit -m "feat(entry-editor): add CheckInput tick-box component"
```

---

### Task 5: Wire `CheckInput` into the entry editor

**Files:**
- Modify: `src/lib/components/EntryEditor/EntryEditor.svelte` (imports :5-7, `values` state :31, field loop :174-212)
- Test: `src/lib/components/EntryEditor/EntryEditor.test.ts`

**Interfaces:**
- Consumes: `CheckInput` (Task 4), `newField('check')` (Task 1), widened `values` type (Task 1).
- Produces: entry editor renders a check field with no uppercase caption; saving writes `true`/`false` into `Entry.values`.

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/components/EntryEditor/EntryEditor.test.ts` (the file already defines `makeSymptom` and imports `newField`, `db`, `tick`):

```ts
describe('check fields', () => {
  it('ticking the box stores true', async () => {
    const f = { ...newField('check'), label: 'Nachts aufgewacht' };
    const s = makeSymptom({ fields: [f] });
    const { getByLabelText, getByText } = render(EntryEditor, {
      props: { open: true, date: '2026-05-28', symptom: s, onClose: () => {} }
    });
    await fireEvent.click(getByLabelText('Nachts aufgewacht'));
    await fireEvent.click(getByText('Speichern'));
    await tick();
    await new Promise((r) => setTimeout(r, 30));
    const entry = await db.entries.get('2026-05-28__s1');
    expect(entry?.values[f.id]).toBe(true);
  });

  it('unticking a previously stored box writes false so the merge in upsertEntry cannot resurrect it', async () => {
    const f = { ...newField('check'), label: 'Nachts aufgewacht' };
    const s = makeSymptom({ fields: [f] });
    await db.entries.put({
      id: '2026-05-28__s1', date: '2026-05-28', symptomId: 's1',
      values: { [f.id]: true }, updatedAt: 0
    });
    const { getByLabelText, getByText } = render(EntryEditor, {
      props: { open: true, date: '2026-05-28', symptom: s, onClose: () => {} }
    });
    await tick();
    await new Promise((r) => setTimeout(r, 30));
    await fireEvent.click(getByLabelText('Nachts aufgewacht'));
    await fireEvent.click(getByText('Speichern'));
    await tick();
    await new Promise((r) => setTimeout(r, 30));
    const entry = await db.entries.get('2026-05-28__s1');
    expect(entry?.values[f.id]).toBe(false);
  });

  it('does not print the uppercase caption above a check field', () => {
    const f = { ...newField('check'), label: 'Nachts aufgewacht' };
    const s = makeSymptom({ fields: [f] });
    const { container } = render(EntryEditor, {
      props: { open: true, date: '2026-05-28', symptom: s, onClose: () => {} }
    });
    const captions = [...container.querySelectorAll('.caption')].map((n) => n.textContent?.trim());
    // "Datum" is the date section's caption and must stay.
    expect(captions).toEqual(['Datum']);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test src/lib/components/EntryEditor/EntryEditor.test.ts`
Expected: FAIL — a check field currently falls into the `{:else}` textarea branch, so `getByLabelText('Nachts aufgewacht')` finds nothing and the caption assertion sees two captions.

- [ ] **Step 3: Import the component and widen the values state**

In `src/lib/components/EntryEditor/EntryEditor.svelte`, add to the imports next to `SelectInput`:

```svelte
  import CheckInput from './CheckInput.svelte';
```

Change the `values` state and the `setValue` signature and the `initial` prop type to allow booleans:

```svelte
    initial?: { values: Record<string, number | string | boolean | null> };
```

```svelte
  let values = $state<Record<string, number | string | boolean | null>>(untrack(() => ({ ...(initial?.values ?? {}) })));
```

```svelte
  function setValue(id: string, v: number | string | boolean | null) {
    values = { ...values, [id]: v };
  }
```

- [ ] **Step 4: Render check fields without a caption**

Replace the body of the `{#each symptom.fields...}` block so the caption is skipped for check fields. The whole block becomes:

```svelte
  {#each symptom.fields.filter((f) => !f.deleted) as field (field.id)}
    <section>
      {#if field.type !== 'check'}
        <div class="caption">
          {field.label || symptom.name}
          {#if field.required}<span class="req">*</span>{/if}
        </div>
      {/if}
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
          label={field.label}
          onChange={(k) => setValue(field.id, k)}
        />
      {:else if field.type === 'check'}
        <CheckInput
          value={values[field.id] === true}
          label={field.label || symptom.name}
          onChange={(v) => setValue(field.id, v)}
        />
      {:else}
        <textarea
          class="comment"
          rows={3}
          placeholder="z.B. Auslöser, Umstände…"
          value={(values[field.id] ?? '') as string}
          oninput={(e) => setValue(field.id, (e.currentTarget as HTMLTextAreaElement).value)}
        ></textarea>
      {/if}
    </section>
  {/each}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm test src/lib/components/EntryEditor/EntryEditor.test.ts`
Expected: PASS — including the pre-existing tests in that file.

- [ ] **Step 6: Commit**

```bash
git add src/lib/components/EntryEditor/EntryEditor.svelte src/lib/components/EntryEditor/EntryEditor.test.ts
git commit -m "feat(entry-editor): log check fields with a tick-box"
```

---

### Task 6: Add "Häkchen" to the symptom field editor

**Files:**
- Modify: `src/lib/components/SymptomAdmin/FieldListEditor.svelte` (TYPE_LABELS :15-17, ADD_ORDER :18, header row :148-153)
- Test: `src/lib/components/SymptomAdmin/FieldListEditor.test.ts`

**Interfaces:**
- Consumes: `FieldType` including `'check'` and `newField('check')` from Task 1.
- Produces: the add-menu offers a `Häkchen hinzufügen` button; a check field's card shows the label input, delete and drag handle but **no** "Pflicht" checkbox and no body.

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/components/SymptomAdmin/FieldListEditor.test.ts`:

```ts
describe('check fields', () => {
  it('adds a check field from the add-menu', async () => {
    let fields: MetaField[] = [];
    const onFieldsChange = vi.fn((n: MetaField[]) => (fields = n));
    const { getByRole } = render(FieldListEditor, {
      props: { fields, daily: false, onFieldsChange, onDailyChange: vi.fn() }
    });
    await fireEvent.click(getByRole('button', { name: 'Feld hinzufügen' }));
    await fireEvent.click(getByRole('button', { name: 'Häkchen hinzufügen' }));
    expect(fields[0].type).toBe('check');
    expect(fields[0].label).toBe('Zutreffend');
  });

  it('hides the Pflicht toggle for a check field', () => {
    const { queryByText } = render(FieldListEditor, {
      props: { fields: [newField('check')], daily: false, onFieldsChange: vi.fn(), onDailyChange: vi.fn() }
    });
    expect(queryByText('Pflicht')).toBeNull();
  });

  it('still shows the Pflicht toggle for other field types', () => {
    const { queryByText } = render(FieldListEditor, {
      props: { fields: [newField('text')], daily: false, onFieldsChange: vi.fn(), onDailyChange: vi.fn() }
    });
    expect(queryByText('Pflicht')).toBeTruthy();
  });

  it('lets the author rename a check field', async () => {
    const f = newField('check');
    let fields = [f];
    const onFieldsChange = vi.fn((n: MetaField[]) => (fields = n));
    const { getByLabelText } = render(FieldListEditor, {
      props: { fields, daily: false, onFieldsChange, onDailyChange: vi.fn() }
    });
    await fireEvent.input(getByLabelText('Bezeichnung'), { target: { value: 'Nachts aufgewacht' } });
    expect(fields[0].id).toBe(f.id);
    expect(fields[0].label).toBe('Nachts aufgewacht');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test src/lib/components/SymptomAdmin/FieldListEditor.test.ts`
Expected: FAIL — no `Häkchen hinzufügen` button exists, and the Pflicht toggle renders for every non-deleted field.

- [ ] **Step 3: Register the type in the editor**

In `src/lib/components/SymptomAdmin/FieldListEditor.svelte`:

```svelte
  const TYPE_LABELS: Record<FieldType, string> = {
    slider: 'Slider', number: 'Zahl', select: 'Auswahl', check: 'Häkchen', text: 'Notiz'
  };
  const ADD_ORDER: FieldType[] = ['slider', 'number', 'select', 'check', 'text'];
```

- [ ] **Step 4: Hide the Pflicht toggle for check fields**

In the card header, wrap the Pflicht label in a type guard:

```svelte
            <input type="text" class="label" aria-label="Bezeichnung" placeholder="z.B. Systolisch" value={f.label} oninput={(e) => patch(f.id, { label: (e.currentTarget as HTMLInputElement).value })} />
            {#if f.type !== 'check'}
              <!-- A "required tick-box" would mean "you must tick it", which
                   contradicts the field's meaning, so the toggle is omitted. -->
              <label class="req"><input type="checkbox" checked={f.required} onchange={(e) => patch(f.id, { required: (e.currentTarget as HTMLInputElement).checked })} /> Pflicht</label>
            {/if}
```

No body block is added — the existing `{#if !f.deleted && f.type === 'slider'} … {:else if … 'select'}` chain simply has no `check` branch, which is correct.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm test src/lib/components/SymptomAdmin/FieldListEditor.test.ts`
Expected: PASS — including the file's pre-existing tests.

- [ ] **Step 6: Commit**

```bash
git add src/lib/components/SymptomAdmin/FieldListEditor.svelte src/lib/components/SymptomAdmin/FieldListEditor.test.ts
git commit -m "feat(symptom-admin): offer the Häkchen field type"
```

---

### Task 7: Full verification

**Files:**
- Modify: `CHANGES.md`
- No source changes expected. If verification uncovers a defect, fix it here and note it in the commit message.

**Interfaces:**
- Consumes: everything from Tasks 1-6.
- Produces: a green test suite, a clean type check, a successful build, and a changelog entry.

- [ ] **Step 1: Run the full test suite**

Run: `pnpm test`
Expected: PASS, no failures. Pay attention to `src/lib/db/backup.test.ts`, `importMigrate.test.ts` and `report/pdf`-related tests — they exercise the widened `values` type indirectly and must still pass unchanged.

- [ ] **Step 2: Type check**

Run: `pnpm check`
Expected: 0 errors, 0 warnings from the new code. Fix anything the widened `Record<string, number | string | boolean | null>` surfaced (most likely a cast in a consumer of `entry.values`).

- [ ] **Step 3: Build**

Run: `pnpm build`
Expected: build succeeds.

- [ ] **Step 4: Manual smoke test**

Run: `pnpm preview` (rebuild first if the build output changed — a running preview server serves stale hashed chunks). Then in the browser:

1. Open a symptom's config, "Feld hinzufügen" → "Häkchen". Confirm there is no "Pflicht" checkbox and no extra config body.
2. Rename the field to "Nachts aufgewacht", save.
3. Log an entry for that symptom, tick the box, save. The day card should read "Nachts aufgewacht: ja".
4. Reopen the entry, untick, save. The line should disappear from the card.
5. Open `/report/cycle`, pick a cycle anchor, and confirm the check field appears in the value-series picker and paints ticked days at full colour.

- [ ] **Step 5: Add a changelog entry**

Add to the top section of `CHANGES.md`, matching the file's existing style:

```markdown
- Neuer Feldtyp **Häkchen**: ankreuzbare Teilaspekte an einem Symptom, für alles,
  wofür ein Slider zu viel ist. Angekreuzte Häkchen erscheinen im Verlauf und im
  PDF und lassen sich als Wert-Serie in der Zyklus-Heatmap auswerten.
```

- [ ] **Step 6: Commit**

```bash
git add CHANGES.md
git commit -m "docs: changelog entry for the Häkchen field type"
```

---

## Self-Review Notes

Spec coverage check against `docs/superpowers/specs/2026-08-10-check-field-design.md`:

| Spec section | Task |
|---|---|
| Datenmodell (`CheckField`, `FieldType`, widened `values`) | 1 |
| Keine DB-Migration (version stays 6) | Global Constraints; verified in 7 |
| Symptom-Konfiguration (`Häkchen`, no Pflicht, no body) | 6 |
| `newField` default `Zutreffend` | 1 |
| Eintrags-Dialog (`CheckInput`, no caption) | 4, 5 |
| Storage semantics (`true`/`false`/absent, merge safety) | 5 |
| Anzeige (`ja`, skipped otherwise, incl. PDF via shared fn) | 2 |
| Zyklus-Heatmap (`isValueField`, `valueDomain`, `classifyCell`) | 3 |
| Validierung (explicit text branch) | 2 |
| Tests | every task |
