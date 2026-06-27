# Handover — Android Auto-Backup feature

Pick this up in a fresh session to implement the auto-backup feature end to end.

## TL;DR

- **Goal:** On File-System-Access-capable browsers (Android Chrome M132+, desktop Chromium), let the user pick a backup folder once; the app then writes a gzip-compressed backup there automatically, one file per day, keeping the last N days (default 14). Also: make **all** backups gzip and restore-compatible.
- **Spec:** [`docs/superpowers/specs/2026-06-27-android-auto-backup-design.md`](superpowers/specs/2026-06-27-android-auto-backup-design.md) — approved.
- **Plan (execute this):** [`docs/superpowers/plans/2026-06-27-android-auto-backup.md`](superpowers/plans/2026-06-27-android-auto-backup.md) — 12 tasks, each with TDD steps and complete code.
- **Branch:** `feat/android-auto-backup` (local only, not pushed), forked from merged `main`.

## Start here

1. Confirm you are on the right branch and it is current with main:
   ```bash
   git branch --show-current        # → feat/android-auto-backup
   git fetch origin && git log --oneline -1 origin/main
   ```
   `feat/android-auto-backup` was rebased onto the merged PR #6 (`main` @ `f89463f`). Its only commit on top of main is the **spec** doc; everything else in the plan is still to be built.
2. Read the spec, then open the plan and work it task-by-task.
3. **Execution skill:** use `superpowers:subagent-driven-development` (a fresh subagent per task, review between tasks) or `superpowers:executing-plans` (inline, with checkpoints).
   - **Commit caveat for subagents in this repo:** subagent git commits do **not** sync back to the controller's repo, and subagent file writes lag-sync. So have subagents **edit + test only**, and the controller (you, the main session) does each commit. The plan's per-task `git commit` step is the controller's to run.

## Current working-tree state (uncommitted)

`git status` shows:
- `?? docs/superpowers/plans/2026-06-27-android-auto-backup.md` — the implementation plan (commit it before/at start).
- `?? docs/HANDOVER.md` — this file.
- ` M src/lib/components/EntryEditor/SelectInput.svelte` and ` M …/EntryEditor.svelte` — **two unrelated UI tweaks** already done by hand:
  - select placeholder renamed `— keine Auswahl —` → `— bitte wählen —`;
  - the select shows the field's section `label` as its prompt when defined (new `label` prop wired from `EntryEditor`).
  These are **not** part of the auto-backup plan. Decide separately whether to fold them into a small commit/PR to `main`. They are harmless to carry along; don't let them confuse the plan's diffs.

## What already shipped (context — already on `main`, do not redo)

PR #6 (merged) added the data-durability foundation the auto-backup builds on:
- `navigator.storage.persist()` on startup (`src/routes/+layout.svelte`).
- Defensive first-run: `shouldShowFirstRun()` in `src/lib/db/meta.ts` (empty-DB check incl. tags).
- Backup **reminder**: `src/lib/db/backup.ts` (`performBackup`, `getReminderDays`/`setReminderDays`, `getLastBackupAt`/`recordBackupTime`), `src/lib/utils/backup.ts` (`isBackupDue`, `daysSinceBackup`, `coerceReminderDays`), `src/lib/components/DayView/BackupReminder.svelte`, day-view banner + Settings field.
- **Migrating import**: `src/lib/db/importMigrate.ts` replays old backups through the real Dexie migration chain; exports stamp `dbVersion` (`src/lib/utils/transfer.ts`). Import already migrates legacy (pre-v6) backups.
- Dependency security overrides in `pnpm-workspace.yaml` (undici/dompurify/cookie).

The auto-backup plan **extends** `transfer.ts` and `backup.ts` and **adds** `gzip.ts`, `backupRotation.ts`, `fsBackup.ts`, `autoBackupTriggers.ts`.

## Project conventions / constraints (apply to every task)

- Package manager **pnpm** (never npm/yarn). Latest stable framework majors.
- **English** for code/comments/keys; **German** for user-facing UI (no generic masculine — use neutral terms or colon-i).
- **Offline-first PWA:** no CDN / runtime fetches, **no new runtime deps** (gzip/compression is native via `CompressionStream`).
- Snapshot Svelte `$state` with `$state.snapshot()` before persisting to Dexie (else `DataCloneError`).
- All File System Access code gated on `'showDirectoryPicker' in window`; unsupported browsers (iOS Safari, Firefox) keep the existing manual export + reminder unchanged.
- Backups: gzip, file name `perimenobomb-YYYY-MM-DD.json.gz`, retention default 14 days, **atomic** writes (temp file then `move()`).
- Compiler/tests: **≤4 cores** (shared machine).

## Commands

```bash
# Type-check (fast, authoritative — must be 0 ERRORS 0 WARNINGS)
pnpm run check

# Run a single test file
CI=1 pnpm exec vitest run src/lib/utils/gzip.test.ts

# Full suite
CI=1 pnpm exec vitest run

# Production build
pnpm build

# Real-browser preview (for Task 12 manual FSA verification)
pnpm build && pnpm preview --port 4173 --host 127.0.0.1
```

Notes from this project's tooling:
- `pnpm run check` is fast (~1s) and is the most reliable signal; `svelte-check` is stricter than `vitest` (it flagged casts that vitest passed — prefer `as unknown as T` over direct casts on Dexie row types).
- The full vitest suite takes ~85 s.
- jsdom/Node expose `CompressionStream`, `TextEncoder`, `fake-indexeddb` — so gzip and rotation logic are unit-testable. The **File System Access API has no jsdom/headless implementation**, so `fsBackup`'s FSA glue (pick/permission/write/move/prune) is verified **manually in real Chrome** (plan Task 12), not in unit tests. Keep that glue thin; put all real logic in the pure helpers.

## Verification gates before declaring done

1. `pnpm run check` → 0/0.
2. `CI=1 pnpm exec vitest run` → all green.
3. `pnpm build` → BUILD OK.
4. Task 12 manual checks in Chrome (folder pick, daily file, debounced refresh, no stray `.tmp`, gz import round-trip, prune, reminder hidden when healthy / "unterbrochen" warning when broken).

## Environment facts (verified 2026-06, knowledge cutoff Jan 2026)

- File System Access pickers shipped on **Android Chrome M132** (stable ~Jan 2025); before that Android had OPFS only.
- **Persistent permissions** for installed PWAs: Chrome **122+** — a granted directory survives across launches; still `queryPermission()` and `requestPermission()` (gesture) as fallback.
- `CompressionStream`/`DecompressionStream` support only gzip/deflate natively (no brotli/zstd without WASM — out of scope).
