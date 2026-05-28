# PeriMenoBomb — Per-Symptom Input-Konfiguration

**Datum:** 2026-05-28
**Status:** Design (vor Implementierungs-Plan)
**Vorgänger-Spec:** [2026-05-27-perimenobomb-design.md](./2026-05-27-perimenobomb-design.md)

---

## 1. Zweck

Das aktuelle Modell hat pro Eintrag genau ein Intensitäts-Feld mit den fixen Stufen `leicht / mittel / stark / null` und ein Kommentarfeld. Das ist für viele Symptome zu starr (eine „leichte" Migräne ist semantisch etwas anderes als „leichte" Müdigkeit) und für andere zu wenig (Wasser-Konsum, Schlafdauer).

Diese Spec ersetzt das Intensitäts-Modell durch eine **per Symptom konfigurierbare Eingabe-Palette** aus drei Bausteinen:

1. **Slider** mit zwei frei beschriftbaren Endpunkten und einer dedizierten „unspezifisch"-Position links davon.
2. **Zahlenfeld** mit frei beschriftbarer Einheit.
3. **Kommentar** (wie bisher).

Jeder Baustein lässt sich pro Symptom unabhängig **aktivieren** und **als Pflicht** markieren.

Zusätzlich kommt eine **Persistenz für offene Dialoge**: schließt die Nutzerin die App mit offenem Editor, kehrt sie beim nächsten Start mit allen Eingaben in den gleichen Dialog zurück.

Ein neuer **Daily-Flag** pro Symptom erzeugt eine graue „noch offen"-Erinnerungs-Karte oben in der Tagesliste, solange für den angezeigten Tag kein Eintrag existiert — unverbindlich, nur zur Selbsterinnerung.

**Backward-Compat:** keine. Die App ist nicht deployed; bestehende Einträge werden beim Schema-Upgrade verworfen.

---

## 2. Datenmodell

### 2.1 Symptom — neuer `inputs`-Block

```ts
interface SymptomInputs {
  slider: {
    enabled:   boolean;   // Default: false
    required:  boolean;   // Default: false
    lowLabel:  string;    // Default: ""
    highLabel: string;    // Default: ""
  };
  number: {
    enabled:  boolean;    // Default: false
    required: boolean;    // Default: false
    unit:     string;     // Default: ""
    integer:  boolean;    // Default: true
  };
  comment: {
    enabled:  boolean;    // Default: false
    required: boolean;    // Default: false
  };
}

interface Symptom {
  // bestehende Felder unverändert
  id:        string;
  name:      string;
  color:     string;
  icon:      string;
  tagIds:    string[];
  parentId:  string | null;
  sortIndex: number;
  depth:     number;
  isFolder:  boolean;
  archived:  boolean;
  createdAt: number;
  updatedAt: number;

  // NEU
  inputs: SymptomInputs;
  daily:  boolean;        // Default: false; zeigt eine graue „noch offen"-Prompt-Karte
                          // in der Tagesliste, solange kein Eintrag für den Tag existiert
}
```

**Defaults für neu angelegte Symptome:** alle drei Inputs `enabled=false`, `required=false`, alle String-Felder leer, `integer=true`, `daily=false`.

**Folders:** `inputs` und `daily` sind auch auf Ordnern vorhanden, haben aber keine Wirkung — Ordner haben weiterhin keine Einträge und erscheinen nie als Daily-Prompt.

**Daily-Sichtbarkeit:** Eine Daily-Prompt-Karte erscheint nur, wenn `daily=true` UND mindestens einer der drei Inputs `enabled=true` ist. Symptome mit `daily=true` aber komplett deaktivierten Inputs ergeben keine Prompts (es gibt nichts zu erfassen) — das Datenfeld wird respektiert, aber nicht gerendert.

### 2.2 Entry

```ts
interface Entry {
  id:          string;          // `${date}__${symptomId}` (unverändert)
  date:        string;          // 'YYYY-MM-DD' (unverändert)
  symptomId:   string;          // unverändert
  updatedAt:   number;          // unverändert

  // NEU statt `intensity`
  sliderValue: number | null;   // null = unspezifisch · 1..100 = Position
  numberValue: number | null;   // null = kein Wert
  comment:     string;          // "" wenn leer (unverändert in Form)
}
```

`Intensity`-Typ und `Entry.intensity` werden entfernt.

**Invariante:** Ein Eintrag existiert nur in `entries`, wenn die Nutzerin „Fertig" gedrückt und die Pflicht-Validierung bestanden hat. Es gibt keine ungültigen, partiellen oder „Stub"-Einträge in der Tabelle.

### 2.3 Open-Dialog-Autosave

Ein einzelner Eintrag im bestehenden `meta`-Store mit Key `openDialog`:

```ts
type OpenDialogState =
  | {
      kind: 'entry-editor';
      route: string;                   // z.B. '/tag/2026-05-28'
      payload: {
        date:        string;           // workingDate
        symptomId:   string;
        sliderValue: number | null;
        numberValue: number | null;
        comment:     string;
      };
    }
  | {
      kind: 'symptom-edit';
      route: string;                   // z.B. '/symptome'
      payload: {
        symptomId: string | null;      // null = neuer Symptom-Entwurf
        isNew:     boolean;
        isFolder:  boolean;            // für neu, dann unveränderlich
        name:      string;
        color:     string;
        icon:      string;
        tagIds:    string[];
        parentId:  string | null;
        inputs:    SymptomInputs;
        view:      'main' | 'icons';
      };
    };
```

**Lebenszyklus:**

- Beim Öffnen eines persistierten Dialogs wird `meta.openDialog` initial geschrieben (Snapshot des Anfangsstands).
- Jede Eingabe-Änderung im Dialog aktualisiert das Payload (debounce-frei reicht, schreibend wenige Felder).
- „Fertig" / „Speichern" mit erfolgreicher Validierung → Dialog schließt, `meta.openDialog` wird gelöscht.
- ✕ / Backdrop-Tap → Dialog schließt, `meta.openDialog` wird gelöscht. (Eingaben gehen verloren — bewusst.)
- Navigation per Bottom-Nav oder Browser-Back → Dialog wird unmountet, `meta.openDialog` wird gelöscht.
- App-Kill (Phone-Sleep, Browser-Close, kein User-Click) → `meta.openDialog` bleibt unverändert in der DB.

**Beim App-Start** (`+layout.svelte` onMount): liegt `meta.openDialog` vor und ist die Route nicht die aktuelle, wird zur Route navigiert; danach wird der Dialog mit dem Payload geöffnet. Schlägt das Restore fehl (Symptom inzwischen gelöscht, Route ungültig), wird `meta.openDialog` ohne Anzeige verworfen.

**Geltungsbereich:** initial nur `EntryEditor` und `SymptomEditModal`. Confirm/Prompt-Modals brauchen keine Persistenz (kurzlebig, kein Datenverlust-Risiko).

### 2.4 Dexie-Schema-Version 2

```ts
this.version(2).stores({
  symptoms: 'id, parentId, [parentId+sortIndex], archived',
  tags:     'id, name',
  entries:  'id, date, symptomId, [date+symptomId]',
  meta:     'key'
}).upgrade(async (tx) => {
  // 1. Alle bestehenden Einträge verwerfen — neues Schema, keine sinnvolle Migration.
  await tx.table('entries').clear();
  // 2. Symptome ohne `inputs`-Block und ohne `daily`-Flag mit Defaults versehen.
  await tx.table('symptoms').toCollection().modify((s) => {
    if (!s.inputs) s.inputs = defaultSymptomInputs();
    if (typeof s.daily !== 'boolean') s.daily = false;
  });
  // 3. Falls `meta.openDialog` aus einer Test-Session existiert: löschen.
  await tx.table('meta').delete('openDialog');
});
```

Die Standard-Vorlage (`perimeno-default.ts`) wird so überarbeitet, dass jedes Template-Symptom einen sinnvollen `inputs`-Block hat (Beispiele in § 7).

---

## 3. UX — Editor

### 3.1 Aufbau

Bei Tap auf ein Symptom in der Tagesliste oder im Symptom-Sheet:

1. Editor öffnet sich (Modal). Header zeigt Badge, Symptomname, optionales Pfad-Breadcrumb.
2. **Datum-Zeile** wie heute — erlaubt das Verschieben des Eintrags auf ein anderes Datum.
3. **Pro aktivem Input-Baustein** ein Block in der Konfigurations-Reihenfolge Slider → Zahl → Kommentar.
4. **„Fertig"-Button** (primary) und **„Verwerfen"-Link** (sekundär, danger).

Sind alle drei Inputs deaktiviert, zeigt der Editor nur Datum und „Fertig". „Fertig" speichert dann einen reinen Marker-Eintrag (alle Datenfelder leer/null).

### 3.2 Slider-Block

```
?-------x-------------x
unspez  leicht     hoch
```

- **Custom Slider** (kein `<input type="range">`), pointer-event-basiert. Patterns aus `SymptomList`-Drag-Code wiederverwendbar.
- **Track-Struktur:** links ein „unspez"-Slot (gestrichelte Linie, ca. 30 px breit). Ein Gap (ca. 18 px, ohne Track). Rechts daneben der durchgehende Track von leicht bis hoch.
- **Thumb-Verhalten:**
  - Thumb auf unspez-Slot: gespeicherter Wert ist `null`.
  - Thumb auf dem kontinuierlichen Track: gespeicherter Wert ist `1..100`.
  - Beim Ziehen über den Gap snappt der Thumb hart zwischen unspez (`null`) und leicht (Wert `1`). Es gibt keine Werte im Gap, und der Wert `0` kommt nicht vor.
- **Storage:** `sliderValue = null` für unspez, `sliderValue = 1..100` für kontinuierlich.
- **Labels:** Unter dem Track stehen drei Labels: `unspez` (fix), `lowLabel` (aus Symptom-Config), `highLabel`.
- **Pflicht-Marker:** roter `*` rechts neben dem Block-Caption („Intensität *").
- **Initial-Position** beim Öffnen eines leeren Editors: Thumb auf unspez (= `null`).
- **Pflicht-Validierung:** scheitert, solange `sliderValue === null`.

### 3.3 Zahlen-Block

- Eingabe: schmales numerisches Input-Feld (`width: 6em`, rechtsbündig), daneben das Einheit-Label als Text.
- `inputmode="numeric"` wenn `integer=true`, sonst `inputmode="decimal"`.
- Default-Wert: leer (`null`). Eingabe wird beim `input`/`change`-Event als Number geparst; ungültige Strings → `numberValue = null`.
- Pflicht-Validierung: scheitert, solange `numberValue === null` oder `NaN`.

### 3.4 Kommentar-Block

- Wie heute: `<textarea>` mit Placeholder.
- Pflicht-Validierung: scheitert, solange `comment.trim().length === 0`.

### 3.5 „Fertig" / „Verwerfen"

- **„Fertig"** ist deaktiviert (greyed, nicht klickbar), solange irgendeine Pflicht-Validierung scheitert.
- Tap auf einen deaktivierten „Fertig"-Button erzeugt ein kurzes Shake-Animation am betroffenen Block + Snackbar „Bitte Pflichtfelder ausfüllen".
- Beim Klick auf „Fertig" mit erfüllter Validierung: Eintrag wird in `entries` geschrieben, `meta.openDialog` gelöscht, Modal geschlossen.
- **„Verwerfen"** (sekundär): Modal schließt, `meta.openDialog` gelöscht, kein Eintrag entsteht. Keine Snackbar — die Aktion ist explizit.
- **Backdrop-Tap / ✕**: identisch mit „Verwerfen" — kein Eintrag, Eingaben verloren. (Keine zusätzliche Confirm-Stufe; die Persistenz greift nur bei App-Kill.)

### 3.6 Editieren eines bestehenden Eintrags

Tap auf eine Karte in der Tagesliste öffnet den Editor mit den gespeicherten Werten aus `entries` als Anfangs-Payload. „Fertig" überschreibt den bestehenden Eintrag; „Verwerfen" lässt den bestehenden Eintrag unangetastet.

Tritt die Pflicht-Validierung an, weil die Symptom-Konfig nach dem Anlegen verschärft wurde (z.B. Slider neu auf Pflicht), kann ein vorher unvollständig gefüllter Eintrag beim Edit nicht mit „Fertig" wieder gespeichert werden, bis die Pflicht erfüllt ist. „Verwerfen" erlaubt das Schließen ohne Änderung — der alte (technisch nun unvollständige) Eintrag bleibt erhalten.

---

## 4. UX — Symptom-Admin

### 4.1 Einbettung

Inline-Sektion **„Eingaben"** im bestehenden `SymptomEditModal`, **nach** „Eltern-Ordner" und **vor** „Speichern" / „Archivieren".

Für Ordner (`isFolder=true`) wird die Sektion nicht angezeigt.

### 4.2 Aufbau

Drei „Input-Karten" untereinander, je eine pro Baustein (Slider, Zahl, Kommentar). Pro Karte:

- **Karten-Header** mit Titel („Slider" / „Zahl" / „Kommentar") und zwei Toggles rechts:
  - **Aktiv** (Checkbox)
  - **Pflicht** (Checkbox; nur klickbar wenn „Aktiv" gesetzt)
- **Karten-Body** ist nur sichtbar wenn „Aktiv" gesetzt ist.

### 4.3 Slider-Karte (Body)

- Zwei Texteingaben:
  - **Linker Endpunkt** (für `lowLabel`), Placeholder „z.B. kaum spürbar".
  - **Rechter Endpunkt** (für `highLabel`), Placeholder „z.B. unerträglich".
- Validierung: leere Strings sind erlaubt (Placeholder-Hint reicht).

### 4.4 Zahl-Karte (Body)

- **Einheit** (Texteingabe für `unit`), Placeholder „z.B. Tassen".
- **Nur ganze Zahlen** (Checkbox, gebunden an `integer`; Default `true`).

### 4.5 Kommentar-Karte (Body)

- Leer. (Nichts zu konfigurieren außer aktiv/pflicht.)

### 4.6 Daily-Toggle

Unterhalb der drei Input-Karten, **nur sichtbar** wenn mindestens einer der drei Inputs `enabled=true` ist:

- **Checkbox „Täglich erfassen"**, gebunden an `Symptom.daily`.
- Hilfstext: „Erscheint jeden Tag als graue Erinnerungs-Karte oben in der Liste, bis ein Eintrag erfasst ist."

Wenn die Nutzerin alle Inputs deaktiviert, verschwindet der Toggle aus dem UI; der gespeicherte `daily`-Wert bleibt aber unverändert (taucht beim erneuten Aktivieren wieder auf).

### 4.7 Validierung beim Speichern

- Es ist explizit erlaubt, ein Symptom mit allen drei Inputs inaktiv zu speichern (`daily` ist dann irrelevant — siehe § 2.1).
- Es ist explizit erlaubt, einen aktiven Slider/Zahl ohne `lowLabel`/`highLabel`/`unit` zu speichern. Im Editor erscheinen dann nur Placeholder.

---

## 5. UX — Tagesliste

Die Tagesliste hat zwei Sektionen (in dieser Reihenfolge):

### 5.1 Sektion „Noch offen" — Daily-Prompts

- Section-Header **„Noch offen"** (datums-unabhängiger Text; gilt sowohl für heute als auch retrospektiv und prospektiv).
- Inhalt: pro nicht-archiviertes Symptom mit `daily=true` UND mindestens einem aktiven Input UND **ohne** Entry für das angezeigte Datum eine **graue Prompt-Karte**:
  - Badge ausgegraut (z.B. 50 % Opazität wie bei archivierten Items).
  - Symptomname in Text-Dim-Farbe.
  - Status-Zeile: „noch nicht erfasst".
- Sortierung: stable Symptom-Tree-Reihenfolge (rekursiv depth-first, dieselbe wie in der Symptom-Admin-Liste).
- Tap auf eine Prompt-Karte: öffnet den `EntryEditor` für `(angezeigtes Datum, symptomId)` — derselbe Flow wie beim Pick aus dem Symptom-Sheet.
- Wird die Sektion leer (keine offenen Daily-Symptome), wird der ganze Header weggelassen.

### 5.2 Sektion „Erfasst"

- Section-Header datums-abhängig:
  - Wenn das angezeigte Datum `todayKey()` ist → **„Heute erfasst (N)"**.
  - Sonst → **„Erfasst (N)"** (kein „Heute" für andere Tage — Bugfix gegenüber aktuellem Code in `EntryList.svelte:31`).
- Inhalt: alle Entries aus `entries` für das angezeigte Datum, in Insertion-Order (`updatedAt` aufsteigend) — wie heute.
- Pro Karte:
  - Badge + Symptomname.
  - **Status-Zeile:** Zusammenfassung der vorhandenen Werte, in der Reihenfolge Slider → Zahl → Kommentar:
    - Slider: `lowLabel/highLabel`-Mini-Visualisierung mit Position; bei `null` → „unspezifisch".
    - Zahl: `numberValue + ' ' + unit` (Einheit weggelassen wenn leer).
    - Kommentar: 💬-Icon wenn `comment.trim().length > 0`.
  - Inaktive Inputs des Symptoms werden in der Karte weggelassen.
- Swipe nach links: bestehendes Verhalten (Eintrag entfernen + Undo-Snackbar). Nach dem Entfernen erscheint der Eintrag — falls er zu einem Daily-Symptom gehört — automatisch wieder als Prompt in Sektion 5.1.
- Empty-State: wenn beide Sektionen leer sind (keine Einträge UND keine offenen Daily-Prompts), Text „Tippe das + unten, um Symptome zu erfassen." Ansonsten kein eigener Empty-State pro Sektion (leere Sektionen werden komplett ausgeblendet).

---

## 6. UX — Open-Dialog-Restore

### 6.1 Beim Öffnen eines persistierbaren Dialogs

Der Dialog ruft beim Mount einen kleinen Helfer (`persistDialog(kind, route, payload)`) auf, der `meta.openDialog` schreibt. Bei jeder Änderung seiner internen `$state`-Variablen ruft der Dialog `updateDialogPayload(payload)`.

Bei Close-Aktionen (Fertig, Verwerfen, ✕, Backdrop, Navigation away) wird `clearDialog()` aufgerufen.

### 6.2 Beim App-Start

In `+layout.svelte` `onMount`:

1. `state = await getMeta('openDialog')`.
2. Falls `state` fehlt → nichts tun.
3. Ist `state.route` nicht die aktuelle URL → `goto(state.route, { replaceState: true })` und warten, bis die neue Route gemountet ist.
4. Trigger einen reaktiven Store `pendingRestore`, den der zuständige Route-Container (z.B. `tag/[date]/+page.svelte`) liest und damit den entsprechenden Dialog mit `state.payload` öffnet.
5. Bei fehlgeschlagenem Restore (Symptom existiert nicht mehr, Route-Container kennt den Dialog nicht) → `clearDialog()` stillschweigend.

### 6.3 Persistierte Dialoge initial

- `EntryEditor` (`kind: 'entry-editor'`)
- `SymptomEditModal` (`kind: 'symptom-edit'`)

Andere Modals (`PromptModal`, `ConfirmModal`, `IconPicker`, Sheet) sind **nicht** persistiert. Begründung:

- `PromptModal` und `ConfirmModal` sind kurzlebige, klar trennbare Confirm-Schritte.
- `IconPicker` ist eine Sub-View innerhalb des `SymptomEditModal` und wird über dessen `view`-State mit-persistiert.
- `Sheet` (Symptom-Sheet) hat keinen relevanten Eingabe-State; ein Tap navigiert weiter.

---

## 7. Standard-Vorlage — Beispiel-Mapping

Die `perimeno-default`-Vorlage wird so überarbeitet, dass jedes Symptom einen sinnvollen `inputs`-Block bekommt. Beispiele (vorläufig, Endgültiges während Implementierung):

| Symptom              | Slider                                 | Zahl          | Kommentar |
|----------------------|----------------------------------------|---------------|-----------|
| Hitzewallungen       | leicht / stark · pflicht               | Schübe (Ganz) | optional  |
| Schlafqualität       | schlecht / gut · pflicht               | —             | optional  |
| Reizbarkeit          | kaum / sehr · pflicht                  | —             | optional  |
| Konzentrationsproblem| leicht / stark · pflicht               | —             | optional  |
| Kaffee               | —                                      | Tassen (Ganz) | optional  |
| Wasser               | —                                      | Glas (Ganz)   | optional  |

Ordner-Items bekommen leere Default-Inputs (irrelevant, da Ordner keine Einträge haben).

---

## 8. Komponenten-Architektur

### 8.1 Neu

- `src/lib/components/EntryEditor/SliderInput.svelte` — Custom-Slider mit unspez-Slot.
- `src/lib/components/EntryEditor/NumberInput.svelte` — Kompaktes Zahlenfeld + Einheit-Label.
- `src/lib/components/SymptomAdmin/InputConfigSection.svelte` — Die drei Input-Karten + Daily-Toggle im Symptom-Edit-Modal.
- `src/lib/components/DayView/DailyPromptCard.svelte` — graue Prompt-Karte für offene Daily-Symptome in Sektion 5.1.
- `src/lib/stores/openDialog.svelte.ts` — Persistenz-Helfer (`persistDialog` / `updateDialogPayload` / `clearDialog` / `pendingRestore`).

### 8.2 Geändert

- `src/lib/db/index.ts` — Typen `Symptom` (+ `daily`, + `inputs`), `Entry`; Schema-Version 2; `Intensity`-Typ entfernt.
- `src/lib/db/symptoms.ts` — `createSymptom` setzt `defaultSymptomInputs()` und `daily=false`. Neue Query `listDailySymptomsForDate(date)` liefert nicht-archivierte Symptome mit `daily=true && hasEnabledInput(inputs)`, sortiert nach Symptom-Tree-Reihenfolge.
- `src/lib/db/entries.ts` — `UpsertEntryInput` arbeitet auf den neuen Feldern. Neue Hilfsfunktion `validateEntry(symptom, entry): { ok: boolean, missing: ('slider' | 'number' | 'comment')[] }` prüft Pflicht-Felder und gibt fehlende Bausteine zurück (vom Editor für Disabled-State + Shake-Animation konsumiert).
- `src/lib/components/EntryEditor/EntryEditor.svelte` — komplett umgebaut auf die neuen Inputs + `persistDialog`.
- `src/lib/components/SymptomAdmin/SymptomEditModal.svelte` — `InputConfigSection` eingebettet, `persistDialog`-Calls.
- `src/lib/components/DayView/EntryList.svelte` — Zwei-Sektionen-Layout (5.1 „Noch offen" / 5.2 „Erfasst" bzw. „Heute erfasst"), datums-abhängige Header, Daily-Prompt-Rendering. Bugfix: „Heute"-Wording nur wenn `date === todayKey()`.
- `src/lib/components/DayView/EntryCard.svelte` — Status-Zeile mit Slider/Zahl/Kommentar statt Intensity.
- `src/routes/+layout.svelte` — beim Mount: Restore-Logik.
- `src/lib/templates/perimeno-default.ts` — neue Input-Konfig pro Symptom; ausgewählte Symptome (z.B. Stimmung, Schlafqualität) bekommen `daily=true`.

### 8.3 Entfernt

- `Intensity`-Typ aus `db/index.ts`. Alle `intensity`-Referenzen in `entries.ts`, `entries.test.ts`, `EntryEditor.svelte`, `EntryCard.svelte` und `utils/transfer.test.ts` werden auf das neue Schema umgestellt (kein Mapping — Backward-Compat ist out-of-scope).

---

## 9. Tests

- **Unit (Vitest):**
  - `db/symptoms.ts`: `createSymptom` legt Default-`inputs` und `daily=false` an. `listDailySymptomsForDate` filtert archivierte und input-lose Symptome korrekt heraus.
  - `db/entries.ts`: `validateEntry` korrekt für alle Pflicht-Kombinationen.
  - `stores/openDialog.svelte.ts`: Persistenz-Roundtrip via fake-indexeddb.
  - Migrations-Test: Symptom ohne `inputs`/`daily` bekommt Defaults; alte `entries`-Rows werden gelöscht.

- **Komponenten (Vitest + @testing-library/svelte):**
  - `SliderInput`: Snap-Verhalten an der Gap; null-Initial; required-Flag deaktiviert „Fertig".
  - `NumberInput`: integer vs. decimal; leeres Feld = null.
  - `InputConfigSection`: Toggles + bedingte Bodies; Daily-Toggle nur sichtbar wenn ≥1 Input aktiv.
  - `DailyPromptCard`: graue Darstellung, Tap löst Editor-Open-Callback aus.
  - `EntryList`: Section-Header datums-abhängig („Heute erfasst" vs. „Erfasst"); Sektion „Noch offen" erscheint nur, wenn offene Daily-Symptome existieren.

- **E2E (Playwright):**
  - Happy-Path neu: Tap → Slider rüberziehen → Zahl eintippen → Fertig → Karte zeigt Werte.
  - Pflicht-Negativ: Slider Pflicht, ohne Bewegung → Fertig deaktiviert, Shake bei Klick.
  - Restore-Roundtrip: Editor öffnen, Werte eintippen, Seite neu laden → Editor öffnet sich mit gleichen Werten.
  - Daily-Flow: Symptom als Daily markieren → Prompt erscheint heute → Tap auf Prompt → Editor → Fertig → Prompt verschwindet, Karte im Erfasst-Block; Swipe-Löschen → Prompt erscheint wieder.

---

## 10. Risiken & offene Punkte

### Custom-Slider-Engineering

Das Snap-Verhalten am Gap (unspez ↔ leicht) muss mit Touch- und Maus-Pointer sauber laufen. Hysterese: einmal in „leicht" gelandet, soll ein winziges Zurückziehen nicht sofort zurück auf „unspez" snappen — der Gap fungiert als Hysterese-Zone. Konkret: snap zurück auf unspez nur, wenn die Pointer-Position links vom unspez-Slot-Ende liegt.

### Restore vs. Reactivity

Beim Restore navigiert die App über `goto` und öffnet dann den Dialog. Falls der Route-Container den `pendingRestore`-Store erst nach einem zweiten Microtask konsumiert, kann es zu einem kurzen Flash der Tagesliste kommen, bevor der Dialog öffnet. Mitigation: `pendingRestore` wird in `+layout.svelte` *vor* dem ersten Paint gesetzt; Route-Container lesen ihn synchron in `$effect.pre`.

### Eintrag-Edit nach Pflicht-Verschärfung

Wird eine Slider-Pflicht nachträglich gesetzt, sind alle bestehenden Einträge mit `sliderValue=null` „rückwirkend unvollständig". Sie bleiben in der `entries`-Tabelle erhalten und sind in der Tagesliste sichtbar; nur das erneute Speichern blockiert. Das ist akzeptiert — Pflicht-Verschärfung ist eine bewusste Admin-Aktion.

### Datenverlust durch Backdrop-Tap

Backdrop-Tap löscht Eingaben unwiderruflich (keine Confirm-Stufe). Begründung: das Modell ist „App-Kill = persistent, User-Close = gewollt verworfen". Bei Bedarf kann später eine Confirm-Stufe für Pflicht-Symptome ergänzt werden.

---

## 11. Implementierungs-Reihenfolge (Hinweis für den Plan)

1. Schema-V2 + Migrations-Tests (DB-Schicht).
2. `validateEntry` + entries-Modul-Anpassung.
3. `openDialog`-Store + Restore-Logik in `+layout.svelte`.
4. `SliderInput` (mit Snap + Hysterese).
5. `NumberInput`.
6. `InputConfigSection` im Symptom-Admin (inkl. Daily-Toggle).
7. `EntryEditor` neu zusammenbauen.
8. `EntryCard`-Status-Zeile.
9. `EntryList` mit Zwei-Sektionen-Layout, datums-abhängigem Header und `DailyPromptCard`.
10. Standard-Vorlage neu kuratieren (inkl. `daily`-Markierungen für ausgewählte Symptome).
11. E2E-Happy-Path neu schreiben (inkl. Daily-Flow).
