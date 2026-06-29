// src/lib/db/autoBackupTriggers.ts
import { db } from './index';
import { isAutoBackupSupported, runAutoBackup } from './fsBackup';

let timer: ReturnType<typeof setTimeout> | undefined;
let registered = false;

// Coalesce bursts of writes into one backup a few seconds after the last change.
// This debounced path runs WITHOUT a user gesture, so it can only succeed when
// folder permission is already live — it cannot re-grant. Use it for background
// writes (imports, edits); prefer runAutoBackupOnGesture() for user actions.
export function scheduleAutoBackup(delayMs = 5000): void {
  if (!isAutoBackupSupported()) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => { timer = undefined; void runAutoBackup(); }, delayMs);
}

// Run a backup off the back of a discrete user action (e.g. saving an entry).
// That action is a transient activation we can spend on requestPermission(), so
// this path can silently re-grant the folder access Chrome revokes while an
// installed PWA is backgrounded — the only way folder backups survive app
// switches on Android. Call it promptly from the gesture's handler (a fast DB
// write before it is fine; avoid long awaits that would expire the ~5s window).
// Fire-and-forget so the UI isn't blocked by export/gzip; cancels any pending
// debounced run to avoid a redundant second backup.
export function runAutoBackupOnGesture(): void {
  if (!isAutoBackupSupported()) return;
  if (timer) { clearTimeout(timer); timer = undefined; }
  void runAutoBackup(Date.now(), true);
}

// Register once. Hook the data tables (NOT meta — runAutoBackup writes meta and
// would otherwise re-trigger itself). Hooks fire inside the write transaction,
// so we only schedule (the actual backup runs later, outside it).
export function registerAutoBackupTriggers(): void {
  if (registered || !isAutoBackupSupported()) return;
  registered = true;
  for (const table of [db.symptoms, db.entries, db.tags]) {
    table.hook('creating', () => { scheduleAutoBackup(); });
    table.hook('updating', () => { scheduleAutoBackup(); });
    table.hook('deleting', () => { scheduleAutoBackup(); });
  }
}
