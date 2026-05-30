# Changelog

All notable changes to PeriMenoBomb are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased] — v1.1 report views

### Added
- **Select input for symptoms** — a single-choice dropdown with author-defined
  options. Each option carries a stable uuid `key` (stored on the log, so
  renaming a label never breaks historical continuity) plus an optional numeric
  value that feeds the cycle-heatmap intensity. Options are soft-deleted
  (hidden from the live dropdown, kept for past entries, restorable). Dexie
  schema **v5** backfills the new field on existing symptoms.

- **Cycle heatmap** (`/report/cycle`) — per-symptom intensity over time on a
  fixed-axis grid with pan/zoom/pinch and a day-0 reference line.
- **"Days since last symptom" view** (`/report/since`) — counters plus the
  intervals and key figures between recordings.
- **Event list** (`/report/list`) — all entries, filterable and grouped by day,
  exportable to **PDF** (jsPDF, dynamically imported to keep it out of the main
  chunk).
- **CSV export** for external analysis.
- `/report` hub linking the three report views.
- Shared primitives: `listOccurrenceDates`, `daysBetweenKeys` (DST-safe),
  `computeIntervals`/`intervalStats`, `filterEntries`/`groupEntriesByDay`.
- Cycle template group with menstruation start/end as events.
- `deliverFile` — Web Share → new tab → download fallback chain for exports
  (works in non-secure LAN contexts too).
- GitHub Actions deploy workflow, README, LICENSE and this changelog.

### Changed
- **Route paths anglicised** — `/report/*` instead of `/verlauf/*` (UI labels
  stay German).
- `BASE_PATH`-driven subpath support in `svelte.config.js` and the PWA manifest,
  enabling GitHub Pages deployment under `/PeriMenoBomb/`.
- SPA fallback switched to `404.html` so deep links (e.g. `/day/<date>`) survive
  a cold load / reload on GitHub Pages.

## [1.0.0] — 2026-05-28 — MVP (`mvp-v1`)

### Added
- **Daily entry flow** — main page with "recorded today" list, FAB, sheet
  drill-down picker with breadcrumb stack, and entry editor.
- **Symptom administration** — hierarchical list (up to 3 levels), edit modal,
  reorder mode (svelte-dnd-action), archive view with restore.
- **Per-symptom input configuration** — slider, number (with unit) and/or
  comment, each optional or required; daily-prompt toggle.
- **Tag management** — full CRUD with reference cleanup on delete.
- **Colour assignment** — 12-swatch palette plus native colour picker fallback.
- **Editing & deletion** — retroactive edits, swipe-to-action with undo snackbar.
- **Date picker** for back-dated entries (any date).
- **JSON export/import** for local backups.
- **First-run experience** with optional template import; default symptoms
  pre-configured with inputs and daily prompts.
- **Emoji/Lucide icons** with curated suggestions and a look-modal.
- **Persistent bottom navigation**; open dialog restored on app start.
- **Offline-first PWA** — manifest, icons and service worker via
  `@vite-pwa/sveltekit`; precached lazy chunks.
- **i18n infrastructure** — Paraglide with German source locale.
- **Storage** — Dexie (IndexedDB) schema with `symptoms`, `tags`, `entries`
  (composite key, merge-on-upsert) and `meta`; hierarchy moves validated for
  depth and cycles; Dexie `liveQuery` adapter for Svelte 5 runes.

[Unreleased]: https://github.com/oetiker/PeriMenoBomb/compare/mvp-v1...HEAD
[1.0.0]: https://github.com/oetiker/PeriMenoBomb/releases/tag/mvp-v1
