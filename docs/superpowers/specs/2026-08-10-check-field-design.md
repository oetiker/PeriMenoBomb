# Feldtyp „Checkbox" (`check`)

Datum: 2026-08-10

## Ziel

Ein Symptom soll ankreuzbare Teilaspekte tragen können — „Subsymptome", die
man nur abhakt, statt für jede Kleinigkeit einen Slider zu bedienen.
Beispiel: *Hitzewallungen* mit Slider „Intensität" plus den Häkchen
„nachts aufgewacht" und „Kleidung gewechselt".

Das Feldmodell (`Symptom.fields: MetaField[]`) ist bereits generisch und
geordnet; die Aufgabe ist ein zusätzlicher Feldtyp, keine Umstrukturierung.

## Semantik

Zwei Zustände, nicht drei: **nur „angekreuzt" zählt.** Ein leeres Kästchen
bedeutet „nicht zutreffend / nichts erfasst" und wird nirgends angezeigt.
Ein explizites „nein" ist bewusst nicht vorgesehen — wer das braucht, nimmt
ein `select`-Feld mit den Optionen ja/nein.

## Datenmodell

`src/lib/db/index.ts`:

```ts
export type FieldType = 'slider' | 'number' | 'text' | 'select' | 'check';

/** Boolean tick-box. Carries no config beyond the shared BaseField — the
    label IS the question. */
export interface CheckField extends BaseField { type: 'check' }

export type MetaField = SliderField | NumberField | TextField | SelectField | CheckField;
```

`Entry.values` wird von `Record<string, number | string | null>` auf
`Record<string, number | string | boolean | null>` verbreitert. Der gleiche
Typ taucht in `entries.ts` (`EntryValues`), `EntryEditor.svelte` und
`openDialog.svelte.ts` auf und wird dort mitgezogen.

Gespeichert wird:

- angekreuzt → `values[fieldId] = true`
- abgewählt → `values[fieldId] = false`
- nie berührt → kein Key

`false` wird bewusst geschrieben statt den Key zu löschen: `upsertEntry`
merged (`{...existing.values, ...input.values}`), ein entfernter Key würde
ein früher gespeichertes `true` also nicht überschreiben — das Häkchen liesse
sich nie wieder abwählen. Für alles Sichtbare gilt trotzdem „nur angekreuzt
zählt": `false` und fehlender Key werden in Anzeige, Report, PDF und Heatmap
identisch behandelt (nämlich gar nicht).

## Keine DB-Migration

`fields` ist ein freies Array innerhalb des `symptoms`-Stores, `values` ein
freies Objekt im `entries`-Store. Ein neuer Feldtyp ändert weder Stores noch
Indizes. `CURRENT_DB_VERSION` bleibt **6**, es kommt kein Upgrade-Hook dazu.
Bestehende Datensätze, Backups und der Import-Replay-Pfad
(`importMigrate.ts`) sind unberührt.

## Symptom-Konfiguration

`src/lib/components/SymptomAdmin/FieldListEditor.svelte`:

- `TYPE_LABELS.check = 'Häkchen'`
- `ADD_ORDER` wird zu `['slider', 'number', 'select', 'check', 'text']`
- kein `body`-Block — ein Häkchen-Feld hat nichts zu konfigurieren ausser
  seinem Label
- die **„Pflicht"-Checkbox wird für `check` ausgeblendet**. Ein
  Pflicht-Häkchen hiesse „du musst ankreuzen", was der Semantik widerspricht.
  `required` bleibt konstant `false`.

`src/lib/db/fields.ts`:

```ts
case 'check': return { id, type, label: 'Zutreffend', required: false };
```

Löschen/Wiederherstellen, Drag-Reorder und Label-Bearbeitung funktionieren
unverändert über die generischen Pfade.

## Eintrags-Dialog

Neue Komponente `src/lib/components/EntryEditor/CheckInput.svelte`:

```
[☐] Nachts aufgewacht
```

Ein `<label>` mit Checkbox und Text, ganze Zeile als Tap-Target, Mindesthöhe
44px (Touch). Props: `value: boolean`, `label: string`,
`onChange: (v: boolean) => void`.

In `EntryEditor.svelte` wird für `field.type === 'check'` die übliche
Grossbuchstaben-`.caption` **übersprungen** — das Label steht schon neben dem
Kästchen, eine Wiederholung wäre Lärm. Alle anderen Feldtypen behalten ihre
Caption.

Der Handler ist ein schlichtes `setValue(field.id, checked)` — keine
Sonderbehandlung nötig.

## Anzeige

`entryFieldDisplays` in `src/lib/db/fields.ts` behandelt `check` wie folgt:

- `v === true` → `{ field, text: 'ja' }`
- alles andere (`false`, fehlend) → Feld wird übersprungen

Das ergibt „Nachts aufgewacht: ja" in `EntryCard`, `ReportEntryRow` und im
PDF-Export (`report/pdf.ts`), die alle über diese eine Funktion gehen.

## Zyklus-Heatmap

`isValueField` nimmt `'check'` auf — ein Häkchen-Feld ist damit im
Zyklus-Report als Wert-Serie wählbar (`routes/report/cycle/+page.svelte`
filtert über genau diese Funktion, braucht keine Änderung).

`src/lib/report/heatmap.ts`:

- `valueDomain` gibt für `check` `null` zurück (nichts zu normalisieren)
- `classifyCell`: `v === true` → `{ kind: 'value', intensity: 1 }`
  (volle Symptomfarbe), `false`/fehlend → `NONE`

## Validierung

`validateEntry` in `entries.ts` überspringt `check` implizit, weil
`required` für diesen Typ nie `true` wird. Der `else`-Zweig der Funktion
(bisher „text") muss trotzdem explizit auf `text` prüfen, damit ein
theoretisch von Hand gesetztes `required: true` auf einem Häkchen nicht
fälschlich als Textfeld validiert wird.

## Tests

- `fields.test.ts` — `newField('check')`, `isValueField`,
  `entryFieldDisplays` (true → „ja", fehlend/false → ausgelassen)
- `entries.test.ts` — `validateEntry` blockiert nie wegen eines
  Häkchen-Felds
- `heatmap.test.ts` — `classifyCell` für true / fehlend, `valueDomain` null
- `CheckInput.test.ts` — rendert Label, meldet true/false
- `FieldListEditor.test.ts` — „Häkchen" hinzufügen, kein Pflicht-Toggle
  sichtbar, kein Body
- `EntryEditor.test.ts` — Ankreuzen speichert `true`, Abwählen eines zuvor
  gespeicherten Häkchens schreibt `false` (überlebt den Merge in
  `upsertEntry`), keine Caption für `check`

## Bewusst nicht enthalten

- Drei-Zustands-Logik (ja/nein/unbeantwortet)
- Ein Multi-Select-Feld mit mehreren Häkchen in einem Feld — mehrere
  einzelne `check`-Felder decken den Fall ab und sind einzeln in der Heatmap
  auswertbar
- Zahlenwerte/Gewichte auf einem Häkchen
