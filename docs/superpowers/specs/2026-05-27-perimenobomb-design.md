# PeriMenoBomb — Design Spec

**Datum:** 2026-05-27
**Status:** Initiales Design (vor Implementierungs-Plan)
**Owner:** Tobi Oetiker

---

## 1. Zweck und Zielbild

PeriMenoBomb ist eine **mobile-first PWA** zum täglichen Tracking von Gefühls- und Körpersymptomen in der Perimenopause.

**Kerngedanke:** Jeden Tag werden ausschliesslich diejenigen Symptome erfasst, die *auffällig* sind. Es wird kein vollständiges Tagesprotokoll abverlangt — die App ist auf einen schnellen, niedrigschwelligen Workflow ausgelegt.

**Erfolgskriterien**

- Ein auffälliges Symptom lässt sich in **weniger als 10 Sekunden** vollständig erfassen (Symptom + Intensität + optionaler Kommentar).
- Symptome lassen sich frei in einer Hierarchie organisieren und beliebig umsortieren.
- Daten verlassen das Gerät nie ohne aktiven Export durch die Nutzerin.
- Historische Einträge sind jederzeit nachträglich bearbeitbar.

**Zielplattform:** Browser, optimiert für mobile Bildschirme. Funktioniert offline. Installation via "Zum Home-Bildschirm hinzufügen" (iOS Safari, Android Chrome).

---

## 2. Scope

### MVP (v1)

- Tageseingabe-Flow (Main-Page mit „Heute erfasst"-Liste, FAB, Sheet-Drill-Down, Auto-Open-Konfig-Modal)
- Symptom-Verwaltung mit hierarchischer Liste (max 3 Ebenen), Edit-Modal und Reorder-Modus
- Tag-Verwaltung (separate Seite, CRUD)
- Farbzuordnung pro Symptom (Palette + freier Picker)
- Eintrag editieren / per Swipe entfernen mit Undo-Snackbar
- Datums-Picker für rückwirkende Eingabe (beliebiges Datum)
- JSON-Export/-Import (Backup)
- Erste-Start-Erfahrung mit Vorlagen-Import-Option
- i18n-Infrastruktur (Paraglide), initial nur Deutsch

### v1.1 (Folge-Release)

- Kalender-Heatmap pro Symptom (Verlaufsansicht)
- Liste „Letzte N Tage" (Default N=14, konfigurierbar)
- PDF-Export (für Arztbesuche)
- CSV-Export (für externe Auswertung)
- Tag-Filter in der Verlaufsansicht

### Bewusst ausserhalb des Scopes (auch v1.1)

- Push-Reminders / Notifications
- Mehrere Profile auf einem Gerät
- Cloud-Sync / Backend
- Statistik & Korrelationsanalysen (z.B. „X korreliert mit Y")

---

## 3. Stack

| Bereich          | Wahl                          | Begründung |
|------------------|-------------------------------|------------|
| Framework        | Svelte 5 + SvelteKit          | Vom Auftraggeber vorgegeben |
| Adapter          | `@sveltejs/adapter-static`    | Reine clientseitige App, kein Backend |
| PWA-Plugin       | `@vite-pwa/sveltekit`         | Etablierter, gut gepflegter Workbox-Wrapper |
| Persistenz       | Dexie.js                      | Reifer IndexedDB-Wrapper, Live-Queries kombinierbar mit Svelte 5 runes |
| i18n             | Paraglide                     | Type-safe, ESM, vom SvelteKit-Team empfohlen |
| Styling          | Vanilla CSS + Design Tokens   | Volle Kontrolle über mobiles Look-and-Feel, kein Toolchain-Lock-in |
| Drag&Drop        | svelte-dnd-action             | Touch-tauglich, mature |
| PDF (v1.1)       | pdf-lib                       | Clientseitige PDF-Erzeugung |
| Tests            | Vitest + Playwright           | Unit/Komponenten + E2E |
| Paketmanager     | **pnpm** (verbindlich)        | Es wird ausschliesslich `pnpm` verwendet — kein `npm`, kein `yarn`. Lockfile: `pnpm-lock.yaml` |
| Icons            | `lucide-svelte`               | Einheitliches Icon-Set, gut gepflegt, klein |

---

## 4. Datenmodell (IndexedDB via Dexie)

Datenbank-Name: `perimenobomb`. Schema-Versionierung über Dexie's `db.version(n).stores({...}).upgrade(...)`.

### Tabelle `symptoms`

```
{
  id:         string   // UUID v4
  name:       string
  color:      string   // CSS-Farbe aus Palette oder Custom-Hex
  tagIds:     string[] // Referenzen auf tags.id
  parentId:   string | null  // null = Wurzel
  sortIndex:  number   // Sortierung innerhalb des Geschwister-Sets
  depth:      number   // 0..2 (max 3 Ebenen)
  isFolder:   boolean  // true = nur Gruppierung, kein Eintrag möglich
  archived:   boolean  // soft-delete
  createdAt:  number
  updatedAt:  number
}
```

Indizes: `id` (primary), `parentId`, `[parentId+sortIndex]`, `archived`.

Validierung: Ein Symptom kann nicht zum Folder werden, wenn es bereits Einträge hat. Eltern-Ordner-Tiefe wird beim Verschieben gegen `depth ≤ 2` validiert.

### Tabelle `tags`

```
{
  id:        string   // UUID v4
  name:      string
  createdAt: number
}
```

Indizes: `id` (primary), `name`.

### Tabelle `entries`

```
{
  id:         string         // composite key `${date}__${symptomId}`
  date:       string         // ISO 'YYYY-MM-DD' (lokale Zeitzone)
  symptomId:  string
  intensity:  'leicht' | 'mittel' | 'stark' | null
  comment:    string         // leerer String wenn nicht gesetzt
  updatedAt:  number
}
```

Indizes: `id` (primary), `date`, `symptomId`, `[date+symptomId]`.

**Invariant:** Pro `(date, symptomId)` existiert maximal ein Eintrag. Eindeutigkeit wird durch den deterministischen composite key erzwungen.

### Tabelle `meta`

```
{
  key:   string  // 'language' | 'firstRunCompleted' | 'lastNDaysDefault' | ...
  value: any
}
```

Indizes: `key` (primary).

### Vorlagen-Daten

Standard-Symptomvorlage liegt als statisches JSON-Asset im Repo (z.B. `src/lib/templates/perimeno-default.json`). Import erfolgt clientseitig in eine Transaktion über `symptoms` + `tags`.

---

## 5. Architektur

### Modulgrenzen

```
src/
├── lib/
│   ├── db/                 # Dexie-Schema, Migrationen, typisierte Queries
│   │   ├── schema.ts
│   │   ├── symptoms.ts     # CRUD + Hierarchie-Ops (move, reorder, archive)
│   │   ├── tags.ts
│   │   ├── entries.ts      # CRUD + per-Tag-Queries
│   │   └── meta.ts
│   ├── stores/             # Reaktive Wrapper um Dexie-LiveQueries (Svelte 5 runes)
│   ├── components/
│   │   ├── DayView/        # Main-Page-Komponenten
│   │   ├── SymptomSheet/   # Drill-Down-Hierarchie-Picker
│   │   ├── EntryEditor/    # Konfig-Modal (Intensität + Kommentar)
│   │   ├── SymptomAdmin/   # Verwaltungs-Liste, Edit-Modal, Reorder-Modus
│   │   ├── TagAdmin/
│   │   └── ui/             # Shared: Sheet, Modal, Snackbar, Button, ColorPicker, ...
│   ├── i18n/               # Paraglide-Setup, Sprach-Files
│   ├── templates/          # JSON-Default-Vorlage
│   └── utils/              # Date, UUID, Export/Import-Serialisierer
└── routes/
    ├── +layout.svelte
    ├── +page.svelte                  # /  → leitet auf heute
    ├── tag/[date]/+page.svelte        # spezifischer Tag
    ├── symptome/+page.svelte
    ├── tags/+page.svelte
    └── einstellungen/+page.svelte
```

**Designprinzip:** Komponenten kennen die DB-Schicht nicht direkt. Sie konsumieren Stores (reaktive LiveQueries). DB-Schicht ist isoliert testbar.

### Datenfluss

```
[Komponente]  --calls-->  [Store/Action]  --calls-->  [db/*-Module]  --uses-->  [Dexie]
     ^                                                                              |
     |---------- LiveQuery-Updates (reaktive Subscription) ------------------------|
```

Schreib-Ops: Komponente ruft eine Action (z.B. `addEntry`), die ein DB-Modul aufruft, das eine Dexie-Transaktion ausführt. Lese-Ops: Komponenten subscriben auf LiveQueries, die automatisch nach DB-Mutationen neu rendern.

### Routing & Navigation

- Bottom-Nav mit vier Einträgen: **Tag**, **Verlauf** (v1.1, in MVP zeigt eine Placeholder-Seite), **Symptome**, **Mehr**.
- „Mehr" enthält Tags-Verwaltung und Einstellungen.
- Tab-Wechsel verliert keinen Sheet/Modal-Zustand (Modals sind in `<dialog>`/portaled overlays).

### Offline & PWA

- `adapter-static` → erzeugt statische Assets.
- vite-pwa konfiguriert mit `registerType: 'autoUpdate'`, Precache aller Routes-Shells und Assets, Runtime-Caching für i18n-Module.
- Manifest: Name „PeriMenoBomb", Theme-Color aus Design-Tokens, Icons als 192/512 PNG.
- Service-Worker-Update zeigt unauffälligen „Update verfügbar"-Toast an, der die App auf User-Klick neu lädt.

---

## 6. UX-Spezifikation

### 6.1 Tageseingabe (Main-Page)

**Layout (von oben nach unten):**

1. **Datums-Header:** „Tag" (Label) + Pfeil-links / Datum mit Tagesname / Pfeil-rechts. Tap auf Datum öffnet nativen Datums-Picker.
2. **Heute-erfasst-Liste:** Karten-Stil, je Karte: Symptom-Farb-Dot, Symptom-Name, kompakte Status-Zeile (Intensität, ggf. 💬 wenn Kommentar). Tap = Konfig-Modal öffnen.
3. **Empty-State:** Wenn Liste leer: hilfreicher Text „Tippe das + unten, um Symptome zu erfassen."
4. **FAB „+" unten rechts.**
5. **Bottom-Nav.**

**FAB-Tap → Symptom-Sheet:**

- Slide-up-Sheet (~75% Bildschirmhöhe), Handle oben, Header „Symptom auswählen" + Schliessen-X.
- Inhalt: Hierarchie-Ebene 1. Ordner und Symptome gemischt darstellbar (Ordner mit 📁-Icon und Chevron, Symptome mit Farb-Dot und +-Icon).
- Tap auf Ordner: in-place-Navigation zur nächsten Ebene; Breadcrumb-Header (z.B. „‹ Zurück | Körperlich | ✕"), max 3 Ebenen Tiefe.
- Tap auf Symptom:
  - Erzeugt sofort einen Eintrag in `entries` (intensity=null, comment="").
  - Sheet bleibt offen.
  - **Konfig-Modal poppt über dem Sheet auf.**
- Wenn das Symptom an diesem Tag bereits erfasst ist: kleines „erfasst"-Chip, Tap öffnet trotzdem das Modal (zum Editieren).

**Konfig-Modal:**

- Header: Symptom-Farb-Dot + Name + (klein darunter) breadcrumb-artiger Pfad.
- Intensität: vier Buttons „— ohne | Leicht | Mittel | Stark", einer aktiv. Default beim Neuanlegen: „— ohne".
- Kommentar: Textarea (optional).
- Primärer Button „Fertig" speichert und schliesst.
- Sekundärer Button „🗑 Eintrag entfernen" entfernt sofort und zeigt Snackbar.
- **Schliessen ohne Eingabe (Backdrop-Tap, Swipe-Down, ✕):** Eintrag bleibt erhalten mit `intensity=null` und leerem Kommentar. Die User-Aktion „Symptom getappt" wird als ausreichende Auswahl gewertet; weitere Details sind optional.

**Listen-Eintrag-Interaktionen:**

- Tap → Konfig-Modal zum Editieren.
- Swipe nach links → Eintrag entfernt; Snackbar unten mit Text „Eintrag entfernt. Rückgängig" (5 Sekunden), Tap auf „Rückgängig" stellt wieder her. Snackbar-Timeout = harte Löschung.

### 6.2 Symptom-Verwaltung

**Route:** `/symptome`

**Standard-Modus:**

- Hierarchische Liste mit Einrückung. Ordner mit Chevron (expandierbar), Symptome mit Farb-Dot. Sortiert nach `sortIndex` pro Ebene.
- Header rechts: „Umsortieren"-Toggle, „+" (neues Symptom oder Ordner).
- Tap auf einen Symptom-/Ordner-Knoten → Edit-Modal.

**Edit-Modal:**

- Felder: Name, Typ (Symptom / Ordner; Wechsel nur möglich wenn keine Tages-Einträge existieren), Farbe (Palette + „Mehr…"-Color-Picker, nur für Symptome), Tag-Auswahl (Multi-Select-Chips, nur für Symptome), Eltern-Ordner (Picker mit Hierarchie-Auswahl, validiert auf `depth ≤ 2`).
- „Speichern" / „Löschen" (mit Confirm, plus Hinweis bei bestehenden Einträgen → Soft-Delete bzw. Archivieren) / „Abbrechen".

**Reorder-Modus:**

- Items zeigen Drag-Handles. Drag verschiebt innerhalb der Ebene; Drag auf Ordner-Icon = Verschieben hinein.
- „Fertig"-Button oben rechts schliesst den Modus, speichert neue `sortIndex`/`parentId`.

**Farb-Palette** (12 Farben, verbindlich für visuelle Konsistenz mit späterer Heatmap):

Vorschlag (im Spec verankert, vom Designer im Plan ggf. revidierbar):

`#ef4444` (rot), `#f97316` (orange), `#f59e0b` (amber), `#eab308` (gelb), `#84cc16` (lime), `#10b981` (grün), `#06b6d4` (cyan), `#3b82f6` (blau), `#6366f1` (indigo), `#8b5cf6` (violett), `#ec4899` (pink), `#6b7280` (grau).

„Mehr…"-Button öffnet einen Standard-`<input type="color">` als Fallback.

### 6.3 Tag-Verwaltung

**Route:** `/tags`

- Einfache Liste, „+ neuer Tag" oben.
- Tap auf Tag → Umbenennen oder Löschen.
- Löschen: wenn an Symptomen verwendet → Confirm „Tag wird von N Symptomen entfernt".

### 6.4 Einstellungen

**Route:** `/einstellungen`

- Sprache (Auswahl, MVP: nur Deutsch sichtbar, aber Paraglide-Infrastruktur vorhanden).
- Standard-Vorlage importieren (Knopf, mit Confirm wenn bereits Symptome existieren).
- JSON-Export (lädt Datei `perimenobomb-export-YYYY-MM-DD.json` herunter; enthält symptoms + tags + entries + meta).
- JSON-Import (Datei-Auswahl, Validierung, Konflikt-Strategie: ID-Match → überschreiben, Strategie im Confirm-Dialog wählen: „Zusammenführen" / „Vollständig ersetzen").
- iOS-Hinweis: „Diese App muss zum Home-Bildschirm hinzugefügt werden, damit deine Daten erhalten bleiben." (mit ausklappbarer Anleitung). Auf Android weniger prominent.

### 6.5 Erste-Start-Erfahrung

Bei `firstRunCompleted !== true`:

- Main-Page zeigt zwei Optionen:
  - **Primär:** „Mit Standard-Vorlage starten" → importiert kuratierte Symptomliste + Tags + Default-Hierarchie + Farben.
  - **Sekundär:** „Eigene Liste aufbauen" → leitet zu `/symptome` mit leerer Liste.
- Beide Optionen setzen `firstRunCompleted=true` und zeigen am Ende ein Toast mit dem iOS-Home-Bildschirm-Hinweis.

---

## 7. v1.1 — Verlaufsansichten

### 7.1 Liste „Letzte N Tage"

- Route: `/verlauf`
- Default: 14 Tage, in Einstellungen konfigurierbar (7/14/30/90).
- Pro Tag eine zusammenklappbare Sektion, darunter die Einträge des Tages.
- Filter: Tag-Chips (Multi-Select). Wenn Filter aktiv: nur Einträge zu Symptomen, die mindestens einen der gewählten Tags tragen.

### 7.2 Kalender-Heatmap pro Symptom

- Route: `/verlauf/symptom/[id]`
- 12-Monats-Kalender (oder Monats-Auswahl), je Tag ein kleines Quadrat in Symptom-Farbe, Sättigung nach Intensität (leicht = blass, mittel = mittel, stark = volle Sättigung; null = leeres Symptom-Farbe mit niedriger Opazität; ohne Eintrag = neutral).
- Tap auf Quadrat → Detail-Popover mit Kommentar und Sprung zu `/tag/[date]`.

### 7.3 PDF-Export

- Zeitraum-Auswahl (Datum-von, Datum-bis).
- Generiert PDF mit: Titel, Zeitraum, pro Symptom ein Abschnitt mit Eintragsliste (Datum, Intensität, Kommentar). Variante „Tagesweise" (chronologisch) ebenfalls verfügbar.
- pdf-lib clientseitig, Download via `<a download>`.

### 7.4 CSV-Export

- Spalten: `date, symptom_id, symptom_name, intensity, comment, tags`.
- UTF-8 BOM für Excel-Kompatibilität.

---

## 8. Risiken & Caveats

### iOS-IndexedDB-Persistenz

Safari löscht IndexedDB-Daten nach ~7 Tagen ohne Interaktion, ausser die App ist via „Zum Home-Bildschirm" installiert. **Mitigation:** Beim ersten Start prominent kommunizieren; in Einstellungen ein Banner „Du hast die App nicht installiert" wenn die Heuristik (`window.matchMedia('(display-mode: standalone)')`) das vermuten lässt.

### Datenmigration

Schema-Änderungen über Dexies `version().upgrade()`-API. Jede neue Version dokumentiert in `src/lib/db/schema.ts` mit Migrations-Funktion. Migrations werden mit synthetischen Test-Datenständen geprüft (Vitest).

### Drag&Drop auf Mobile

`svelte-dnd-action` ist solide, aber Touch-spezifische Edge-Cases (Auto-Scroll am Rand, Drop in geschlossene Ordner) müssen in Playwright-Test abgedeckt werden.

### Hierarchie-Tiefen-Validierung

Beim Verschieben eines Ordners: gesamte Sub-Tree-Tiefe gegen `< 3` validieren. Verboten = klare Fehlermeldung, kein lautloses Failure.

### Farbpalette und Heatmap

Die Palette muss in der Heatmap auch bei niedriger Sättigung lesbar bleiben. v1.1-Heatmap-Implementierung sollte die Sättigungsstufen pro Palette-Farbe einmal kalibrieren.

---

## 9. Testing-Strategie (vorgesehen — Details im Plan)

- **Unit (Vitest):** alle DB-Module (CRUD, Hierarchie-Validierungen, Migrationen) gegen fake-indexeddb.
- **Komponenten (Vitest + @testing-library/svelte):** EntryEditor, SymptomSheet (Drill-Down), Reorder-Modus.
- **E2E (Playwright):** Hauptflüsse (erster Start → Vorlage importieren → Symptom erfassen → editieren → löschen-mit-undo → Datum wechseln → Export/Import-Round-Trip).
- Mobile-Viewport-Konfiguration in Playwright (iPhone-Simulation).

---

## 10. Offene Punkte für den Implementierungs-Plan

- Konkrete Inhalte der Standard-Vorlage (Symptom-Liste + Hierarchie). Entweder als Recherche-Task im Plan oder als gemeinsame Aufgabe mit dem User vor v1.
- Endgültige Design-Tokens (Spacing, Typo-Skala, Schatten, Theme-Color). MVP-Werte werden in einer ersten Iteration etabliert und können stabilisiert werden, sobald die Komponenten zusammensitzen.
