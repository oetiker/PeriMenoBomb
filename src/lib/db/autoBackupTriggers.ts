// src/lib/db/autoBackupTriggers.ts
import { db } from './index';
import { isAutoBackupSupported, runAutoBackup } from './fsBackup';

let timer: ReturnType<typeof setTimeout> | undefined;
let registered = false;

// Coalesce bursts of writes into one backup a few seconds after the last change.
export function scheduleAutoBackup(delayMs = 5000): void {
  if (!isAutoBackupSupported()) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => { timer = undefined; void runAutoBackup(); }, delayMs);
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
