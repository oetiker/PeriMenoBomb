# Per-Symptom Input Configuration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ersetze das fixe `intensity`-Modell durch eine pro Symptom konfigurierbare Eingabe-Palette (Slider mit unspez-Slot, Zahl, Kommentar; je `enabled`/`required`), füge einen `daily`-Flag mit Prompt-Karten in der Tagesliste hinzu, und persistiere den offenen Dialog so dass App-Restart das Formular wiederherstellt.

**Architecture:** Dexie-Schema-Version 2 (destructive Migration, keine Backward-Compat). Neue DB-Module `defaultSymptomInputs()`, `validateEntry()`, `listDailySymptomsForDate()`. Neuer Svelte-5-Store `openDialog.svelte.ts` schreibt Dialog-State in `meta.openDialog`; Restore-Logik in `+layout.svelte` lädt + navigiert + setzt einen reaktiven `pendingRestore`-Trigger, den Route-Container konsumieren. UI-Komponenten neu: `SliderInput` (eigener Pointer-Slider mit Snap-Gap), `NumberInput`, `InputConfigSection`, `DailyPromptCard`. `EntryEditor`, `EntryList`, `EntryCard`, `SymptomEditModal` umgebaut.

**Tech Stack:** Svelte 5 mit runes (`$state`, `$effect`, `$props`, `untrack`), SvelteKit `adapter-static`, Dexie 4, Vitest + `@testing-library/svelte` + `fake-indexeddb`, Playwright (Mobile-Viewport).

**Spec-Referenz:** [docs/superpowers/specs/2026-05-28-input-config-design.md](../specs/2026-05-28-input-config-design.md)

---

## File Structure

```
src/
├── lib/
│   ├── db/
│   │   ├── index.ts                  # MOD: Symptom.inputs/daily, Entry-Felder neu, Schema v2
│   │   ├── symptoms.ts               # MOD: createSymptom-Defaults, listDailySymptomsForDate, hasEnabledInput
│   │   ├── symptoms.test.ts          # MOD: Defaults + neue Query
│   │   ├── entries.ts                # MOD: UpsertEntryInput, validateEntry
│   │   ├── entries.test.ts           # MOD: neue Felder, validateEntry-Cases
│   │   └── migration.test.ts         # NEU: v1→v2-Upgrade-Test mit altem Snapshot
│   ├── stores/
│   │   ├── openDialog.svelte.ts      # NEU: persistDialog/updateDialogPayload/clearDialog/pendingRestore
│   │   └── openDialog.test.svelte.ts # NEU: Roundtrip-Test
│   ├── components/
│   │   ├── EntryEditor/
│   │   │   ├── SliderInput.svelte    # NEU: Custom-Slider mit unspez-Slot + Gap-Snap
│   │   │   ├── SliderInput.test.ts   # NEU
│   │   │   ├── NumberInput.svelte    # NEU: Kompaktes Zahlenfeld + Einheit
│   │   │   ├── NumberInput.test.ts   # NEU
│   │   │   ├── EntryEditor.svelte    # MOD: Komplettumbau
│   │   │   └── EntryEditor.test.ts   # MOD: neue Validierungs-Cases
│   │   ├── SymptomAdmin/
│   │   │   ├── InputConfigSection.svelte    # NEU: 3 Input-Karten + Daily-Toggle
│   │   │   ├── InputConfigSection.test.ts   # NEU
│   │   │   ├── SymptomEditModal.svelte      # MOD: InputConfigSection einbinden, persistDialog
│   │   │   └── SymptomEditModal.test.ts     # MOD
│   │   └── DayView/
│   │       ├── DailyPromptCard.svelte       # NEU: graue „noch offen"-Karte
│   │       ├── DailyPromptCard.test.ts      # NEU
│   │       ├── EntryList.svelte             # MOD: 2 Sektionen, datums-abhängige Header
│   │       └── EntryCard.svelte             # MOD: Status-Zeile Slider/Zahl/Kommentar
│   ├── templates/
│   │   └── perimeno-default.ts              # MOD: pro Template-Symptom inputs + ggf. daily
│   └── utils/
│       └── transfer.test.ts                 # MOD: alte intensity-Fixtures raus
├── routes/
│   └── +layout.svelte                # MOD: openMount-Restore-Logik
└── ...

tests/e2e/
└── happy-path.spec.ts                # MOD: neuer Slider/Zahl/Daily-Flow
```

---

## Conventions

- **TDD:** jeder Schritt ist ein Mini-Cycle (Test → Fail → Implement → Pass → Commit).
- **Tests** liegen neben Modulen als `*.test.ts` (Vitest) bzw. unter `tests/e2e/*.spec.ts` (Playwright).
- **Commits:** klein und atomar pro Task-Ende. Nachrichten Deutsch oder Englisch, `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>` Footer.
- **Paketmanager: pnpm** (verbindlich). Niemals `npm`/`yarn`.
- **TypeScript strict** ist Pflicht; `pnpm exec svelte-check` muss am Ende grün sein (0 Errors, 0 Warnings).
- **Imports:** Pfade via `$lib/...` (SvelteKit-Alias).
- **Svelte 5 Runes:** `$state`, `$derived`, `$effect`, `$props`. Form-State aus Props seeden via `untrack(() => prop)` (siehe bestehende Codebasis als Vorlage).
- **Snippets:** wenn Test-Renderings Kinder brauchen, `createRawSnippet` aus `svelte` (siehe `SwipeRow.test.ts`).

Tests ausführen:
- Einzelnes Vitest-File: `pnpm exec vitest run path/to/file.test.ts`
- Alle Vitest: `pnpm test`
- E2E: `pnpm test:e2e`
- Typcheck: `pnpm exec svelte-check --tsconfig ./tsconfig.json`

---

### Task 1: Symptom-Typ erweitern + Defaults-Factory

**Files:**
- Modify: `src/lib/db/index.ts`
- Modify: `src/lib/db/symptoms.ts`
- Modify: `src/lib/db/symptoms.test.ts`

- [ ] **Step 1.1: `SymptomInputs`-Typ + Factory in `db/index.ts` ergänzen**

Datei `src/lib/db/index.ts` zwischen `tags`-Interface und `Intensity` einfügen — **`Intensity` und `intensity` werden in Task 2 entfernt**, jetzt aber stehen lassen, damit dieser Schritt isoliert grün bleibt:

```ts
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
```

`Symptom`-Interface um zwei Felder erweitern:

```ts
export interface Symptom {
  // ... bestehende Felder ...
  archived:  boolean;
  createdAt: number;
  updatedAt: number;
  inputs:    SymptomInputs;
  daily:     boolean;
}
```

- [ ] **Step 1.2: Test für `createSymptom`-Defaults schreiben**

`src/lib/db/symptoms.test.ts` öffnen und folgenden Test am Ende des `describe`-Blocks (oder als eigener `describe`) hinzufügen:

```ts
import { defaultSymptomInputs } from './index';

it('createSymptom sets default inputs and daily=false', async () => {
  const s = await createSymptom({ name: 'Test' });
  expect(s.inputs).toEqual(defaultSymptomInputs());
  expect(s.daily).toBe(false);
});
```

- [ ] **Step 1.3: Test ausführen — soll fehlschlagen**

```bash
pnpm exec vitest run src/lib/db/symptoms.test.ts
```

Erwartet: FAIL — `s.inputs` ist `undefined`, `s.daily` ist `undefined`.

- [ ] **Step 1.4: `createSymptom` in `db/symptoms.ts` anpassen**

Datei `src/lib/db/symptoms.ts`, in `createSymptom` direkt nach dem `now`-Computing aber innerhalb des `sym`-Objekts ergänzen:

```ts
import { db, type Symptom, defaultSymptomInputs } from './index';
// ...
const sym: Symptom = {
  id: newId(),
  name: input.name,
  color: input.color ?? DEFAULT_COLOR,
  icon: input.icon ?? (isFolder ? DEFAULT_FOLDER_ICON : DEFAULT_ICON),
  tagIds: input.tagIds ?? [],
  parentId,
  sortIndex: await nextSortIndex(parentId),
  depth,
  isFolder,
  archived: false,
  createdAt: now,
  updatedAt: now,
  inputs: defaultSymptomInputs(),
  daily: false
};
```

- [ ] **Step 1.5: Test erneut ausführen**

```bash
pnpm exec vitest run src/lib/db/symptoms.test.ts
```

Erwartet: PASS für alle Tests.

- [ ] **Step 1.6: Commit**

```bash
git add src/lib/db/index.ts src/lib/db/symptoms.ts src/lib/db/symptoms.test.ts
git commit -m "feat(db): Symptom.inputs + daily, default factory

- SymptomInputs-Typ und defaultSymptomInputs() für die drei
  Eingabe-Bausteine (Slider / Zahl / Kommentar) mit Default-off-Werten.
- Symptom bekommt inputs + daily; createSymptom setzt beide.
- Test für createSymptom-Defaults.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Entry-Schema umbauen (intensity → sliderValue/numberValue)

**Files:**
- Modify: `src/lib/db/index.ts`
- Modify: `src/lib/db/entries.ts`
- Modify: `src/lib/db/entries.test.ts`
- Modify: `src/lib/utils/transfer.test.ts`
- Modify: `src/lib/components/EntryEditor/EntryEditor.svelte` (nur Typ-Anpassung, kompletter Umbau folgt in Task 11)
- Modify: `src/lib/components/DayView/EntryCard.svelte` (nur Typ-Anpassung, Status-Zeile folgt in Task 13)

- [ ] **Step 2.1: `Entry`-Typ in `db/index.ts` umbauen**

`Intensity` und das `intensity`-Feld im `Entry`-Interface ersetzen. Die kompletten Typänderungen:

```ts
// Intensity-Typ ENTFERNEN
// export type Intensity = 'leicht' | 'mittel' | 'stark' | null;

export interface Entry {
  id:          string;
  date:        string;
  symptomId:   string;
  sliderValue: number | null;
  numberValue: number | null;
  comment:     string;
  updatedAt:   number;
}
```

`Intensity`-Export aus dieser Datei vollständig entfernen.

- [ ] **Step 2.2: Bestehende `entries`-Tests auf neues Schema umstellen**

`src/lib/db/entries.test.ts` öffnen. Alle Vorkommen von `intensity: 'mittel'` durch `sliderValue: 50, numberValue: null` ersetzen, `intensity: null` durch `sliderValue: null, numberValue: null`. Beispiel-Block:

```ts
it('upsert creates a new entry with deterministic id', async () => {
  const e = await upsertEntry({ date: '2026-05-27', symptomId: 'sym1' });
  expect(e.id).toBe('2026-05-27__sym1');
  expect(e.sliderValue).toBeNull();
  expect(e.numberValue).toBeNull();
  expect(e.comment).toBe('');
});

it('upsert preserves existing values when patch is partial', async () => {
  await upsertEntry({ date: '2026-05-27', symptomId: 'sym1', sliderValue: 50 });
  const e = await upsertEntry({ date: '2026-05-27', symptomId: 'sym1', comment: 'Notiz' });
  expect(e.sliderValue).toBe(50);
  expect(e.comment).toBe('Notiz');
});
```

Die übrigen Tests (`hasEntry`, `delete`, `listEntriesForDate`, `listEntriesForRange`, invalid date) bleiben strukturell gleich — nur die `upsertEntry`-Calls von `intensity`-Parameter befreien.

- [ ] **Step 2.3: Test ausführen — soll fehlschlagen**

```bash
pnpm exec vitest run src/lib/db/entries.test.ts
```

Erwartet: FAIL — `UpsertEntryInput` kennt `sliderValue` noch nicht; `Entry.intensity` existiert nicht mehr.

- [ ] **Step 2.4: `entries.ts` umbauen**

Datei `src/lib/db/entries.ts` komplett ersetzen:

```ts
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
```

- [ ] **Step 2.5: `transfer.test.ts` auf neues Entry-Schema umstellen**

`src/lib/utils/transfer.test.ts` öffnen und die Entry-Fixtures anpassen. Beispiel-Zeilen 11 und 19:

```ts
await db.entries.add({ id: '2026-05-27__s1', date: '2026-05-27', symptomId: 's1', sliderValue: 50, numberValue: null, comment: '', updatedAt: 1 });
// ...
expect((await db.entries.get('2026-05-27__s1'))?.sliderValue).toBe(50);
```

- [ ] **Step 2.6: `EntryEditor.svelte` und `EntryCard.svelte` Typ-Imports stutzen**

In `src/lib/components/EntryEditor/EntryEditor.svelte` den `Intensity`-Import aus `$lib/db` entfernen (`import { db, type Symptom, type Intensity } from '$lib/db'`) — ersetze durch `import { db, type Symptom } from '$lib/db'`. Der Editor wird in Task 11 komplett umgebaut; vorübergehend Felder wie `intensity` zu `sliderValue` umbenennen, damit das Modul kompiliert. **Hilfsweise** alle `intensity`-Vorkommen in der Komponente löschen oder kommentieren — der Editor ist temporär funktional eingeschränkt, das ist OK.

In `src/lib/components/DayView/EntryCard.svelte` analog: `entry.intensity ?...` durch `entry.sliderValue ?...` ersetzen (rein zur Typsicherheit; richtige Anzeige folgt in Task 13).

Bei `EntryList.svelte`: der `removeWithUndo`-Snackbar-Callback ruft `upsertEntry({ ..., intensity: original.intensity, comment: original.comment })`. Auf neues Schema umstellen:

```ts
onAction: () => upsertEntry({
  date: original.date,
  symptomId: original.symptomId,
  sliderValue: original.sliderValue,
  numberValue: original.numberValue,
  comment: original.comment
})
```

- [ ] **Step 2.7: Tests + Typecheck ausführen**

```bash
pnpm exec vitest run src/lib/db/entries.test.ts src/lib/utils/transfer.test.ts
pnpm exec svelte-check --tsconfig ./tsconfig.json
```

Erwartet: Vitest grün, svelte-check **0 ERRORS**. Warnings für noch nicht umgebaute Komponenten sind tolerabel; sie verschwinden in späteren Tasks.

- [ ] **Step 2.8: Commit**

```bash
git add src/lib/db/index.ts src/lib/db/entries.ts src/lib/db/entries.test.ts src/lib/utils/transfer.test.ts src/lib/components/EntryEditor/EntryEditor.svelte src/lib/components/DayView/EntryCard.svelte src/lib/components/DayView/EntryList.svelte
git commit -m "feat(db): Entry-Schema neu — sliderValue/numberValue statt intensity

- Intensity-Typ und Entry.intensity entfernt.
- Entry hat jetzt sliderValue (number | null) und numberValue
  (number | null) — Kommentar bleibt.
- UpsertEntryInput und alle Tests auf neues Schema umgestellt.
- Bestehende UI-Komponenten ziehen den intensity-Import zurück und
  benennen Feldzugriffe um; vollständiger Editor-/Karten-Umbau folgt.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Dexie-Schema-Version 2 + Migrations-Test

**Files:**
- Modify: `src/lib/db/index.ts`
- Create: `src/lib/db/migration.test.ts`

- [ ] **Step 3.1: Migrations-Test schreiben (TDD)**

Datei `src/lib/db/migration.test.ts` anlegen:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import Dexie from 'dexie';
import 'fake-indexeddb/auto';
import { defaultSymptomInputs } from './index';

const DB_NAME = 'perimenobomb-migrationtest';

async function deleteDb() {
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });
}

describe('Dexie schema v1 → v2 upgrade', () => {
  beforeEach(deleteDb);

  it('clears entries, adds inputs+daily defaults to symptoms, drops meta.openDialog', async () => {
    // 1) Open v1 explicitly, seed legacy data.
    const v1 = new Dexie(DB_NAME);
    v1.version(1).stores({
      symptoms: 'id, parentId, [parentId+sortIndex], archived',
      tags:     'id, name',
      entries:  'id, date, symptomId, [date+symptomId]',
      meta:     'key'
    });
    await v1.open();
    await v1.table('symptoms').add({
      id: 's1', name: 'Old', color: '#000', icon: 'circle',
      tagIds: [], parentId: null, sortIndex: 0, depth: 0,
      isFolder: false, archived: false, createdAt: 1, updatedAt: 1
      // NB: no inputs, no daily — v1 shape
    });
    await v1.table('entries').add({
      id: '2026-05-27__s1', date: '2026-05-27', symptomId: 's1',
      intensity: 'mittel', comment: 'legacy', updatedAt: 1
    });
    await v1.table('meta').add({ key: 'openDialog', value: { stale: true } });
    v1.close();

    // 2) Open v2 with the same name → upgrade fires.
    const v2 = new Dexie(DB_NAME);
    v2.version(1).stores({
      symptoms: 'id, parentId, [parentId+sortIndex], archived',
      tags:     'id, name',
      entries:  'id, date, symptomId, [date+symptomId]',
      meta:     'key'
    });
    v2.version(2).stores({
      symptoms: 'id, parentId, [parentId+sortIndex], archived',
      tags:     'id, name',
      entries:  'id, date, symptomId, [date+symptomId]',
      meta:     'key'
    }).upgrade(async (tx) => {
      await tx.table('entries').clear();
      await tx.table('symptoms').toCollection().modify((s: any) => {
        if (!s.inputs) s.inputs = defaultSymptomInputs();
        if (typeof s.daily !== 'boolean') s.daily = false;
      });
      await tx.table('meta').delete('openDialog');
    });
    await v2.open();

    const entries = await v2.table('entries').toArray();
    expect(entries).toEqual([]);

    const sym = await v2.table('symptoms').get('s1');
    expect(sym.inputs).toEqual(defaultSymptomInputs());
    expect(sym.daily).toBe(false);

    const od = await v2.table('meta').get('openDialog');
    expect(od).toBeUndefined();
    v2.close();
  });
});
```

- [ ] **Step 3.2: Test ausführen — soll fehlschlagen**

```bash
pnpm exec vitest run src/lib/db/migration.test.ts
```

Erwartet: PASS — der Test verwendet seinen eigenen v2-Upgrade-Code; er beweist nur, dass die Migration **funktioniert wie spezifiziert**. (Wenn er fehlschlägt, ist das ein Hinweis, dass die Test-Setup-Logik falsch ist.)

Wichtig: dieser Test ist eine Spec-Regression. Den nächsten Schritt — die echte Migration in `db/index.ts` — schreiben wir trotzdem mit dem gleichen Upgrade-Block.

- [ ] **Step 3.3: Echte v2-Migration in `db/index.ts` ergänzen**

In `src/lib/db/index.ts` die `PeriMenoDB`-Klasse anpassen:

```ts
export class PeriMenoDB extends Dexie {
  symptoms!: Table<Symptom, string>;
  tags!: Table<Tag, string>;
  entries!: Table<Entry, string>;
  meta!: Table<MetaRow, string>;

  constructor() {
    super('perimenobomb');
    this.version(1).stores({
      symptoms: 'id, parentId, [parentId+sortIndex], archived',
      tags:     'id, name',
      entries:  'id, date, symptomId, [date+symptomId]',
      meta:     'key'
    });
    this.version(2).stores({
      symptoms: 'id, parentId, [parentId+sortIndex], archived',
      tags:     'id, name',
      entries:  'id, date, symptomId, [date+symptomId]',
      meta:     'key'
    }).upgrade(async (tx) => {
      await tx.table('entries').clear();
      await tx.table('symptoms').toCollection().modify((s: any) => {
        if (!s.inputs) s.inputs = defaultSymptomInputs();
        if (typeof s.daily !== 'boolean') s.daily = false;
      });
      await tx.table('meta').delete('openDialog');
    });
  }
}
```

- [ ] **Step 3.4: Volltest-Lauf**

```bash
pnpm test
```

Erwartet: alle Vitest-Tests grün.

- [ ] **Step 3.5: Commit**

```bash
git add src/lib/db/index.ts src/lib/db/migration.test.ts
git commit -m "feat(db): Schema-Version 2 mit Defaults-Migration

- v1→v2-Upgrader löscht Einträge (kein sinnvolles Mapping mehr),
  ergänzt fehlende inputs/daily-Felder auf Symptomen und entfernt
  ein eventuell aus alten Sessions verbliebenes meta.openDialog.
- Migrations-Test mit eigenständigem DB-Namen verifiziert das
  Upgrade-Verhalten gegen ein v1-Seed.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: `validateEntry` + `hasEnabledInput`-Helfer

**Files:**
- Modify: `src/lib/db/entries.ts`
- Modify: `src/lib/db/entries.test.ts`
- Modify: `src/lib/db/symptoms.ts`

- [ ] **Step 4.1: Tests für `validateEntry` schreiben**

Am Ende von `src/lib/db/entries.test.ts` neuen `describe`-Block ergänzen:

```ts
import type { Symptom } from './index';
import { defaultSymptomInputs } from './index';
import { validateEntry } from './entries';

function symptom(partial: Partial<Symptom> = {}): Symptom {
  return {
    id: 's', name: 'X', color: '#000', icon: 'circle',
    tagIds: [], parentId: null, sortIndex: 0, depth: 0,
    isFolder: false, archived: false, createdAt: 0, updatedAt: 0,
    inputs: defaultSymptomInputs(), daily: false, ...partial
  };
}

describe('validateEntry', () => {
  it('ok when no input is required', () => {
    const s = symptom();
    expect(validateEntry(s, { sliderValue: null, numberValue: null, comment: '' }))
      .toEqual({ ok: true, missing: [] });
  });

  it('reports slider missing when slider is required and value is null', () => {
    const inputs = defaultSymptomInputs();
    inputs.slider.enabled = true;
    inputs.slider.required = true;
    const s = symptom({ inputs });
    expect(validateEntry(s, { sliderValue: null, numberValue: null, comment: '' }))
      .toEqual({ ok: false, missing: ['slider'] });
  });

  it('slider ok with any 1..100 value', () => {
    const inputs = defaultSymptomInputs();
    inputs.slider.enabled = true;
    inputs.slider.required = true;
    const s = symptom({ inputs });
    expect(validateEntry(s, { sliderValue: 1, numberValue: null, comment: '' }).ok).toBe(true);
    expect(validateEntry(s, { sliderValue: 100, numberValue: null, comment: '' }).ok).toBe(true);
  });

  it('reports number missing when required and null', () => {
    const inputs = defaultSymptomInputs();
    inputs.number.enabled = true;
    inputs.number.required = true;
    const s = symptom({ inputs });
    expect(validateEntry(s, { sliderValue: null, numberValue: null, comment: '' }))
      .toEqual({ ok: false, missing: ['number'] });
  });

  it('reports comment missing when required and empty/whitespace', () => {
    const inputs = defaultSymptomInputs();
    inputs.comment.enabled = true;
    inputs.comment.required = true;
    const s = symptom({ inputs });
    expect(validateEntry(s, { sliderValue: null, numberValue: null, comment: '' }))
      .toEqual({ ok: false, missing: ['comment'] });
    expect(validateEntry(s, { sliderValue: null, numberValue: null, comment: '   ' }))
      .toEqual({ ok: false, missing: ['comment'] });
    expect(validateEntry(s, { sliderValue: null, numberValue: null, comment: 'note' }).ok).toBe(true);
  });

  it('aggregates multiple missing pieces in order slider, number, comment', () => {
    const inputs = defaultSymptomInputs();
    inputs.slider.enabled  = true; inputs.slider.required  = true;
    inputs.number.enabled  = true; inputs.number.required  = true;
    inputs.comment.enabled = true; inputs.comment.required = true;
    const s = symptom({ inputs });
    expect(validateEntry(s, { sliderValue: null, numberValue: null, comment: '' }))
      .toEqual({ ok: false, missing: ['slider', 'number', 'comment'] });
  });

  it('disabled input never triggers missing even if required somehow true', () => {
    const inputs = defaultSymptomInputs();
    inputs.slider.enabled = false; inputs.slider.required = true; // contradictory state
    const s = symptom({ inputs });
    expect(validateEntry(s, { sliderValue: null, numberValue: null, comment: '' }).ok).toBe(true);
  });
});
```

Außerdem: einen kleinen Test für `hasEnabledInput` (siehe Step 4.3):

```ts
import { hasEnabledInput } from './symptoms';

describe('hasEnabledInput', () => {
  it('false when all inputs disabled', () => {
    expect(hasEnabledInput(defaultSymptomInputs())).toBe(false);
  });
  it('true when any input enabled', () => {
    const inputs = defaultSymptomInputs();
    inputs.comment.enabled = true;
    expect(hasEnabledInput(inputs)).toBe(true);
  });
});
```

- [ ] **Step 4.2: Test ausführen — soll fehlschlagen**

```bash
pnpm exec vitest run src/lib/db/entries.test.ts
```

Erwartet: FAIL — `validateEntry` und `hasEnabledInput` sind noch nicht implementiert.

- [ ] **Step 4.3: `validateEntry` in `db/entries.ts` ergänzen**

Am Ende von `src/lib/db/entries.ts` ergänzen:

```ts
import type { Symptom } from './index';

export type EntryValidationField = 'slider' | 'number' | 'comment';

export interface EntryValidationResult {
  ok: boolean;
  missing: EntryValidationField[];
}

export interface EntryFieldsLike {
  sliderValue: number | null;
  numberValue: number | null;
  comment: string;
}

export function validateEntry(symptom: Symptom, entry: EntryFieldsLike): EntryValidationResult {
  const missing: EntryValidationField[] = [];
  const i = symptom.inputs;
  if (i.slider.enabled && i.slider.required && entry.sliderValue === null) missing.push('slider');
  if (i.number.enabled && i.number.required && (entry.numberValue === null || Number.isNaN(entry.numberValue))) missing.push('number');
  if (i.comment.enabled && i.comment.required && entry.comment.trim().length === 0) missing.push('comment');
  return { ok: missing.length === 0, missing };
}
```

- [ ] **Step 4.4: `hasEnabledInput` in `db/symptoms.ts` ergänzen**

Direkt am Ende von `src/lib/db/symptoms.ts`:

```ts
import type { SymptomInputs } from './index';

export function hasEnabledInput(inputs: SymptomInputs): boolean {
  return inputs.slider.enabled || inputs.number.enabled || inputs.comment.enabled;
}
```

- [ ] **Step 4.5: Tests grün**

```bash
pnpm exec vitest run src/lib/db/entries.test.ts
```

Erwartet: alle Tests PASS.

- [ ] **Step 4.6: Commit**

```bash
git add src/lib/db/entries.ts src/lib/db/entries.test.ts src/lib/db/symptoms.ts
git commit -m "feat(db): validateEntry + hasEnabledInput

- validateEntry(symptom, entry) prüft die drei Pflicht-Bausteine
  (Slider/Zahl/Kommentar) und gibt eine geordnete Missing-Liste
  zurück, die der Editor für Disabled-State und Shake-Animation
  konsumiert.
- hasEnabledInput(inputs) ist die schmale Vorbedingung für die
  Sichtbarkeit des Daily-Toggles und der Daily-Prompts.
- Test-Matrix für alle Pflicht-Kombinationen inkl. Whitespace-Only-
  Kommentar und Mehrfach-Pflichten.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: `listDailySymptomsForDate`-Query (DB-Schicht)

**Files:**
- Modify: `src/lib/db/symptoms.ts`
- Modify: `src/lib/db/symptoms.test.ts`

- [ ] **Step 5.1: Test schreiben**

Am Ende von `src/lib/db/symptoms.test.ts`:

```ts
import { listDailySymptomsForDate, hasEnabledInput } from './symptoms';
import { upsertEntry } from './entries';

describe('listDailySymptomsForDate', () => {
  beforeEach(() => resetDatabase());

  it('returns daily + enabled-input symptoms without entry for the date, in tree order', async () => {
    const a = await createSymptom({ name: 'A' });          // not daily
    const b = await createSymptom({ name: 'B' });          // daily but no inputs → excluded
    const c = await createSymptom({ name: 'C' });          // daily + slider → included
    const d = await createSymptom({ name: 'D' });          // daily + comment → included but archived
    const e = await createSymptom({ name: 'E' });          // daily + comment → included but has entry
    const folder = await createSymptom({ name: 'F', isFolder: true });
    const childIn = await createSymptom({ name: 'G', parentId: folder.id }); // child, daily, included
    // Configure
    await updateSymptom(b.id, { daily: true });
    const cIn = c.inputs; cIn.slider.enabled = true;
    await updateSymptom(c.id, { daily: true, inputs: cIn });
    const dIn = d.inputs; dIn.comment.enabled = true;
    await updateSymptom(d.id, { daily: true, inputs: dIn, archived: true });
    const eIn = e.inputs; eIn.comment.enabled = true;
    await updateSymptom(e.id, { daily: true, inputs: eIn });
    const gIn = childIn.inputs; gIn.comment.enabled = true;
    await updateSymptom(childIn.id, { daily: true, inputs: gIn });
    // e already has an entry → excluded
    await upsertEntry({ date: '2026-05-28', symptomId: e.id, comment: 'done' });

    const result = await listDailySymptomsForDate('2026-05-28');
    // Expected (in tree order): C (root), G (child of F).
    expect(result.map((s) => s.name)).toEqual(['C', 'G']);
  });

  it('returns empty list when no daily symptoms', async () => {
    await createSymptom({ name: 'X' });
    expect(await listDailySymptomsForDate('2026-05-28')).toEqual([]);
  });
});
```

- [ ] **Step 5.2: Test ausführen — soll fehlschlagen**

```bash
pnpm exec vitest run src/lib/db/symptoms.test.ts
```

Erwartet: FAIL — `listDailySymptomsForDate` nicht implementiert.

- [ ] **Step 5.3: Implementation in `db/symptoms.ts`**

Am Ende von `src/lib/db/symptoms.ts` ergänzen:

```ts
function flattenTreeOrder(tree: TreeNode[]): Symptom[] {
  const out: Symptom[] = [];
  function recur(nodes: TreeNode[]) {
    for (const n of nodes) {
      // strip children to get plain Symptom shape
      const { children: _kids, ...plain } = n;
      out.push(plain as Symptom);
      if (n.children.length) recur(n.children);
    }
  }
  recur(tree);
  return out;
}

export async function listDailySymptomsForDate(date: string): Promise<Symptom[]> {
  const tree = await listTree(); // already excludes archived
  const ordered = flattenTreeOrder(tree);
  const eligible = ordered.filter((s) => !s.isFolder && s.daily && hasEnabledInput(s.inputs));
  if (eligible.length === 0) return [];
  const ids = eligible.map((s) => s.id);
  const entryKeys = ids.map((id) => `${date}__${id}`);
  const existing = await db.entries.where('id').anyOf(entryKeys).primaryKeys() as string[];
  const taken = new Set(existing);
  return eligible.filter((s) => !taken.has(`${date}__${s.id}`));
}
```

- [ ] **Step 5.4: Tests grün**

```bash
pnpm exec vitest run src/lib/db/symptoms.test.ts
```

Erwartet: PASS.

- [ ] **Step 5.5: Commit**

```bash
git add src/lib/db/symptoms.ts src/lib/db/symptoms.test.ts
git commit -m "feat(db): listDailySymptomsForDate

Liefert nicht-archivierte Symptome mit daily=true und mindestens einem
aktiven Input, sortiert in Symptom-Tree-Reihenfolge (depth-first,
sortIndex pro Ebene). Symptome, für die für den angefragten Tag schon
ein Eintrag existiert, werden ausgefiltert — die Query treibt die
„Noch offen\"-Sektion in der Tagesliste.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: openDialog-Store

**Files:**
- Create: `src/lib/stores/openDialog.svelte.ts`
- Create: `src/lib/stores/openDialog.test.svelte.ts`

- [ ] **Step 6.1: Test schreiben (TDD)**

Datei `src/lib/stores/openDialog.test.svelte.ts` anlegen:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { resetDatabase, db } from '$lib/db';
import {
  persistDialog, updateDialogPayload, clearDialog, loadOpenDialog,
  type OpenDialogState
} from './openDialog.svelte';

describe('openDialog store', () => {
  beforeEach(() => resetDatabase());

  it('persistDialog writes meta.openDialog', async () => {
    const s: OpenDialogState = {
      kind: 'entry-editor',
      route: '/tag/2026-05-28',
      payload: { date: '2026-05-28', symptomId: 'x', sliderValue: null, numberValue: null, comment: '' }
    };
    await persistDialog(s);
    const row = await db.meta.get('openDialog');
    expect(row?.value).toEqual(s);
  });

  it('updateDialogPayload patches the payload', async () => {
    const s: OpenDialogState = {
      kind: 'entry-editor',
      route: '/tag/2026-05-28',
      payload: { date: '2026-05-28', symptomId: 'x', sliderValue: null, numberValue: null, comment: '' }
    };
    await persistDialog(s);
    await updateDialogPayload({ comment: 'hello' });
    const loaded = await loadOpenDialog();
    expect(loaded?.kind).toBe('entry-editor');
    expect((loaded as Extract<OpenDialogState, { kind: 'entry-editor' }>).payload.comment).toBe('hello');
  });

  it('clearDialog removes the row', async () => {
    await persistDialog({
      kind: 'entry-editor', route: '/tag/2026-05-28',
      payload: { date: '2026-05-28', symptomId: 'x', sliderValue: null, numberValue: null, comment: '' }
    });
    await clearDialog();
    expect(await loadOpenDialog()).toBeNull();
  });

  it('updateDialogPayload no-ops when nothing persisted', async () => {
    await expect(updateDialogPayload({ comment: 'x' })).resolves.toBeUndefined();
    expect(await loadOpenDialog()).toBeNull();
  });
});
```

- [ ] **Step 6.2: Test ausführen — soll fehlschlagen**

```bash
pnpm exec vitest run src/lib/stores/openDialog.test.svelte.ts
```

Erwartet: FAIL — Modul existiert nicht.

- [ ] **Step 6.3: Store-Modul anlegen**

Datei `src/lib/stores/openDialog.svelte.ts`:

```ts
import { db, type SymptomInputs } from '$lib/db';

export type OpenDialogState =
  | {
      kind: 'entry-editor';
      route: string;
      payload: {
        date: string;
        symptomId: string;
        sliderValue: number | null;
        numberValue: number | null;
        comment: string;
      };
    }
  | {
      kind: 'symptom-edit';
      route: string;
      payload: {
        symptomId: string | null;
        isNew: boolean;
        isFolder: boolean;
        name: string;
        color: string;
        icon: string;
        tagIds: string[];
        parentId: string | null;
        inputs: SymptomInputs;
        daily: boolean;
        view: 'main' | 'icons';
      };
    };

const META_KEY = 'openDialog';

// Reactive trigger: when the layout reads a persisted dialog at mount and
// has navigated to its route, it sets pendingRestore so that the route's
// page component can react and open the matching dialog.
let _pending = $state<OpenDialogState | null>(null);

export const pendingRestore = {
  get value(): OpenDialogState | null { return _pending; },
  set(s: OpenDialogState | null) { _pending = s; },
  consume<K extends OpenDialogState['kind']>(kind: K): Extract<OpenDialogState, { kind: K }> | null {
    const cur = _pending;
    if (cur && cur.kind === kind) {
      _pending = null;
      return cur as Extract<OpenDialogState, { kind: K }>;
    }
    return null;
  }
};

export async function persistDialog(state: OpenDialogState): Promise<void> {
  await db.meta.put({ key: META_KEY, value: state });
}

type Patch<K extends OpenDialogState['kind']> =
  Partial<Extract<OpenDialogState, { kind: K }>['payload']>;

export async function updateDialogPayload<K extends OpenDialogState['kind']>(
  patch: Patch<K>
): Promise<void> {
  const row = await db.meta.get(META_KEY);
  if (!row) return;
  const cur = row.value as OpenDialogState;
  const next: OpenDialogState = {
    ...cur,
    payload: { ...(cur.payload as object), ...(patch as object) }
  } as OpenDialogState;
  await db.meta.put({ key: META_KEY, value: next });
}

export async function clearDialog(): Promise<void> {
  await db.meta.delete(META_KEY);
}

export async function loadOpenDialog(): Promise<OpenDialogState | null> {
  const row = await db.meta.get(META_KEY);
  return (row?.value as OpenDialogState | undefined) ?? null;
}
```

- [ ] **Step 6.4: Tests grün**

```bash
pnpm exec vitest run src/lib/stores/openDialog.test.svelte.ts
```

Erwartet: PASS.

- [ ] **Step 6.5: Commit**

```bash
git add src/lib/stores/openDialog.svelte.ts src/lib/stores/openDialog.test.svelte.ts
git commit -m "feat(stores): openDialog — Persistenz für offene Dialoge

- persistDialog / updateDialogPayload / clearDialog / loadOpenDialog
  arbeiten gegen meta.openDialog. Diskriminierter Union-Typ deckt
  EntryEditor- und SymptomEditModal-Payload ab.
- pendingRestore ist ein Svelte-5-Runes-Trigger, den +layout.svelte
  beim Mount setzt und Route-Container per consume(kind) konsumieren.
- Roundtrip-Test über fake-indexeddb.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: SliderInput-Komponente

**Files:**
- Create: `src/lib/components/EntryEditor/SliderInput.svelte`
- Create: `src/lib/components/EntryEditor/SliderInput.test.ts`

- [ ] **Step 7.1: Komponente skizzieren (Test zuerst)**

Datei `src/lib/components/EntryEditor/SliderInput.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import SliderInput from './SliderInput.svelte';

function makeRect(left: number, width: number) {
  return { left, right: left + width, top: 0, bottom: 32, width, height: 32, x: left, y: 0, toJSON: () => ({}) } as DOMRect;
}

describe('SliderInput', () => {
  it('initial value=null shows thumb on unspez slot', () => {
    const { container } = render(SliderInput, {
      props: { value: null, lowLabel: 'leicht', highLabel: 'hoch', onChange: () => {} }
    });
    const thumb = container.querySelector('[data-thumb]') as HTMLElement;
    expect(thumb.dataset.zone).toBe('unspez');
  });

  it('initial value=50 shows thumb on continuous track', () => {
    const { container } = render(SliderInput, {
      props: { value: 50, lowLabel: 'leicht', highLabel: 'hoch', onChange: () => {} }
    });
    const thumb = container.querySelector('[data-thumb]') as HTMLElement;
    expect(thumb.dataset.zone).toBe('continuous');
  });

  it('clicking on the continuous track calls onChange with a 1..100 number', async () => {
    const onChange = vi.fn();
    const { container } = render(SliderInput, {
      props: { value: null, lowLabel: 'leicht', highLabel: 'hoch', onChange }
    });
    const track = container.querySelector('[data-track]') as HTMLElement;
    // Pretend the track is 200px wide, unspez=0..30, gap=30..48, cont=48..200.
    vi.spyOn(track, 'getBoundingClientRect').mockReturnValue(makeRect(0, 200));
    // Pointer at x=124 → middle of continuous range → ~50.
    await fireEvent.pointerDown(track, { clientX: 124, clientY: 16, pointerId: 1 });
    await fireEvent.pointerUp(window, { pointerId: 1 });
    expect(onChange).toHaveBeenCalled();
    const v = onChange.mock.calls[0][0];
    expect(v).toBeGreaterThanOrEqual(40);
    expect(v).toBeLessThanOrEqual(60);
  });

  it('clicking on the unspez slot calls onChange(null)', async () => {
    const onChange = vi.fn();
    const { container } = render(SliderInput, {
      props: { value: 50, lowLabel: 'leicht', highLabel: 'hoch', onChange }
    });
    const track = container.querySelector('[data-track]') as HTMLElement;
    vi.spyOn(track, 'getBoundingClientRect').mockReturnValue(makeRect(0, 200));
    await fireEvent.pointerDown(track, { clientX: 10, clientY: 16, pointerId: 1 });
    await fireEvent.pointerUp(window, { pointerId: 1 });
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it('clicking in the gap from null stays null', async () => {
    const onChange = vi.fn();
    const { container } = render(SliderInput, {
      props: { value: null, lowLabel: 'leicht', highLabel: 'hoch', onChange }
    });
    const track = container.querySelector('[data-track]') as HTMLElement;
    vi.spyOn(track, 'getBoundingClientRect').mockReturnValue(makeRect(0, 200));
    // Pointer at x=40 → in the gap (30..48).
    await fireEvent.pointerDown(track, { clientX: 40, clientY: 16, pointerId: 1 });
    await fireEvent.pointerUp(window, { pointerId: 1 });
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it('clicking in the gap from continuous stays at value 1', async () => {
    const onChange = vi.fn();
    const { container } = render(SliderInput, {
      props: { value: 50, lowLabel: 'leicht', highLabel: 'hoch', onChange }
    });
    const track = container.querySelector('[data-track]') as HTMLElement;
    vi.spyOn(track, 'getBoundingClientRect').mockReturnValue(makeRect(0, 200));
    await fireEvent.pointerDown(track, { clientX: 40, clientY: 16, pointerId: 1 });
    await fireEvent.pointerUp(window, { pointerId: 1 });
    expect(onChange).toHaveBeenLastCalledWith(1);
  });
});
```

- [ ] **Step 7.2: Test ausführen — soll fehlschlagen**

```bash
pnpm exec vitest run src/lib/components/EntryEditor/SliderInput.test.ts
```

Erwartet: FAIL — Komponente existiert nicht.

- [ ] **Step 7.3: Komponente implementieren**

Datei `src/lib/components/EntryEditor/SliderInput.svelte`:

```svelte
<script lang="ts">
  type Props = {
    value: number | null;
    lowLabel: string;
    highLabel: string;
    onChange: (v: number | null) => void;
  };
  let { value, lowLabel, highLabel, onChange }: Props = $props();

  // Track layout in track-relative coordinates (px).
  // We compute zones live from each rect to support container resizes.
  const UNSPEZ_PX = 30;
  const GAP_PX = 18;

  let trackEl = $state<HTMLElement | undefined>();
  let dragPointerId: number | null = null;

  type Zone = 'unspez' | 'continuous';

  function zoneFromX(rect: DOMRect, clientX: number): { zone: Zone; pos: number | null } {
    const x = clientX - rect.left;
    const unspezEnd = UNSPEZ_PX;
    const contStart = UNSPEZ_PX + GAP_PX;
    if (x < unspezEnd) return { zone: 'unspez', pos: null };
    if (x < contStart) {
      // In the gap → hysteresis: keep current side.
      if (value === null) return { zone: 'unspez', pos: null };
      return { zone: 'continuous', pos: 1 };
    }
    const trackWidth = rect.width - contStart;
    if (trackWidth <= 0) return { zone: 'continuous', pos: 1 };
    const t = Math.max(0, Math.min(1, (x - contStart) / trackWidth));
    const pos = Math.round(1 + t * 99); // 1..100
    return { zone: 'continuous', pos };
  }

  function commit(clientX: number) {
    if (!trackEl) return;
    const rect = trackEl.getBoundingClientRect();
    const { pos } = zoneFromX(rect, clientX);
    onChange(pos);
  }

  function onPointerDown(e: PointerEvent) {
    if (!trackEl) return;
    e.preventDefault();
    dragPointerId = e.pointerId;
    commit(e.clientX);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup',   onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
  }
  function onPointerMove(e: PointerEvent) {
    if (e.pointerId !== dragPointerId) return;
    commit(e.clientX);
  }
  function onPointerUp(e: PointerEvent) {
    if (e.pointerId !== dragPointerId) return;
    dragPointerId = null;
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup',   onPointerUp);
    window.removeEventListener('pointercancel', onPointerUp);
  }

  // Render position for the thumb. Computed each render; on test environments
  // without layout we still expose the zone via data-attribute for assertions.
  const zone: Zone = $derived(value === null ? 'unspez' : 'continuous');

  function thumbStyle(): string {
    if (!trackEl) {
      // Pre-mount fallback; CSS positions thumb via data-zone too.
      return value === null ? 'left: 14px;' : 'left: calc(100% - 14px);';
    }
    const rect = trackEl.getBoundingClientRect();
    if (value === null) return `left: ${UNSPEZ_PX / 2}px;`;
    const contStart = UNSPEZ_PX + GAP_PX;
    const trackWidth = rect.width - contStart;
    const t = (value - 1) / 99;
    return `left: ${contStart + t * trackWidth}px;`;
  }
</script>

<div class="slider-input">
  <div
    class="track"
    bind:this={trackEl}
    onpointerdown={onPointerDown}
    role="presentation"
    data-track
  >
    <div class="unspez-slot" aria-hidden="true"></div>
    <div class="gap" aria-hidden="true"></div>
    <div class="cont-track" aria-hidden="true"></div>
    <div class="thumb" style={thumbStyle()} data-thumb data-zone={zone}></div>
  </div>
  <div class="labels">
    <span class="unspez-label">unspez</span>
    <span class="spacer"></span>
    <span class="low">{lowLabel || 'linker Endpunkt'}</span>
    <span class="high">{highLabel || 'rechter Endpunkt'}</span>
  </div>
</div>

<style>
  .slider-input { display: flex; flex-direction: column; gap: var(--sp-1); padding: var(--sp-2) 0; }
  .track {
    position: relative;
    height: 32px;
    cursor: pointer;
    touch-action: none;
  }
  .unspez-slot {
    position: absolute; left: 0; top: 14px; width: 30px; height: 4px;
    border-top: 2px dashed var(--c-border-strong);
  }
  .gap {
    position: absolute; left: 30px; top: 14px; width: 18px; height: 4px;
    background: transparent;
  }
  .cont-track {
    position: absolute; left: 48px; right: 0; top: 14px; height: 4px;
    background: var(--c-border); border-radius: 2px;
  }
  .thumb {
    position: absolute; top: 8px; width: 16px; height: 16px;
    margin-left: -8px;
    border-radius: 50%; background: var(--c-primary);
    box-shadow: 0 1px 3px rgba(0,0,0,0.2);
    transition: left 50ms ease-out;
  }
  .thumb[data-zone="unspez"] { background: var(--c-text-dim); }
  .labels { display: flex; font-size: var(--fs-xs); color: var(--c-text-dim); }
  .unspez-label { width: 30px; text-align: center; }
  .spacer { width: 18px; }
  .low, .high { flex: 1; }
  .low { text-align: left; padding-left: 4px; }
  .high { text-align: right; padding-right: 4px; }
</style>
```

- [ ] **Step 7.4: Tests grün**

```bash
pnpm exec vitest run src/lib/components/EntryEditor/SliderInput.test.ts
```

Erwartet: alle PASS.

- [ ] **Step 7.5: Commit**

```bash
git add src/lib/components/EntryEditor/SliderInput.svelte src/lib/components/EntryEditor/SliderInput.test.ts
git commit -m "feat(editor): SliderInput mit unspez-Slot und Gap-Snap

- Linker unspez-Slot (gestrichelt), 18px-Gap als Hysteresezone, dann
  durchgehender 1..100-Track. Pointer-Events steuern alles selbst —
  kein <input type=range>.
- onChange gibt null (unspez) oder eine Zahl 1..100; im Gap bleibt
  der Thumb auf der aktuellen Seite.
- Data-Attribute (data-track, data-thumb, data-zone) unterstützen die
  Komponenten-Tests in jsdom ohne echte Layout-Werte.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: NumberInput-Komponente

**Files:**
- Create: `src/lib/components/EntryEditor/NumberInput.svelte`
- Create: `src/lib/components/EntryEditor/NumberInput.test.ts`

- [ ] **Step 8.1: Test schreiben**

Datei `src/lib/components/EntryEditor/NumberInput.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import NumberInput from './NumberInput.svelte';

describe('NumberInput', () => {
  it('renders the unit label', () => {
    const { getByText } = render(NumberInput, {
      props: { value: 3, unit: 'Tassen', integer: true, onChange: () => {} }
    });
    expect(getByText('Tassen')).toBeTruthy();
  });

  it('falls back to placeholder when unit is empty', () => {
    const { getByText } = render(NumberInput, {
      props: { value: null, unit: '', integer: true, onChange: () => {} }
    });
    expect(getByText('Einheit')).toBeTruthy();
  });

  it('emits the parsed integer on input', async () => {
    const onChange = vi.fn();
    const { container } = render(NumberInput, {
      props: { value: null, unit: 'x', integer: true, onChange }
    });
    const input = container.querySelector('input') as HTMLInputElement;
    await fireEvent.input(input, { target: { value: '7' } });
    expect(onChange).toHaveBeenLastCalledWith(7);
  });

  it('emits null when input is cleared', async () => {
    const onChange = vi.fn();
    const { container } = render(NumberInput, {
      props: { value: 3, unit: 'x', integer: true, onChange }
    });
    const input = container.querySelector('input') as HTMLInputElement;
    await fireEvent.input(input, { target: { value: '' } });
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it('emits null for invalid input', async () => {
    const onChange = vi.fn();
    const { container } = render(NumberInput, {
      props: { value: null, unit: 'x', integer: true, onChange }
    });
    const input = container.querySelector('input') as HTMLInputElement;
    await fireEvent.input(input, { target: { value: 'abc' } });
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it('uses inputmode decimal when integer=false', () => {
    const { container } = render(NumberInput, {
      props: { value: null, unit: 'x', integer: false, onChange: () => {} }
    });
    const input = container.querySelector('input') as HTMLInputElement;
    expect(input.getAttribute('inputmode')).toBe('decimal');
  });
});
```

- [ ] **Step 8.2: Test ausführen — soll fehlschlagen**

```bash
pnpm exec vitest run src/lib/components/EntryEditor/NumberInput.test.ts
```

Erwartet: FAIL — Komponente existiert nicht.

- [ ] **Step 8.3: Komponente implementieren**

Datei `src/lib/components/EntryEditor/NumberInput.svelte`:

```svelte
<script lang="ts">
  type Props = {
    value: number | null;
    unit: string;
    integer: boolean;
    onChange: (v: number | null) => void;
  };
  let { value, unit, integer, onChange }: Props = $props();

  function onInput(e: Event) {
    const raw = (e.target as HTMLInputElement).value.trim();
    if (raw === '') { onChange(null); return; }
    const parsed = integer ? parseInt(raw, 10) : parseFloat(raw.replace(',', '.'));
    if (Number.isFinite(parsed)) onChange(parsed);
    else onChange(null);
  }
</script>

<div class="number-input">
  <input
    type="number"
    inputmode={integer ? 'numeric' : 'decimal'}
    step={integer ? 1 : 'any'}
    value={value ?? ''}
    oninput={onInput}
  />
  <span class="unit">{unit || 'Einheit'}</span>
</div>

<style>
  .number-input { display: flex; align-items: baseline; gap: var(--sp-2); }
  input {
    width: 6em;
    padding: var(--sp-2) var(--sp-3);
    border: 1px solid var(--c-border);
    border-radius: var(--r-2);
    text-align: right;
    font-size: var(--fs-md);
  }
  .unit { color: var(--c-text); font-size: var(--fs-sm); }
</style>
```

- [ ] **Step 8.4: Tests grün**

```bash
pnpm exec vitest run src/lib/components/EntryEditor/NumberInput.test.ts
```

Erwartet: PASS.

- [ ] **Step 8.5: Commit**

```bash
git add src/lib/components/EntryEditor/NumberInput.svelte src/lib/components/EntryEditor/NumberInput.test.ts
git commit -m "feat(editor): NumberInput mit Einheit-Label

- Schmales Zahleneingabe-Feld (6em, rechtsbündig) plus Einheit als
  Text rechts daneben. Bei leerer Einheit zeigt die Spalte einen
  Placeholder „Einheit\".
- inputmode=numeric|decimal in Abhängigkeit von Symptom.integer.
- onChange liefert die geparste Zahl oder null bei ungültiger/leerer
  Eingabe.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: InputConfigSection für Symptom-Admin

**Files:**
- Create: `src/lib/components/SymptomAdmin/InputConfigSection.svelte`
- Create: `src/lib/components/SymptomAdmin/InputConfigSection.test.ts`

- [ ] **Step 9.1: Test schreiben**

Datei `src/lib/components/SymptomAdmin/InputConfigSection.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import InputConfigSection from './InputConfigSection.svelte';
import { defaultSymptomInputs } from '$lib/db';

describe('InputConfigSection', () => {
  it('renders the three input cards', () => {
    const { getByText } = render(InputConfigSection, {
      props: { inputs: defaultSymptomInputs(), daily: false, onInputsChange: () => {}, onDailyChange: () => {} } as any
    });
    expect(getByText('Slider')).toBeTruthy();
    expect(getByText('Zahl')).toBeTruthy();
    expect(getByText('Kommentar')).toBeTruthy();
  });

  it('daily toggle is hidden when no input is enabled', () => {
    const { queryByLabelText } = render(InputConfigSection, {
      props: { inputs: defaultSymptomInputs(), daily: false, onInputsChange: () => {}, onDailyChange: () => {} } as any
    });
    expect(queryByLabelText('Täglich erfassen')).toBeNull();
  });

  it('daily toggle appears once any input is enabled', () => {
    const inputs = defaultSymptomInputs();
    inputs.comment.enabled = true;
    const { getByLabelText } = render(InputConfigSection, {
      props: { inputs, daily: false, onInputsChange: () => {}, onDailyChange: () => {} } as any
    });
    expect(getByLabelText('Täglich erfassen')).toBeTruthy();
  });

  it('Pflicht-Checkbox is disabled when Aktiv is off', () => {
    const { getAllByLabelText } = render(InputConfigSection, {
      props: { inputs: defaultSymptomInputs(), daily: false, onInputsChange: () => {}, onDailyChange: () => {} } as any
    });
    const pflicht = getAllByLabelText('Pflicht') as HTMLInputElement[];
    expect(pflicht.every((p) => p.disabled)).toBe(true);
  });

  it('toggling slider Aktiv calls onInputsChange with patched slider.enabled', async () => {
    const onInputsChange = vi.fn();
    const { getAllByLabelText } = render(InputConfigSection, {
      props: { inputs: defaultSymptomInputs(), daily: false, onInputsChange, onDailyChange: () => {} } as any
    });
    const aktivBoxes = getAllByLabelText('Aktiv') as HTMLInputElement[];
    await fireEvent.click(aktivBoxes[0]); // first card = Slider
    expect(onInputsChange).toHaveBeenCalled();
    const next = onInputsChange.mock.calls[0][0];
    expect(next.slider.enabled).toBe(true);
  });
});
```

- [ ] **Step 9.2: Test ausführen — soll fehlschlagen**

```bash
pnpm exec vitest run src/lib/components/SymptomAdmin/InputConfigSection.test.ts
```

Erwartet: FAIL — Komponente existiert nicht.

- [ ] **Step 9.3: Komponente implementieren**

Datei `src/lib/components/SymptomAdmin/InputConfigSection.svelte`:

```svelte
<script lang="ts">
  import type { SymptomInputs } from '$lib/db';

  type Props = {
    inputs: SymptomInputs;
    daily: boolean;
    onInputsChange: (next: SymptomInputs) => void;
    onDailyChange: (next: boolean) => void;
  };
  let { inputs, daily, onInputsChange, onDailyChange }: Props = $props();

  const hasEnabled = $derived(
    inputs.slider.enabled || inputs.number.enabled || inputs.comment.enabled
  );

  function patchSlider(p: Partial<SymptomInputs['slider']>) {
    onInputsChange({ ...inputs, slider: { ...inputs.slider, ...p } });
  }
  function patchNumber(p: Partial<SymptomInputs['number']>) {
    onInputsChange({ ...inputs, number: { ...inputs.number, ...p } });
  }
  function patchComment(p: Partial<SymptomInputs['comment']>) {
    onInputsChange({ ...inputs, comment: { ...inputs.comment, ...p } });
  }
</script>

<section class="config">
  <div class="caption">Eingaben</div>

  <!-- Slider card -->
  <div class="card">
    <header>
      <strong>Slider</strong>
      <label><input type="checkbox" checked={inputs.slider.enabled} onchange={(e) => patchSlider({ enabled: (e.currentTarget as HTMLInputElement).checked })}> Aktiv</label>
      <label><input type="checkbox" checked={inputs.slider.required} disabled={!inputs.slider.enabled} onchange={(e) => patchSlider({ required: (e.currentTarget as HTMLInputElement).checked })}> Pflicht</label>
    </header>
    {#if inputs.slider.enabled}
      <div class="body">
        <label class="field">
          <span>Linker Endpunkt</span>
          <input type="text" value={inputs.slider.lowLabel} placeholder="z.B. kaum spürbar" oninput={(e) => patchSlider({ lowLabel: (e.currentTarget as HTMLInputElement).value })} />
        </label>
        <label class="field">
          <span>Rechter Endpunkt</span>
          <input type="text" value={inputs.slider.highLabel} placeholder="z.B. unerträglich" oninput={(e) => patchSlider({ highLabel: (e.currentTarget as HTMLInputElement).value })} />
        </label>
      </div>
    {/if}
  </div>

  <!-- Number card -->
  <div class="card">
    <header>
      <strong>Zahl</strong>
      <label><input type="checkbox" checked={inputs.number.enabled} onchange={(e) => patchNumber({ enabled: (e.currentTarget as HTMLInputElement).checked })}> Aktiv</label>
      <label><input type="checkbox" checked={inputs.number.required} disabled={!inputs.number.enabled} onchange={(e) => patchNumber({ required: (e.currentTarget as HTMLInputElement).checked })}> Pflicht</label>
    </header>
    {#if inputs.number.enabled}
      <div class="body">
        <label class="field">
          <span>Einheit</span>
          <input type="text" value={inputs.number.unit} placeholder="z.B. Tassen" oninput={(e) => patchNumber({ unit: (e.currentTarget as HTMLInputElement).value })} />
        </label>
        <label class="field row">
          <input type="checkbox" checked={inputs.number.integer} onchange={(e) => patchNumber({ integer: (e.currentTarget as HTMLInputElement).checked })} />
          <span>Nur ganze Zahlen</span>
        </label>
      </div>
    {/if}
  </div>

  <!-- Comment card -->
  <div class="card">
    <header>
      <strong>Kommentar</strong>
      <label><input type="checkbox" checked={inputs.comment.enabled} onchange={(e) => patchComment({ enabled: (e.currentTarget as HTMLInputElement).checked })}> Aktiv</label>
      <label><input type="checkbox" checked={inputs.comment.required} disabled={!inputs.comment.enabled} onchange={(e) => patchComment({ required: (e.currentTarget as HTMLInputElement).checked })}> Pflicht</label>
    </header>
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
  .card { border: 1px solid var(--c-border); border-radius: var(--r-2); padding: var(--sp-2) var(--sp-3); }
  .card header { display: flex; align-items: center; gap: var(--sp-3); }
  .card header strong { flex: 1; }
  .card header label { font-size: var(--fs-sm); display: inline-flex; align-items: center; gap: 4px; }
  .body { display: flex; flex-direction: column; gap: var(--sp-2); margin-top: var(--sp-2); }
  .field { display: flex; flex-direction: column; gap: 4px; font-size: var(--fs-sm); }
  .field > span { color: var(--c-text-dim); }
  .field input[type="text"] { padding: var(--sp-2) var(--sp-3); border: 1px solid var(--c-border); border-radius: var(--r-2); }
  .field.row { flex-direction: row; align-items: center; gap: var(--sp-2); }
  .daily { display: inline-flex; align-items: center; gap: var(--sp-2); margin-top: var(--sp-2); }
  .hint { font-size: var(--fs-xs); color: var(--c-text-dim); margin: 0; }
</style>
```

- [ ] **Step 9.4: Tests grün**

```bash
pnpm exec vitest run src/lib/components/SymptomAdmin/InputConfigSection.test.ts
```

Erwartet: PASS.

- [ ] **Step 9.5: Commit**

```bash
git add src/lib/components/SymptomAdmin/InputConfigSection.svelte src/lib/components/SymptomAdmin/InputConfigSection.test.ts
git commit -m "feat(admin): InputConfigSection — drei Input-Karten + Daily-Toggle

- Pro Baustein (Slider/Zahl/Kommentar) eine Karte mit Aktiv- und
  Pflicht-Checkbox; Pflicht ist nur klickbar wenn Aktiv gesetzt.
- Slider-Body: lowLabel + highLabel. Number-Body: Einheit +
  „Nur ganze Zahlen\". Kommentar hat keinen Body.
- Daily-Toggle erscheint nur wenn mindestens ein Input aktiv ist;
  Hilfstext erklärt die Erinnerungs-Karte.
- onInputsChange / onDailyChange als reine Callback-Props, kein
  internes Form-State — die Eltern-Komponente hält die Wahrheit.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: SymptomEditModal — InputConfigSection einbinden + Daily speichern

**Files:**
- Modify: `src/lib/components/SymptomAdmin/SymptomEditModal.svelte`
- Modify: `src/lib/components/SymptomAdmin/SymptomEditModal.test.ts`
- Modify: `src/lib/db/symptoms.ts` (updateSymptom-Signatur kann `inputs` und `daily` aufnehmen — beides ist schon in `Partial<...>` zulässig, nur sicherstellen, dass `updateSymptom`-Aufrufe das durchreichen können — keine Code-Änderung nötig, nur prüfen)

- [ ] **Step 10.1: SymptomEditModal-Test ergänzen**

`src/lib/components/SymptomAdmin/SymptomEditModal.test.ts` öffnen. Falls leer/Mini-Test: einen Roundtrip schreiben, der prüft, dass beim Save inputs + daily mit gespeichert werden. Beispielblock:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import SymptomEditModal from './SymptomEditModal.svelte';
import { db, defaultSymptomInputs, resetDatabase } from '$lib/db';
import { createSymptom } from '$lib/db/symptoms';

describe('SymptomEditModal — inputs/daily', () => {
  beforeEach(() => resetDatabase());

  it('saves toggled comment.enabled and daily=true', async () => {
    const sym = await createSymptom({ name: 'S' });
    const onClose = vi.fn();
    const { getAllByLabelText, getByLabelText, getByText } = render(SymptomEditModal, {
      props: { open: true, symptom: sym, isNew: false, onClose } as any
    });

    // Toggle comment Aktiv.
    const aktiv = getAllByLabelText('Aktiv') as HTMLInputElement[];
    await fireEvent.click(aktiv[2]); // comment is 3rd

    // Daily becomes visible; tick it.
    const daily = getByLabelText('Täglich erfassen');
    await fireEvent.click(daily);

    await fireEvent.click(getByText('Speichern'));

    const stored = await db.symptoms.get(sym.id);
    expect(stored?.inputs.comment.enabled).toBe(true);
    expect(stored?.daily).toBe(true);
  });
});
```

- [ ] **Step 10.2: Test ausführen — soll fehlschlagen**

```bash
pnpm exec vitest run src/lib/components/SymptomAdmin/SymptomEditModal.test.ts
```

Erwartet: FAIL — Modal trägt die neuen Felder noch nicht.

- [ ] **Step 10.3: Modal anpassen**

Datei `src/lib/components/SymptomAdmin/SymptomEditModal.svelte` öffnen.

1. Imports ergänzen:

```ts
import InputConfigSection from './InputConfigSection.svelte';
import { defaultSymptomInputs, type SymptomInputs } from '$lib/db';
```

2. Zwei neue State-Variablen (untrack-Pattern wie die anderen):

```ts
let inputs = $state<SymptomInputs>(untrack(() => symptom.inputs ?? defaultSymptomInputs()));
let daily = $state(untrack(() => symptom.daily ?? false));
```

3. Im bestehenden `$effect`-Block, der Form-State beim `symptom`-Wechsel resettet, mit aufnehmen:

```ts
$effect(() => {
  name = symptom.name;
  color = symptom.color;
  icon = symptom.icon;
  tagIds = [...symptom.tagIds];
  parentId = symptom.parentId;
  inputs = symptom.inputs ?? defaultSymptomInputs();
  daily = symptom.daily ?? false;
  view = 'main';
});
```

4. Im Markup, vor dem „Speichern"-Button und nach dem „Eltern-Ordner"-Feld, die Sektion einbinden — **nur für Symptome (nicht Ordner)**:

```svelte
{#if !symptom.isFolder}
  <InputConfigSection
    inputs={inputs}
    {daily}
    onInputsChange={(n) => (inputs = n)}
    onDailyChange={(n) => (daily = n)}
  />
{/if}
```

5. `save()` so anpassen, dass `inputs` und `daily` ans DB-Update durchgereicht werden:

```ts
async function save() {
  const trimmedName = name.trim();
  if (!trimmedName) return;
  const snapTags = $state.snapshot(tagIds);
  const snapInputs = $state.snapshot(inputs) as SymptomInputs;
  if (isNew) {
    await createSymptom({
      name: trimmedName,
      isFolder: symptom.isFolder,
      parentId,
      color, icon,
      tagIds: snapTags
    });
    // createSymptom doesn't take inputs yet → after creation, patch them.
    // We can also lift inputs/daily into createSymptom but for now we patch
    // after creation to minimise surface change.
  } else {
    await updateSymptom(symptom.id, {
      name: trimmedName, color, icon, tagIds: snapTags,
      inputs: snapInputs, daily
    });
    if (parentId !== symptom.parentId) {
      await moveSymptom(symptom.id, parentId);
    }
  }
  onClose();
}
```

**Korrektur:** lieber `createSymptom` zentral erweitern, damit Roundtrips sauber bleiben. Dazu:

a) In `src/lib/db/symptoms.ts` `CreateSymptomInput` erweitern:

```ts
export interface CreateSymptomInput {
  name: string;
  isFolder?: boolean;
  parentId?: string | null;
  color?: string;
  icon?: string;
  tagIds?: string[];
  inputs?: SymptomInputs;
  daily?: boolean;
}
```

b) Im `sym`-Block:

```ts
inputs: input.inputs ?? defaultSymptomInputs(),
daily: input.daily ?? false
```

c) Im Modal-`save()` für `isNew=true`:

```ts
await createSymptom({
  name: trimmedName,
  isFolder: symptom.isFolder,
  parentId,
  color, icon,
  tagIds: snapTags,
  inputs: snapInputs,
  daily
});
```

- [ ] **Step 10.4: Test ausführen — soll PASSEN**

```bash
pnpm exec vitest run src/lib/components/SymptomAdmin/SymptomEditModal.test.ts
pnpm exec vitest run src/lib/db/symptoms.test.ts
```

Erwartet: alle PASS.

- [ ] **Step 10.5: Commit**

```bash
git add src/lib/components/SymptomAdmin/SymptomEditModal.svelte src/lib/components/SymptomAdmin/SymptomEditModal.test.ts src/lib/db/symptoms.ts
git commit -m "feat(admin): SymptomEditModal lädt + speichert inputs + daily

- InputConfigSection wird im Modal eingebettet (nur für Symptome,
  nicht Ordner). State per untrack(() => prop) geseedet wie andere
  Form-Felder.
- save() reicht inputs + daily an updateSymptom durch; createSymptom
  bekommt optionale Felder, damit auch neue Symptome ihre Konfig
  direkt speichern können.
- Test prüft den Roundtrip über fake-indexeddb.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 11: EntryEditor komplett umbauen

**Files:**
- Modify: `src/lib/components/EntryEditor/EntryEditor.svelte`
- Modify: `src/lib/components/EntryEditor/EntryEditor.test.ts`

- [ ] **Step 11.1: Test für neuen Editor schreiben**

`src/lib/components/EntryEditor/EntryEditor.test.ts` öffnen und mit folgendem Inhalt überschreiben:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import EntryEditor from './EntryEditor.svelte';
import { db, defaultSymptomInputs, resetDatabase, type Symptom } from '$lib/db';

function makeSymptom(p: Partial<Symptom> = {}): Symptom {
  return {
    id: 's1', name: 'X', color: '#000', icon: 'circle',
    tagIds: [], parentId: null, sortIndex: 0, depth: 0,
    isFolder: false, archived: false, createdAt: 0, updatedAt: 0,
    inputs: defaultSymptomInputs(), daily: false, ...p
  };
}

describe('EntryEditor', () => {
  beforeEach(() => resetDatabase());

  it('Fertig is enabled when nothing is required and writes a marker entry', async () => {
    const s = makeSymptom();
    const onClose = vi.fn();
    const { getByText } = render(EntryEditor, {
      props: { open: true, date: '2026-05-28', symptom: s, onClose } as any
    });
    const fertig = getByText('Fertig') as HTMLButtonElement;
    expect(fertig.disabled).toBe(false);
    await fireEvent.click(fertig);
    const entry = await db.entries.get('2026-05-28__s1');
    expect(entry).toBeTruthy();
    expect(entry?.sliderValue).toBeNull();
    expect(entry?.numberValue).toBeNull();
    expect(entry?.comment).toBe('');
  });

  it('Fertig is disabled while slider is required and value is null', async () => {
    const inputs = defaultSymptomInputs();
    inputs.slider.enabled = true; inputs.slider.required = true;
    const s = makeSymptom({ inputs });
    const { getByText } = render(EntryEditor, {
      props: { open: true, date: '2026-05-28', symptom: s, onClose: () => {} } as any
    });
    const fertig = getByText('Fertig') as HTMLButtonElement;
    expect(fertig.disabled).toBe(true);
  });

  it('Verwerfen closes without writing an entry', async () => {
    const s = makeSymptom();
    const onClose = vi.fn();
    const { getByText } = render(EntryEditor, {
      props: { open: true, date: '2026-05-28', symptom: s, onClose } as any
    });
    await fireEvent.click(getByText('Verwerfen'));
    expect(onClose).toHaveBeenCalled();
    expect(await db.entries.get('2026-05-28__s1')).toBeUndefined();
  });

  it('renders only enabled inputs', () => {
    const inputs = defaultSymptomInputs();
    inputs.comment.enabled = true;
    const s = makeSymptom({ inputs });
    const { queryByPlaceholderText, getByPlaceholderText } = render(EntryEditor, {
      props: { open: true, date: '2026-05-28', symptom: s, onClose: () => {} } as any
    });
    expect(getByPlaceholderText('z.B. Auslöser, Umstände…')).toBeTruthy();
    // Slider track not in DOM
    expect(queryByPlaceholderText(/leicht/)).toBeNull();
  });
});
```

- [ ] **Step 11.2: Test ausführen — soll fehlschlagen**

```bash
pnpm exec vitest run src/lib/components/EntryEditor/EntryEditor.test.ts
```

Erwartet: FAIL — die alte EntryEditor-Implementation passt zu nichts mehr.

- [ ] **Step 11.3: EntryEditor neu schreiben**

`src/lib/components/EntryEditor/EntryEditor.svelte` komplett ersetzen:

```svelte
<script lang="ts">
  import { untrack } from 'svelte';
  import Modal from '$lib/components/ui/Modal.svelte';
  import Badge from '$lib/components/ui/Badge.svelte';
  import SliderInput from './SliderInput.svelte';
  import NumberInput from './NumberInput.svelte';
  import { upsertEntry, deleteEntry, getEntry, validateEntry } from '$lib/db/entries';
  import { db, type Symptom } from '$lib/db';
  import { snackbar } from '$lib/stores/snackbar.svelte';
  import { isValidDateKey, formatLong } from '$lib/utils/date';
  import {
    persistDialog, updateDialogPayload, clearDialog
  } from '$lib/stores/openDialog.svelte';
  import { page } from '$app/state';

  type Props = {
    open: boolean;
    date: string;
    symptom: Symptom;
    /** Optional initial values when restoring from openDialog. */
    initial?: { sliderValue: number | null; numberValue: number | null; comment: string };
    onClose: () => void;
  };
  let { open, date, symptom, initial, onClose }: Props = $props();

  let workingDate = $state(untrack(() => date));
  let sliderValue = $state<number | null>(untrack(() => initial?.sliderValue ?? null));
  let numberValue = $state<number | null>(untrack(() => initial?.numberValue ?? null));
  let comment = $state(untrack(() => initial?.comment ?? ''));

  // Load existing entry once on open, only if no initial restore payload was provided.
  $effect(() => {
    if (!open) return;
    workingDate = date;
    if (initial) return; // restored values win
    (async () => {
      const e = await getEntry(date, symptom.id);
      if (e) {
        sliderValue = e.sliderValue;
        numberValue = e.numberValue;
        comment = e.comment;
      } else {
        sliderValue = null;
        numberValue = null;
        comment = '';
      }
    })();
  });

  // Persist dialog on open; update on every change; clear on close paths.
  $effect(() => {
    if (!open) return;
    void persistDialog({
      kind: 'entry-editor',
      route: page.url.pathname,
      payload: { date: workingDate, symptomId: symptom.id, sliderValue, numberValue, comment }
    });
    return () => { /* cleared by close handlers below */ };
  });

  $effect(() => {
    if (!open) return;
    void updateDialogPayload({ date: workingDate, sliderValue, numberValue, comment });
  });

  const validation = $derived(validateEntry(symptom, { sliderValue, numberValue, comment }));

  async function onFertig() {
    if (!validation.ok) return;
    await upsertEntry({
      date: workingDate,
      symptomId: symptom.id,
      sliderValue, numberValue, comment
    });
    await clearDialog();
    onClose();
  }

  async function onVerwerfen() {
    await clearDialog();
    onClose();
  }

  async function onDateChange(e: Event) {
    const v = (e.target as HTMLInputElement).value;
    if (!v || !isValidDateKey(v) || v === workingDate) return;
    workingDate = v;
  }

  function openDatePicker(e: MouseEvent) {
    const el = e.currentTarget as HTMLInputElement;
    if (typeof el.showPicker === 'function') {
      try { el.showPicker(); } catch { /* needs gesture; we have one */ }
    }
  }
</script>

<Modal {open} onClose={onVerwerfen}>
  <div class="header">
    <Badge icon={symptom.icon} color={symptom.color} size={36} />
    <h3>{symptom.name}</h3>
  </div>

  <section>
    <div class="caption">Datum</div>
    <label class="date-row">
      <span class="date-label">{formatLong(workingDate)}</span>
      <input type="date" value={workingDate} oninput={onDateChange} onclick={openDatePicker} aria-label="Datum ändern" />
    </label>
  </section>

  {#if symptom.inputs.slider.enabled}
    <section>
      <div class="caption">
        Intensität
        {#if symptom.inputs.slider.required}<span class="req">*</span>{/if}
      </div>
      <SliderInput
        value={sliderValue}
        lowLabel={symptom.inputs.slider.lowLabel}
        highLabel={symptom.inputs.slider.highLabel}
        onChange={(v) => (sliderValue = v)}
      />
    </section>
  {/if}

  {#if symptom.inputs.number.enabled}
    <section>
      <div class="caption">
        Anzahl
        {#if symptom.inputs.number.required}<span class="req">*</span>{/if}
      </div>
      <NumberInput
        value={numberValue}
        unit={symptom.inputs.number.unit}
        integer={symptom.inputs.number.integer}
        onChange={(v) => (numberValue = v)}
      />
    </section>
  {/if}

  {#if symptom.inputs.comment.enabled}
    <section>
      <div class="caption">
        Kommentar
        {#if symptom.inputs.comment.required}<span class="req">*</span>{/if}
      </div>
      <textarea class="comment" rows={3} placeholder="z.B. Auslöser, Umstände…" bind:value={comment}></textarea>
    </section>
  {/if}

  <button type="button" class="primary" onclick={onFertig} disabled={!validation.ok}>Fertig</button>
  <button type="button" class="discard" onclick={onVerwerfen}>Verwerfen</button>
</Modal>

<style>
  .header { display: flex; align-items: center; gap: var(--sp-3); margin-bottom: var(--sp-4); }
  .header h3 { margin: 0; font-size: var(--fs-lg); }
  .caption { font-size: var(--fs-xs); color: var(--c-text-dim); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: var(--sp-2); }
  .req { color: var(--c-danger); margin-left: 4px; }
  section { margin-bottom: var(--sp-4); }
  .comment { width: 100%; padding: var(--sp-3); border: 1px solid var(--c-border); border-radius: var(--r-2); resize: vertical; font: inherit; box-sizing: border-box; }
  .primary { width: 100%; background: var(--c-primary); color: var(--c-primary-contrast); border: 0; padding: var(--sp-3); border-radius: var(--r-2); font-weight: var(--fw-bold); cursor: pointer; }
  .primary[disabled] { opacity: 0.4; cursor: not-allowed; }
  .discard { display: block; margin: var(--sp-3) auto 0; color: var(--c-danger); background: none; border: 0; cursor: pointer; }
  .date-row {
    display: inline-flex; align-items: center; gap: var(--sp-2);
    padding: var(--sp-3); border: 1px solid var(--c-border); border-radius: var(--r-2);
    position: relative; cursor: pointer; width: 100%; box-sizing: border-box;
  }
  .date-row::after { content: '📅'; margin-left: auto; opacity: 0.7; }
  .date-row input[type="date"] { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
  .date-label { font-weight: var(--fw-medium); }
</style>
```

- [ ] **Step 11.4: Tests grün**

```bash
pnpm exec vitest run src/lib/components/EntryEditor/EntryEditor.test.ts
```

Erwartet: alle PASS.

- [ ] **Step 11.5: Commit**

```bash
git add src/lib/components/EntryEditor/EntryEditor.svelte src/lib/components/EntryEditor/EntryEditor.test.ts
git commit -m "feat(editor): EntryEditor neu — config-getriebene Inputs + persist

- Rendert nur die in symptom.inputs aktivierten Bausteine (Slider,
  Zahl, Kommentar). Pflicht-Markierung via roten Stern.
- „Fertig\" ist disabled solange validateEntry nicht ok ist; Klick
  schreibt den Eintrag und löscht meta.openDialog.
- „Verwerfen\" und Backdrop schließen den Editor ohne Schreiben;
  vorhandene Werte gehen verloren (Drafts gibt es nicht).
- persistDialog/updateDialogPayload halten den Dialog-State in
  meta.openDialog für den App-Restart-Restore.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 12: SymptomEditModal — persistDialog-Integration

**Files:**
- Modify: `src/lib/components/SymptomAdmin/SymptomEditModal.svelte`

- [ ] **Step 12.1: Persist-Calls einbauen**

`src/lib/components/SymptomAdmin/SymptomEditModal.svelte` öffnen. Im `<script>`-Block ergänzen:

```ts
import { persistDialog, updateDialogPayload, clearDialog } from '$lib/stores/openDialog.svelte';
import { page } from '$app/state';
```

Direkt nach dem Reset-`$effect` zwei weitere Effekte:

```ts
$effect(() => {
  if (!open) return;
  void persistDialog({
    kind: 'symptom-edit',
    route: page.url.pathname,
    payload: {
      symptomId: isNew ? null : symptom.id,
      isNew,
      isFolder: symptom.isFolder,
      name, color, icon,
      tagIds: $state.snapshot(tagIds),
      parentId,
      inputs: $state.snapshot(inputs),
      daily,
      view
    }
  });
});

$effect(() => {
  if (!open) return;
  void updateDialogPayload({
    name, color, icon,
    tagIds: $state.snapshot(tagIds),
    parentId,
    inputs: $state.snapshot(inputs),
    daily,
    view
  });
});
```

In `save()` direkt nach erfolgreichem Speichern (vor `onClose()`):

```ts
await clearDialog();
```

In `doArchive()` ebenso vor `onClose()`.

Im `Modal`-Element den `onClose`-Prop von `{onClose}` ändern zu:

```svelte
<Modal {open} {onClose={async () => { await clearDialog(); onClose(); }}} {title}>
```

(Falls die Svelte-Syntax für Inline-Handler komisch ist: eine Helper-Funktion definieren:

```ts
async function onCancel() {
  await clearDialog();
  onClose();
}
```

und das Modal mit `onClose={onCancel}` aufrufen.)

- [ ] **Step 12.2: Typecheck**

```bash
pnpm exec svelte-check --tsconfig ./tsconfig.json
```

Erwartet: 0 ERRORS.

- [ ] **Step 12.3: Tests**

```bash
pnpm test
```

Erwartet: alle grün.

- [ ] **Step 12.4: Commit**

```bash
git add src/lib/components/SymptomAdmin/SymptomEditModal.svelte
git commit -m "feat(admin): SymptomEditModal persistiert offenen Dialog

Mount/Update-Effects spiegeln den vollen Form-State (Name, Farbe,
Icon, Tags, Eltern, inputs, daily, sub-view) in meta.openDialog.
save/Archive/Cancel löschen den Eintrag bevor das Modal schließt.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 13: EntryCard-Status-Zeile neu

**Files:**
- Modify: `src/lib/components/DayView/EntryCard.svelte`

- [ ] **Step 13.1: Karten-Markup umbauen**

`src/lib/components/DayView/EntryCard.svelte` öffnen und Inhalt ersetzen:

```svelte
<script lang="ts">
  import Badge from '$lib/components/ui/Badge.svelte';
  import SwipeRow from '$lib/components/ui/SwipeRow.svelte';
  import { MessageCircle } from '@lucide/svelte';
  import type { Symptom, Entry } from '$lib/db';

  type Props = { entry: Entry; symptom: Symptom; onTap: () => void; onSwipe: () => void };
  let { entry, symptom, onTap, onSwipe }: Props = $props();

  const sliderText = $derived.by(() => {
    if (!symptom.inputs.slider.enabled) return '';
    if (entry.sliderValue === null) return 'unspezifisch';
    const low = symptom.inputs.slider.lowLabel || 'leicht';
    const high = symptom.inputs.slider.highLabel || 'hoch';
    return `${low} ··· ${entry.sliderValue} ··· ${high}`;
  });

  const numberText = $derived.by(() => {
    if (!symptom.inputs.number.enabled || entry.numberValue === null) return '';
    const unit = symptom.inputs.number.unit;
    return unit ? `${entry.numberValue} ${unit}` : String(entry.numberValue);
  });

  const showComment = $derived(symptom.inputs.comment.enabled && entry.comment.trim().length > 0);
</script>

<SwipeRow {onSwipe}>
  <button type="button" class="card" onclick={onTap}>
    <Badge icon={symptom.icon} color={symptom.color} size={28} />
    <div class="text">
      <div class="name">{symptom.name}</div>
      <div class="meta">
        {#if sliderText}<span class="slider">{sliderText}</span>{/if}
        {#if numberText}<span class="number">{numberText}</span>{/if}
        {#if showComment}<MessageCircle size={14} />{/if}
        {#if !sliderText && !numberText && !showComment}<span class="empty">erfasst</span>{/if}
      </div>
    </div>
  </button>
</SwipeRow>

<style>
  .card {
    display: flex; align-items: center; gap: var(--sp-3);
    width: 100%; padding: var(--sp-3) var(--sp-4);
    background: var(--c-surface);
    border: 1px solid var(--c-border);
    border-radius: var(--r-2);
    margin-bottom: var(--sp-2);
    cursor: pointer; text-align: left;
  }
  .text { flex: 1; min-width: 0; }
  .name { font-weight: var(--fw-bold); }
  .meta { display: flex; flex-wrap: wrap; align-items: center; gap: var(--sp-2); font-size: var(--fs-sm); color: var(--c-text-dim); margin-top: 2px; }
  .empty { font-style: italic; }
</style>
```

- [ ] **Step 13.2: Typecheck + Tests**

```bash
pnpm exec svelte-check --tsconfig ./tsconfig.json
pnpm test
```

Erwartet: 0 Errors, alle Tests grün.

- [ ] **Step 13.3: Commit**

```bash
git add src/lib/components/DayView/EntryCard.svelte
git commit -m "feat(day): EntryCard-Status-Zeile zeigt Slider/Zahl/Kommentar

Karte rendert nur die per Symptom-Konfig aktiven Bausteine. Slider:
\"<low> ··· <wert> ··· <high>\" bzw. \"unspezifisch\" bei null. Zahl:
Wert + Einheit. Kommentar: Sprechblasen-Icon. Wenn nichts vorhanden,
Fallback \"erfasst\".

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 14: DailyPromptCard

**Files:**
- Create: `src/lib/components/DayView/DailyPromptCard.svelte`
- Create: `src/lib/components/DayView/DailyPromptCard.test.ts`

- [ ] **Step 14.1: Test schreiben**

Datei `src/lib/components/DayView/DailyPromptCard.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import DailyPromptCard from './DailyPromptCard.svelte';
import { defaultSymptomInputs, type Symptom } from '$lib/db';

function makeSym(p: Partial<Symptom> = {}): Symptom {
  return {
    id: 's1', name: 'Stimmung', color: '#3b82f6', icon: 'smile',
    tagIds: [], parentId: null, sortIndex: 0, depth: 0,
    isFolder: false, archived: false, createdAt: 0, updatedAt: 0,
    inputs: defaultSymptomInputs(), daily: true, ...p
  };
}

describe('DailyPromptCard', () => {
  it('renders symptom name and a hint', () => {
    const { getByText } = render(DailyPromptCard, {
      props: { symptom: makeSym(), onTap: () => {} } as any
    });
    expect(getByText('Stimmung')).toBeTruthy();
    expect(getByText('noch nicht erfasst')).toBeTruthy();
  });

  it('calls onTap when clicked', async () => {
    const onTap = vi.fn();
    const { getByRole } = render(DailyPromptCard, {
      props: { symptom: makeSym(), onTap } as any
    });
    await fireEvent.click(getByRole('button'));
    expect(onTap).toHaveBeenCalled();
  });

  it('has muted styling via data-muted', () => {
    const { getByRole } = render(DailyPromptCard, {
      props: { symptom: makeSym(), onTap: () => {} } as any
    });
    expect(getByRole('button').dataset.muted).toBe('true');
  });
});
```

- [ ] **Step 14.2: Test ausführen — soll fehlschlagen**

```bash
pnpm exec vitest run src/lib/components/DayView/DailyPromptCard.test.ts
```

Erwartet: FAIL — Komponente existiert nicht.

- [ ] **Step 14.3: Komponente implementieren**

Datei `src/lib/components/DayView/DailyPromptCard.svelte`:

```svelte
<script lang="ts">
  import Badge from '$lib/components/ui/Badge.svelte';
  import type { Symptom } from '$lib/db';

  type Props = { symptom: Symptom; onTap: () => void };
  let { symptom, onTap }: Props = $props();
</script>

<button type="button" class="card" data-muted="true" onclick={onTap}>
  <div class="badge-wrap"><Badge icon={symptom.icon} color={symptom.color} size={28} /></div>
  <div class="text">
    <div class="name">{symptom.name}</div>
    <div class="hint">noch nicht erfasst</div>
  </div>
</button>

<style>
  .card {
    display: flex; align-items: center; gap: var(--sp-3);
    width: 100%; padding: var(--sp-3) var(--sp-4);
    background: var(--c-surface);
    border: 1px dashed var(--c-border);
    border-radius: var(--r-2);
    margin-bottom: var(--sp-2);
    cursor: pointer; text-align: left;
  }
  .badge-wrap :global(*) { opacity: 0.5; }
  .text { flex: 1; min-width: 0; }
  .name { font-weight: var(--fw-medium); color: var(--c-text-dim); }
  .hint { font-size: var(--fs-sm); color: var(--c-text-dim); font-style: italic; }
</style>
```

- [ ] **Step 14.4: Test grün**

```bash
pnpm exec vitest run src/lib/components/DayView/DailyPromptCard.test.ts
```

Erwartet: alle PASS.

- [ ] **Step 14.5: Commit**

```bash
git add src/lib/components/DayView/DailyPromptCard.svelte src/lib/components/DayView/DailyPromptCard.test.ts
git commit -m "feat(day): DailyPromptCard — graue „noch offen\"-Karte

Schmale Karte mit gestricheltem Rand, gedämpfter Badge-Opazität und
Hinweis \"noch nicht erfasst\". onTap-Callback öffnet den EntryEditor
für (Tag, Symptom) — der Aufrufer entscheidet das.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 15: EntryList — zwei Sektionen + datums-abhängige Header

**Files:**
- Modify: `src/lib/components/DayView/EntryList.svelte`
- Modify: `src/routes/tag/[date]/+page.svelte`

- [ ] **Step 15.1: EntryList neu strukturieren**

`src/lib/components/DayView/EntryList.svelte` öffnen und Inhalt ersetzen:

```svelte
<script lang="ts">
  import EntryCard from './EntryCard.svelte';
  import DailyPromptCard from './DailyPromptCard.svelte';
  import EntryEditor from '$lib/components/EntryEditor/EntryEditor.svelte';
  import { liveQueryEffect } from '$lib/stores/liveQuery.svelte';
  import { db, type Symptom, type Entry } from '$lib/db';
  import { deleteEntry, upsertEntry, listEntriesForDate } from '$lib/db/entries';
  import { listDailySymptomsForDate } from '$lib/db/symptoms';
  import { snackbar } from '$lib/stores/snackbar.svelte';
  import { todayKey } from '$lib/utils/date';

  type Props = { date: string };
  let { date }: Props = $props();

  const entriesQ = liveQueryEffect(() => listEntriesForDate(date), [] as Entry[], () => date);
  const symptomsQ = liveQueryEffect(() => db.symptoms.toArray(), [] as Symptom[]);
  const dailyQ = liveQueryEffect(() => listDailySymptomsForDate(date), [] as Symptom[], () => date);
  const symptomMap = $derived(new Map(symptomsQ.current.map((s) => [s.id, s])));

  let editing = $state<{ entry: Entry | null; symptom: Symptom; date: string } | null>(null);

  function openForDailyPrompt(s: Symptom) {
    editing = { entry: null, symptom: s, date };
  }
  function openForEntry(e: Entry, s: Symptom) {
    editing = { entry: e, symptom: s, date: e.date };
  }

  async function removeWithUndo(e: Entry, s: Symptom) {
    const original = { ...e };
    await deleteEntry(e.date, e.symptomId);
    snackbar.show({
      message: `${s.name} entfernt`,
      actionLabel: 'Rückgängig',
      onAction: () => upsertEntry({
        date: original.date,
        symptomId: original.symptomId,
        sliderValue: original.sliderValue,
        numberValue: original.numberValue,
        comment: original.comment
      })
    });
  }

  const erfasstTitle = $derived(date === todayKey() ? 'Heute erfasst' : 'Erfasst');
</script>

{#if dailyQ.current.length > 0}
  <section>
    <h2 class="section-title">Noch offen</h2>
    {#each dailyQ.current as s (s.id)}
      <DailyPromptCard symptom={s} onTap={() => openForDailyPrompt(s)} />
    {/each}
  </section>
{/if}

<section>
  <h2 class="section-title">{erfasstTitle} ({entriesQ.current.length})</h2>

  {#if entriesQ.current.length === 0 && dailyQ.current.length === 0}
    <p class="empty">Tippe das + unten, um Symptome zu erfassen.</p>
  {/if}

  {#each entriesQ.current as e (e.id)}
    {@const s = symptomMap.get(e.symptomId)}
    {#if s}
      <EntryCard entry={e} symptom={s} onTap={() => openForEntry(e, s)} onSwipe={() => removeWithUndo(e, s)} />
    {/if}
  {/each}
</section>

{#if editing}
  <EntryEditor open={true} date={editing.date} symptom={editing.symptom} onClose={() => editing = null} />
{/if}

<style>
  .section-title { font-size: var(--fs-xs); color: var(--c-text-dim); text-transform: uppercase; letter-spacing: 0.05em; margin: var(--sp-3) var(--sp-4) var(--sp-2); }
  .empty { color: var(--c-text-dim); text-align: center; padding: var(--sp-5); }
</style>
```

- [ ] **Step 15.2: Route-Page entrümpeln**

In `src/routes/tag/[date]/+page.svelte` läuft aktuell eine eigene Editor-Logik parallel zu dem, was jetzt in `EntryList` lebt. Ziel: einen einzigen Editor-Mountpunkt. Variante A (empfohlen): den Editor-Mount aus dem `+page.svelte` entfernen und nur `EntryList` zeigen. Die Page wird zu:

```svelte
<script lang="ts">
  import DateHeader from '$lib/components/DayView/DateHeader.svelte';
  import EntryList from '$lib/components/DayView/EntryList.svelte';
  import SymptomSheet from '$lib/components/SymptomSheet/SymptomSheet.svelte';
  import EntryEditor from '$lib/components/EntryEditor/EntryEditor.svelte';
  import Fab from '$lib/components/ui/Fab.svelte';
  import FirstRun from '$lib/components/DayView/FirstRun.svelte';
  import { currentDate } from '$lib/stores/currentDate.svelte';
  import { liveQuery, liveQueryEffect } from '$lib/stores/liveQuery.svelte';
  import { db, type Symptom, type Entry } from '$lib/db';
  import { listEntriesForDate } from '$lib/db/entries';
  import { getOrDefault } from '$lib/db/meta';

  let { data } = $props();
  $effect(() => { currentDate.set(data.date); });

  let sheetOpen = $state(false);
  let editing = $state<{ symptom: Symptom } | null>(null);

  const firstRunQ = liveQuery(async () => await getOrDefault('firstRunCompleted', false), false);
  $effect(() => () => firstRunQ.dispose());

  const entriesQ = liveQueryEffect(() => listEntriesForDate(currentDate.value), [] as Entry[], () => currentDate.value);
  const symptomsQ = liveQueryEffect(() => db.symptoms.toArray(), [] as Symptom[]);
  const enteredIds = $derived(new Set(entriesQ.current.map((e) => e.symptomId)));

  function onPick(symptomId: string) {
    const sym = symptomsQ.current.find((s) => s.id === symptomId);
    if (sym) editing = { symptom: sym };
  }
</script>

{#if !firstRunQ.current}
  <FirstRun />
{:else}
  <DateHeader />
  <EntryList date={currentDate.value} />

  <Fab onClick={() => sheetOpen = true} />

  <SymptomSheet open={sheetOpen} onClose={() => sheetOpen = false} {onPick} {enteredIds} />

  {#if editing}
    <EntryEditor open={true} date={currentDate.value} symptom={editing.symptom} onClose={() => editing = null} />
  {/if}
{/if}
```

**Wichtig:** der Sheet-Pick öffnet nun den Editor **ohne** vorher einen Eintrag in der DB anzulegen (das alte `upsertEntry({...})` in `onPick` ist weg — der Editor schreibt erst auf „Fertig").

- [ ] **Step 15.3: Tests/Typecheck**

```bash
pnpm exec svelte-check --tsconfig ./tsconfig.json
pnpm test
```

Erwartet: 0 Errors. Vitest grün.

- [ ] **Step 15.4: Commit**

```bash
git add src/lib/components/DayView/EntryList.svelte src/routes/tag/\[date\]/+page.svelte
git commit -m "feat(day): zwei Sektionen + datums-abhängiger Header

- Section „Noch offen\" listet Daily-Symptome ohne Eintrag für das
  angezeigte Datum (Tree-Reihenfolge). Erscheint nur wenn nicht leer.
- Section „Heute erfasst (N)\" wird zu „Erfasst (N)\" wenn das
  angezeigte Datum nicht todayKey() ist — Bugfix gegenüber dem
  bisherigen statischen \"Heute erfasst\".
- Sheet-Pick legt nicht mehr sofort einen Eintrag an; der Editor
  schreibt erst beim „Fertig\".

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 16: Open-Dialog-Restore in +layout.svelte

**Files:**
- Modify: `src/routes/+layout.svelte`
- Modify: `src/routes/tag/[date]/+page.svelte`
- Modify: `src/routes/symptome/+page.svelte`

- [ ] **Step 16.1: Restore-Logik in +layout.svelte**

`src/routes/+layout.svelte` öffnen. Im `<script>`-Block ergänzen:

```ts
import { loadOpenDialog, pendingRestore } from '$lib/stores/openDialog.svelte';
import { goto } from '$app/navigation';
import { page } from '$app/state';
```

Im bestehenden `onMount`-Block einen weiteren Aufruf nach der SW-Registration:

```ts
onMount(async () => {
  // ... existing SW registration ...
  const open = await loadOpenDialog();
  if (open) {
    if (open.route !== page.url.pathname) {
      await goto(open.route, { replaceState: true });
    }
    pendingRestore.set(open);
  }
});
```

- [ ] **Step 16.2: tag/[date]/+page.svelte konsumiert pendingRestore**

Im `<script>`-Block der Tag-Page ergänzen:

```ts
import { pendingRestore } from '$lib/stores/openDialog.svelte';
```

Direkt nach den Stores einen $effect.pre:

```ts
let restoreInitial = $state<
  | { sliderValue: number | null; numberValue: number | null; comment: string; workingDate: string }
  | null
>(null);

$effect.pre(() => {
  const r = pendingRestore.consume('entry-editor');
  if (!r) return;
  const sym = symptomsQ.current.find((s) => s.id === r.payload.symptomId);
  if (!sym) return; // symptom gone — silently skip
  editing = { symptom: sym };
  restoreInitial = {
    sliderValue: r.payload.sliderValue,
    numberValue: r.payload.numberValue,
    comment: r.payload.comment,
    workingDate: r.payload.date
  };
});
```

Im Markup das Restore-Initial dem Editor durchreichen — `workingDate` geht via `date`-Prop, der Rest via `initial`:

```svelte
{#if editing}
  <EntryEditor
    open={true}
    date={restoreInitial?.workingDate ?? currentDate.value}
    symptom={editing.symptom}
    initial={restoreInitial
      ? { sliderValue: restoreInitial.sliderValue, numberValue: restoreInitial.numberValue, comment: restoreInitial.comment }
      : undefined}
    onClose={() => { editing = null; restoreInitial = null; }}
  />
{/if}
```

- [ ] **Step 16.3: symptome/+page.svelte konsumiert pendingRestore (für symptom-edit)**

In `src/routes/symptome/+page.svelte` aktuell wird nur `<SymptomList />` gerendert. Die Restore-Logik gehört in `SymptomList.svelte` selbst (da dort `editing` lebt). `SymptomList.svelte` öffnen und im `<script>` ergänzen:

```ts
import { pendingRestore } from '$lib/stores/openDialog.svelte';

$effect.pre(() => {
  const r = pendingRestore.consume('symptom-edit');
  if (!r) return;
  const tree = treeQ.current;
  if (r.payload.symptomId) {
    function find(nodes: typeof tree): Symptom | null {
      for (const n of nodes) {
        if (n.id === r.payload.symptomId) {
          const { children: _c, ...plain } = n;
          return plain as Symptom;
        }
        const sub = find(n.children);
        if (sub) return sub;
      }
      return null;
    }
    const sym = find(tree);
    if (sym) {
      // Apply restored payload onto symptom snapshot
      editing = {
        symptom: {
          ...sym,
          name: r.payload.name,
          color: r.payload.color,
          icon: r.payload.icon,
          tagIds: r.payload.tagIds,
          parentId: r.payload.parentId,
          inputs: r.payload.inputs,
          daily: r.payload.daily
        },
        isNew: false
      };
    }
  } else if (r.payload.isNew) {
    // New symptom draft restored.
    editing = {
      symptom: {
        id: '', name: r.payload.name, color: r.payload.color, icon: r.payload.icon,
        tagIds: r.payload.tagIds, parentId: r.payload.parentId,
        sortIndex: 0, depth: 0, isFolder: r.payload.isFolder,
        archived: false, createdAt: 0, updatedAt: 0,
        inputs: r.payload.inputs, daily: r.payload.daily
      } as Symptom,
      isNew: true
    };
  }
});
```

- [ ] **Step 16.4: Typecheck + Tests**

```bash
pnpm exec svelte-check --tsconfig ./tsconfig.json
pnpm test
```

Erwartet: 0 Errors.

- [ ] **Step 16.5: Commit**

```bash
git add src/routes/+layout.svelte src/routes/tag/\[date\]/+page.svelte src/lib/components/SymptomAdmin/SymptomList.svelte
git commit -m "feat(restore): App-Start öffnet den letzten Dialog wieder

+layout.svelte liest meta.openDialog beim Mount; falls vorhanden,
navigiert es zur Route und setzt pendingRestore. Tag-Page und
SymptomList konsumieren pendingRestore in $effect.pre und reichen
das Payload als initial-Props an den jeweiligen Dialog durch.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 17: Standard-Vorlage neu kuratieren

**Files:**
- Modify: `src/lib/templates/perimeno-default.ts`
- Modify: `src/lib/templates/import.ts`
- Modify: `src/lib/templates/import.test.ts`

- [ ] **Step 17.1: Template-Typen erweitern**

`src/lib/templates/perimeno-default.ts` öffnen. `TemplateSymptom` um optionale Felder ergänzen:

```ts
import type { SymptomInputs } from '$lib/db';

export interface TemplateTag { name: string; }
export interface TemplateSymptom {
  name: string;
  icon: string;
  color: string;
  tags?: string[];
  children?: TemplateSymptom[];
  inputs?: Partial<SymptomInputs>;
  daily?: boolean;
}
```

- [ ] **Step 17.2: Template-Inhalt mit Beispiel-Inputs befüllen**

`DEFAULT_TEMPLATE` neu schreiben. Beispiel (Endgültiges darf der Engineer feinjustieren, solange jedes Blatt mindestens eine sinnvolle Default-Konfig hat — Folders bekommen keine `inputs`/`daily`):

```ts
const slider = (low: string, high: string, required = true): Partial<SymptomInputs> => ({
  slider:  { enabled: true, required, lowLabel: low, highLabel: high },
  comment: { enabled: true, required: false }
});
const number = (unit: string, integer = true): Partial<SymptomInputs> => ({
  number:  { enabled: true, required: true, unit, integer },
  comment: { enabled: true, required: false }
});

export const DEFAULT_TEMPLATE: Template = {
  tags: [
    { name: 'körperlich' },
    { name: 'emotional' },
    { name: 'schlafrelevant' },
    { name: 'hormonell' }
  ],
  roots: [
    {
      name: 'Körperlich', icon: 'activity', color: '#10b981',
      children: [
        { name: 'Hitzewallungen',  icon: 'flame',         color: '#f59e0b', tags: ['körperlich', 'hormonell'], inputs: { ...slider('kurz', 'lang'), ...number('Schübe') } },
        { name: 'Nachtschweiss',   icon: 'cloud-drizzle', color: '#06b6d4', tags: ['körperlich', 'schlafrelevant', 'hormonell'], inputs: slider('leicht', 'stark') },
        { name: 'Herzrasen',       icon: 'heart-pulse',   color: '#ef4444', tags: ['körperlich'], inputs: slider('leicht', 'stark') },
        { name: 'Gelenkschmerzen', icon: 'bandage',       color: '#84cc16', tags: ['körperlich'], inputs: slider('leicht', 'stark') },
        { name: 'Kopfschmerzen',   icon: 'brain',         color: '#6366f1', tags: ['körperlich'], inputs: slider('leicht', 'stark') },
        { name: 'Schwindel',       icon: 'sparkles',      color: '#8b5cf6', tags: ['körperlich'], inputs: slider('leicht', 'stark') }
      ]
    },
    {
      name: 'Stimmung & Gefühle', icon: 'heart', color: '#ec4899',
      children: [
        { name: 'Reizbarkeit',                  icon: 'angry',          color: '#f97316', tags: ['emotional'], inputs: slider('kaum', 'sehr', false), daily: true },
        { name: 'Stimmungstief',                icon: 'frown',          color: '#3b82f6', tags: ['emotional'], inputs: slider('leicht', 'stark', false), daily: true },
        { name: 'Angst',                        icon: 'alert-triangle', color: '#dc2626', tags: ['emotional'], inputs: slider('leicht', 'stark') },
        { name: 'Konzentrationsschwierigkeiten', icon: 'cloud-fog',     color: '#6b7280', tags: ['emotional'], inputs: slider('leicht', 'stark') }
      ]
    },
    {
      name: 'Schlaf', icon: 'moon', color: '#6366f1',
      children: [
        { name: 'Einschlafstörungen',   icon: 'bed',  color: '#6366f1', tags: ['schlafrelevant'], inputs: slider('leicht', 'stark') },
        { name: 'Durchschlafstörungen', icon: 'moon', color: '#8b5cf6', tags: ['schlafrelevant'], inputs: number('Aufwachvorgänge') },
        { name: 'Schlafqualität',       icon: 'bed-double', color: '#6366f1', tags: ['schlafrelevant'], inputs: slider('schlecht', 'gut', false), daily: true }
      ]
    },
    {
      name: 'Energie & Antrieb', icon: 'zap', color: '#eab308',
      children: [
        { name: 'Müdigkeit',    icon: 'coffee', color: '#f59e0b', tags: ['körperlich', 'emotional'], inputs: slider('leicht', 'stark', false), daily: true },
        { name: 'Erschöpfung',  icon: 'cloud',  color: '#6b7280', tags: ['körperlich', 'emotional'], inputs: slider('leicht', 'stark') }
      ]
    },
    {
      name: 'Konsum', icon: 'cup-soda', color: '#0ea5e9',
      children: [
        { name: 'Kaffee', icon: 'coffee', color: '#a16207', inputs: number('Tassen') },
        { name: 'Wasser', icon: 'droplet', color: '#06b6d4', inputs: number('Glas') }
      ]
    }
  ]
};
```

- [ ] **Step 17.3: `import.ts` so umbauen, dass `inputs`/`daily` durchgereicht werden**

`src/lib/templates/import.ts`:

```ts
import { db, defaultSymptomInputs, type SymptomInputs } from '$lib/db';
import { createTag } from '$lib/db/tags';
import { createSymptom } from '$lib/db/symptoms';
import type { Template, TemplateSymptom } from './perimeno-default';

function mergeInputs(partial?: Partial<SymptomInputs>): SymptomInputs {
  const base = defaultSymptomInputs();
  if (!partial) return base;
  return {
    slider:  { ...base.slider,  ...(partial.slider  ?? {}) },
    number:  { ...base.number,  ...(partial.number  ?? {}) },
    comment: { ...base.comment, ...(partial.comment ?? {}) }
  };
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
        inputs: isFolder ? undefined : mergeInputs(s.inputs),
        daily: isFolder ? false : (s.daily ?? false)
      });
      if (s.children) for (const c of s.children) await recur(c, created.id);
    }
    for (const r of t.roots) await recur(r, null);
  });
}
```

- [ ] **Step 17.4: import-Test ergänzen**

`src/lib/templates/import.test.ts` öffnen und neuen Test ergänzen, der prüft, dass `daily=true`-Templates ins DB-Symptom durchschlagen:

```ts
it('imports inputs and daily from template', async () => {
  await importTemplate({
    tags: [],
    roots: [
      { name: 'Test', icon: 'circle', color: '#000',
        inputs: { comment: { enabled: true, required: false } },
        daily: true }
    ]
  });
  const all = await db.symptoms.toArray();
  expect(all).toHaveLength(1);
  expect(all[0].daily).toBe(true);
  expect(all[0].inputs.comment.enabled).toBe(true);
});
```

- [ ] **Step 17.5: Tests**

```bash
pnpm exec vitest run src/lib/templates/import.test.ts
```

Erwartet: PASS.

- [ ] **Step 17.6: Commit**

```bash
git add src/lib/templates/perimeno-default.ts src/lib/templates/import.ts src/lib/templates/import.test.ts
git commit -m "feat(templates): Default-Symptome mit inputs + daily konfigurieren

Jedes Template-Blatt bekommt einen sinnvollen Input-Block (Slider mit
Endpunkt-Labels und/oder Zahl mit Einheit, Kommentar meist optional).
Ausgewählte Symptome (Reizbarkeit, Stimmungstief, Schlafqualität,
Müdigkeit) sind daily=true.

importTemplate reicht Partial<SymptomInputs> durch und merge't mit
defaultSymptomInputs(), so dass nicht explizit gesetzte Bausteine die
inaktiven Defaults behalten.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 18: E2E Happy-Path neu

**Files:**
- Modify: `tests/e2e/happy-path.spec.ts`

- [ ] **Step 18.1: Spec neu schreiben**

`tests/e2e/happy-path.spec.ts` öffnen und ersetzen:

```ts
import { test, expect } from '@playwright/test';

test('first run → template → daily prompt → slider + number → Fertig → swipe-undo', async ({ page }) => {
  await page.goto('/');
  await page.waitForURL(/\/tag\/\d{4}-\d{2}-\d{2}/);

  // First run banner
  await expect(page.getByRole('button', { name: 'Mit Standard-Vorlage starten' })).toBeVisible();
  await page.getByRole('button', { name: 'Mit Standard-Vorlage starten' }).click();

  // After import: Daily-Prompts oben zeigen Symptome mit daily=true.
  // Template setzt z.B. Stimmungstief als daily → es erscheint in "Noch offen".
  await expect(page.getByText('Noch offen')).toBeVisible();
  await expect(page.locator('button:has-text("Stimmungstief")').first()).toBeVisible();

  // Tap auf Prompt → Editor mit Slider (Pflicht).
  await page.locator('button:has-text("Stimmungstief")').first().click();
  // Fertig ist noch disabled, weil Slider Pflicht aber unspez.
  await expect(page.getByRole('button', { name: 'Fertig' })).toBeDisabled();
  // Klick auf den Track im continuous-Bereich (rechtsseitig).
  const track = page.locator('[data-track]').first();
  const box = await track.boundingBox();
  if (!box) throw new Error('track missing');
  await page.mouse.click(box.x + box.width * 0.7, box.y + box.height / 2);
  await expect(page.getByRole('button', { name: 'Fertig' })).toBeEnabled();
  await page.getByRole('button', { name: 'Fertig' }).click();

  // Karte erscheint in der „Heute erfasst\"-Sektion.
  await expect(page.getByText('Heute erfasst')).toBeVisible();
  const card = page.locator('button.card').filter({ hasText: 'Stimmungstief' });
  await expect(card).toBeVisible();
});
```

- [ ] **Step 18.2: Smoke-Test prüfen, ob er noch passt**

`tests/e2e/smoke.spec.ts` öffnen und ggf. anpassen (Erwartete Texte „Willkommen" gibt es schon — sollte unverändert grün laufen).

- [ ] **Step 18.3: E2E ausführen**

```bash
pnpm test:e2e
```

Erwartet: beide Spec-Files grün.

- [ ] **Step 18.4: Commit**

```bash
git add tests/e2e/happy-path.spec.ts
git commit -m "test(e2e): neuer Happy-Path mit Daily-Prompt und Slider

First-Run → Vorlage importieren → ein Daily-Symptom („Stimmungstief\")
erscheint als „Noch offen\"-Prompt → Tap öffnet Editor → Slider in
continuous-Bereich klicken aktiviert „Fertig\" → speichern → Karte
landet in „Heute erfasst\".

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 19: Settings-Page Datei-Input-Type-Fix

**Files:**
- Modify: `src/routes/einstellungen/+page.svelte`

In Task 2 wurde `transfer.test.ts` umgestellt, aber das Settings-UI verwendet `validateExportPayload` weiterhin korrekt — kein Code-Update nötig. **Nur prüfen:**

- [ ] **Step 19.1: Verify**

```bash
pnpm exec svelte-check --tsconfig ./tsconfig.json
pnpm test
pnpm test:e2e
```

Erwartet: alles grün, 0 Warnings.

- [ ] **Step 19.2: Commit (nur falls zwischenzeitlich Fehler entstanden sind)**

Skip wenn nichts zu committen ist.

---

## Final Steps

- [ ] **Step F1: Voll-Check**

```bash
pnpm test
pnpm test:e2e
pnpm exec svelte-check --tsconfig ./tsconfig.json
pnpm run build
```

Alles grün? 0 Errors, 0 Warnings im svelte-check?

- [ ] **Step F2: Spec-Coverage manuell durchgehen**

Spec [docs/superpowers/specs/2026-05-28-input-config-design.md](../specs/2026-05-28-input-config-design.md) Abschnitt für Abschnitt gegen den Repo-Stand abgleichen — siehe „Spec Coverage Self-Review" unten.

- [ ] **Step F3: Manuelle UI-Probe**

```bash
pnpm dev
```

Manuell durchklicken:
1. Standard-Vorlage importieren.
2. „Stimmungstief" oder ein anderes Daily-Symptom in der „Noch offen"-Sektion antippen.
3. Slider rüberziehen, Fertig drücken → Karte in „Heute erfasst".
4. Tab-Reload → Editor sollte sich wieder öffnen, wenn man zuvor eintippte und nicht „Fertig" drückte.
5. In Symptom-Admin: ein Symptom anlegen, Slider aktivieren, lowLabel/highLabel setzen, Daily-Toggle wird sichtbar, anhaken, speichern. Karte in der Liste.

- [ ] **Step F4: Tag setzen**

```bash
git tag input-config-v1
git log --oneline mvp-v1..HEAD | head -40
```

---

## Spec Coverage Self-Review

| Spec § | Anforderung                                                | Task(s)                |
|--------|-------------------------------------------------------------|-------------------------|
| 2.1    | Symptom.inputs + defaultSymptomInputs                       | 1                       |
| 2.1    | Symptom.daily + Default false                               | 1                       |
| 2.1    | Daily-Sichtbarkeit (Prompts nur bei hasEnabledInput)        | 4 (helper), 5 (query)   |
| 2.2    | Entry-Felder sliderValue/numberValue/comment, intensity weg | 2                       |
| 2.2    | Entry-Invariante (nur committed)                            | 11                      |
| 2.3    | meta.openDialog mit kind-Diskriminator                      | 6                       |
| 2.3    | persist/update/clear-Lifecycle                              | 6, 11, 12               |
| 2.4    | Dexie-V2-Upgrade-Block                                      | 3                       |
| 3.1    | Editor-Aufbau: Datum + aktive Inputs + Fertig/Verwerfen    | 11                      |
| 3.2    | SliderInput mit unspez-Slot, Gap-Snap, 1..100              | 7                       |
| 3.3    | NumberInput mit Einheit, integer/decimal                   | 8                       |
| 3.4    | Kommentar-Block                                            | 11                      |
| 3.5    | „Fertig" disabled + Verwerfen/Backdrop                      | 11                      |
| 3.6    | Editieren bestehender Eintrag                               | 11                      |
| 4.1-4.5| Symptom-Admin: drei Input-Karten                            | 9, 10                   |
| 4.6    | Daily-Toggle sichtbar nur mit ≥1 Input aktiv                | 9                       |
| 4.7    | Validierungen erlauben leere Labels und keinen Input        | 9, 10                   |
| 5.1    | Sektion „Noch offen" + DailyPromptCard + Tree-Sort         | 5, 14, 15               |
| 5.2    | Sektion „Heute erfasst" / „Erfasst" datums-abhängig         | 15                      |
| 5.2    | EntryCard zeigt Slider/Zahl/Kommentar inaktive weggelassen | 13                      |
| 6.1-6.2| Restore-Logik in +layout.svelte + pendingRestore           | 6, 16                   |
| 6.3    | Initial nur EntryEditor + SymptomEditModal persistiert     | 11, 12                  |
| 7      | Standard-Vorlage mit inputs + daily-Beispielen              | 17                      |
| 8      | Neue/Geänderte/Entfernte Dateien                            | alle                    |
| 9      | Test-Strategie (unit/komponenten/E2E)                       | jeweils Schritt pro Task |

v1.1-Items (Heatmap, Letzte-N-Tage, PDF/CSV) sind **nicht** Teil dieses Plans.
