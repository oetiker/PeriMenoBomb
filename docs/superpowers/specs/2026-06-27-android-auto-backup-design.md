# Android Auto-Backup with Daily Rotation and Compression — Design

Date: 2026-06-27
Status: Approved (pending spec review)

## Goal

Let a user on a File-System-Access-capable browser (Android Chrome M132+,
desktop Chromium) point the app at a backup folder once and then have the app
maintain its own **rotating, compressed** backups with no further interaction —
directly addressing the data-loss incident that motivated this work. On
browsers without the File System Access API (iOS Safari, Firefox) nothing
changes: the existing manual export + reminder banner remain the path.

This is **purely additive** and feature-gated; no existing flow is removed.

## Background / platform facts (verified 2026-06)

- The File System Access pickers (`showDirectoryPicker`, `showSaveFilePicker`)
  shipped on Android Chrome in **M132** (stable ~Jan 2025); before that Android
  exposed only OPFS. They map to Android's Storage Access Framework picker.
- **Persistent permissions** for installed PWAs (Chrome 122+): a directory
  granted once can be read/written on later launches without re-prompting.
  Still must `queryPermission()`, and `requestPermission()` needs a user
  gesture when the grant is missing.
- **Compression Streams API** (`CompressionStream`/`DecompressionStream`)
  supports `gzip`/`deflate`/`deflate-raw` natively — no brotli/zstd without a
  WASM dependency, which is not worth it at this data scale (tens of KB).
- The directory handle is stored in IndexedDB, which is itself evictable. The
  `navigator.storage.persist()` request added earlier makes that unlikely; the
  design must still handle "handle lost → re-pick".

## Decisions

| Topic | Decision |
|---|---|
| Compression format | **gzip** (native, zero-dependency, self-describing magic bytes, universally decompressible) |
| Compression scope | **All** backups — manual export *and* auto-backup — write `.json.gz` |
| Restore | Auto-detect by magic bytes (`1f 8b`); accept both `.json` and `.json.gz` |
| Rotation model | **One file per calendar day**, `perimenobomb-YYYY-MM-DD.json.gz`; same-day re-runs overwrite |
| Retention | Keep last **N days** (default **14**); prune older on each write |
| Trigger | On app launch (if permission granted) **and** ~5 s debounced after any data change |
| Write safety | **Atomic**: write a temp file, then `move()` to the final name only on success — never clobber the last good backup |
| Permission | `queryPermission()`; `requestPermission()` only on a user gesture; otherwise skip silently |
| Reminder interaction | When auto-backup is **on**, the day-view reminder banner is **not shown**. If auto-backup is enabled but unhealthy (handle lost / permission dropped / last success too old), show a distinct "Auto-Backup unterbrochen" warning instead, so the user is never silently unprotected. |
| Platform gating | All FSA paths gated on `('showDirectoryPicker' in window)`; iOS/Firefox keep manual export + reminder |

## Architecture / module boundaries

Small, independently testable units:

- **`src/lib/utils/gzip.ts`** (pure, no DOM/DB) — `gzip(bytes: Uint8Array): Promise<Uint8Array>` and `gunzip(bytes): Promise<Uint8Array>` via Compression Streams; plus `isGzip(bytes): boolean` (magic-byte sniff). Round-trip unit-tested.
- **`src/lib/utils/backupRotation.ts`** (pure) — `backupFileName(dateKey): string`, `parseBackupDate(name): string | null`, and `selectForPruning(names: string[], today: string, retentionDays: number): { keep: string[]; delete: string[] }`. Fully unit-tested; the date math is the trickiest part and lives here, away from any I/O.
- **`src/lib/db/fsBackup.ts`** (glue over the FSA API + IndexedDB) — persist/read the `FileSystemDirectoryHandle` in a dedicated IndexedDB store; `pickBackupFolder()` (user gesture); `queryAccess()`/`ensureAccess()`; `writeBackup(handle, gzippedBytes, dateKey)` doing the atomic temp→`move()`; `prune(handle, retentionDays, today)`. Thin; no business logic beyond orchestration.
- **`src/lib/utils/transfer.ts`** — `exportAll` output is gzipped before download (`…json.gz`); import reads the file as an ArrayBuffer, sniffs gzip, decompresses if needed, then runs the existing validate → `migrateBackupPayload` → write flow. `accept` widened to `.json,.json.gz,application/gzip`.
- **Triggers**: `+layout.svelte` runs an auto-backup attempt on launch; a debounced hook fires after data changes (subscribe to a DB-change signal / call site in the upsert paths). Both no-op when unsupported or no folder chosen.
- **Settings UI**: new "Automatisches Backup" section (only when supported) — pick/replace folder, show folder name + last-success status, retention-days field (default 14), and the "unterbrochen" warning when unhealthy.
- **Reminder**: the day-view banner's "due" computation gains an "auto-backup healthy" suppressor.

## Data flow (auto-backup write)

1. Trigger (launch or debounced change) → `fsBackup` checks a stored handle exists and `queryAccess()` is `granted` (else: launch-time may `ensureAccess()` if a gesture is available; otherwise mark unhealthy and stop).
2. `exportAll()` → JSON string → `gzip()` → bytes.
3. `writeBackup`: create `…YYYY-MM-DD.json.gz.tmp`, write bytes, close; `tmp.move('…YYYY-MM-DD.json.gz')`.
4. `prune`: list directory, `selectForPruning(...)`, delete the `delete` set.
5. Record last-success timestamp (meta) → drives reminder suppression and Settings status.

## Error handling

- Write/move failure → today's existing file is untouched (atomic). Record the failure; Settings status and the "unterbrochen" warning surface it. Never throw into the UI flow that triggered it.
- Permission lost / handle gone → `queryAccess()` not `granted` → unhealthy state → warning prompts re-pick. No silent data exposure.
- Decompression failure on import → clear German error via the existing snackbar ("Datei konnte nicht gelesen werden").
- All FSA calls wrapped so an unsupported/permission-denied environment degrades to the manual path.

## Testing

- **gzip.ts**: round-trip (`gunzip(gzip(x)) === x`), `isGzip` true/false. (Node 20+/jsdom expose Compression Streams.)
- **backupRotation.ts**: filename build/parse; `selectForPruning` across boundaries (exactly N, older, malformed names ignored, same-day dedupe).
- **transfer.ts**: import accepts a gzipped payload and a plain-JSON payload (extend existing round-trip test); export produces gzip that re-imports.
- **fsBackup.ts** and the FSA/permission/`move` glue: no real filesystem in jsdom, so kept thin and verified via the preview/Playwright harness already used in this project (import + folder write on a Chromium preview).

## Out of scope (YAGNI)

- Generational (GFS) rotation — daily-keep-N is enough for a personal tracker.
- Background/headless backups (service-worker scheduled) — not possible with the FSA API; writes happen while the app runs.
- Cloud destinations (Drive, etc.) — different auth/online model; offline-first stays local.
- A plain-JSON export option — all backups are gzip; import still accepts plain `.json` for legacy files.
