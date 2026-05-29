# PeriMenoBomb

**The Symptom Tracker** — eine mobile-first PWA zum täglichen Tracking von Gefühls- und Körpersymptomen in der Perimenopause.

> Erfasse jeden Tag nur das, was *auffällig* ist — Symptom, Intensität, optionaler Kommentar, in unter 10 Sekunden. Kein vollständiges Tagesprotokoll, kein Konto, keine Cloud.

## Datenschutz zuerst

Alle Daten bleiben **ausschliesslich auf dem Gerät** (IndexedDB). Es gibt kein Backend, keinen Sync, keine Telemetrie und keine Laufzeit-Zugriffe auf fremde Server. Daten verlassen das Gerät nur, wenn du sie aktiv exportierst (JSON-Backup, PDF oder CSV).

## Features

- **Schnelle Tageserfassung** — Hauptseite mit „Heute erfasst"-Liste, FAB und Sheet-Drill-Down. Beliebiges Datum rückwirkend erfassbar (`/day/<datum>`, deep-linkbar).
- **Hierarchische Symptome** — bis zu drei Ebenen, frei umsortierbar, mit Edit-Modal und Archivierung.
- **Eingabe-Konfiguration pro Symptom** — Slider, Zahlenfeld (mit Einheit) und/oder Kommentar, jeweils optional oder pflicht.
- **Tags** — eigene Seite mit voller CRUD-Verwaltung, zur späteren Filterung.
- **Farbzuordnung** — Palette plus freier Farb-Picker pro Symptom.
- **Editieren & Löschen** — Einträge nachträglich ändern, per Swipe entfernen mit Undo-Snackbar.
- **Verlauf / Reports**
  - **Zyklus-Heatmap** (`/report/cycle`) — Intensität pro Symptom über die Zeit, farb-/sättigungscodiert.
  - **Tage seit letztem Symptom** (`/report/since`) — Zähler und Abstände zwischen Erfassungen.
  - **Ereignis-Liste** (`/report/list`) — alle Einträge, filterbar, als **PDF** für den Arztbesuch.
- **Backup** — JSON-Export/-Import; CSV-Export für externe Auswertung.
- **Offline-fähig** über Service Worker (PWA). Nach dem ersten Aufruf läuft die App komplett ohne Netz.
- **Installierbar** — „Zum Home-Bildschirm hinzufügen" für standalone-Look (iOS Safari, Android Chrome).
- **Erste-Start-Erfahrung** mit optionalem Vorlagen-Import.
- **Inklusive Sprache** und Schweizer Schreibweise (ss statt ß).

## Stack

SvelteKit 2 (Svelte 5 Runes) · `adapter-static` (SPA) · Vite · TypeScript · pnpm · `@vite-pwa/sveltekit` · Dexie (IndexedDB) · Paraglide (i18n) · jsPDF · Vitest + jsdom · Playwright (E2E)

## Entwicklung

```bash
pnpm install
pnpm dev            # Dev-Server (http://localhost:5191)
pnpm dev --host     # Im LAN erreichbar (für Handy-Test im selben WLAN)
pnpm test           # Unit-Tests (Vitest)
pnpm test:e2e       # End-to-End-Tests (Playwright)
pnpm check          # svelte-check + tsc
pnpm build          # Production-Build nach build/
pnpm preview        # Production-Preview lokal (Port 5191)
```

> **i18n-Hinweis:** Die Paraglide-Übersetzungen (`src/lib/paraglide/`) werden generiert und sind nicht eingecheckt. `pnpm dev` und `pnpm build` erzeugen sie automatisch. Für `pnpm check`/`pnpm test` aus einem frischen Checkout heraus zuerst einmal kompilieren:
> ```bash
> pnpm exec paraglide-js compile --project ./project.inlang --outdir ./src/lib/paraglide
> ```

## Deploy

Jeder Push nach `main` deployt GitHub Actions automatisch auf GitHub Pages (`.github/workflows/deploy.yml`).

**Einmalige Einrichtung im Repo:**

1. Settings → Pages → Build and deployment → Source: **GitHub Actions**
2. Erster Push auf `main` triggert den Workflow
3. App ist erreichbar unter `https://<user>.github.io/PeriMenoBomb/`

Der Subpfad `/PeriMenoBomb/` kommt aus der Umgebungsvariable `BASE_PATH` im Workflow. Sie speist sowohl `kit.paths.base` (`svelte.config.js`) als auch die PWA-Manifest-Pfade (`vite.config.ts`). SvelteKit schreibt damit alle internen Links und `goto()`-Aufrufe automatisch um. Bei einem Root- oder Custom-Domain-Deploy `BASE_PATH` leeren; bei umbenanntem Repo den Namen anpassen.

## Projektstruktur

```
src/
  app.html              # Shell mit Splash-Animation
  routes/
    +layout.svelte      # BottomNav, SW-Registrierung, Route-Persistenz
    +page.svelte        # leitet auf /day/<heute> um
    day/[date]/         # Tageserfassung (validierte Datums-Route, 404 bei Müll)
    report/             # cycle (Heatmap) · since · list (PDF)
    symptoms/ tags/ settings/
  lib/
    components/         # DayView, EntryEditor, SymptomAdmin, SymptomSheet, ui/, report/
    db/                 # Dexie-Schema + Migrationen, entries/symptoms/tags/meta
    report/             # Heatmap-Klassifizierung, PDF/CSV-Erzeugung
    stores/ utils/ i18n/ templates/ icons/
docs/
  ROADMAP.md
  superpowers/specs/    # Design-Spec
```

## Datenmodell

IndexedDB (Dexie, DB-Schema-Version 4). Tabellen:

| Tabelle    | Schlüssel & Indizes                                  |
|------------|------------------------------------------------------|
| `symptoms` | `id, parentId, [parentId+sortIndex], archived`       |
| `tags`     | `id, name`                                           |
| `entries`  | `id, date, symptomId, [date+symptomId]`              |
| `meta`     | `key`                                                |

Schema und Migrationen in `src/lib/db/index.ts`.

## Mitmachen

PRs willkommen. Beachte die Projektkonventionen:

- **Routen-Pfade auf Englisch** (`/report`, nicht `/verlauf`), **UI-Texte auf Deutsch**.
- **Inklusive Sprache** (kein generisches Maskulinum) und **Schweizer ss** in allem, was Nutzer:innen sehen.
- **Offline-first**: jedes Feature muss ohne Netz funktionieren — kein CDN, keine Laufzeit-Fetches; Lazy-Chunks müssen vorgecacht werden.
- Tests zu neuer Logik ergänzen (`pnpm test` läuft grün halten).

## Lizenz

[MIT](./LICENSE) — Tobias Oetiker, 2026.
