// src/lib/db/fsBackup.ts
import { db } from './index';
import { getMeta, setMeta } from './meta';
import { coerceRetentionDays, autoBackupFileName, selectForPruning } from '$lib/utils/backupRotation';
import { gzip, encodeText } from '$lib/utils/gzip';
import { exportAll } from '$lib/utils/transfer';
import { recordBackupTime } from './backup';
import { todayKey, toTimeKey } from '$lib/utils/date';

const DIR_HANDLE_KEY = 'autoBackupDirHandle';
const ENABLED_KEY = 'autoBackupEnabled';
const RETENTION_KEY = 'autoBackupRetentionDays';
const LAST_SUCCESS_KEY = 'autoBackupLastSuccess';
const LAST_ERROR_KEY = 'autoBackupLastError';

// File System Access pickers exist on Chromium (desktop + Android M132+); absent
// on iOS Safari / Firefox, where the feature is hidden entirely.
export function isAutoBackupSupported(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}

// FileSystemDirectoryHandle is structured-cloneable, so Dexie can persist it.
export async function getBackupDirHandle(): Promise<FileSystemDirectoryHandle | undefined> {
  return getMeta<FileSystemDirectoryHandle>(DIR_HANDLE_KEY);
}
export async function setBackupDirHandle(h: FileSystemDirectoryHandle): Promise<void> {
  await setMeta(DIR_HANDLE_KEY, h);
}
export async function clearBackupDirHandle(): Promise<void> {
  await db.meta.delete(DIR_HANDLE_KEY);
}

export async function isAutoBackupEnabled(): Promise<boolean> {
  return (await getMeta<boolean>(ENABLED_KEY)) === true;
}
export async function setAutoBackupEnabled(on: boolean): Promise<void> {
  await setMeta(ENABLED_KEY, on === true);
}

export async function getRetentionDays(): Promise<number> {
  return coerceRetentionDays(await getMeta(RETENTION_KEY));
}
export async function setRetentionDays(v: unknown): Promise<void> {
  await setMeta(RETENTION_KEY, coerceRetentionDays(v));
}

export async function getAutoBackupStatus(): Promise<{ lastSuccess?: number; lastError?: string }> {
  const ls = await getMeta<unknown>(LAST_SUCCESS_KEY);
  const le = await getMeta<unknown>(LAST_ERROR_KEY);
  return {
    lastSuccess: typeof ls === 'number' && Number.isFinite(ls) ? ls : undefined,
    lastError: typeof le === 'string' && le.length > 0 ? le : undefined
  };
}

export async function recordAutoBackupSuccess(now: number): Promise<void> {
  await setMeta(LAST_SUCCESS_KEY, now);
  await db.meta.delete(LAST_ERROR_KEY);
}
export async function recordAutoBackupError(message: string): Promise<void> {
  await setMeta(LAST_ERROR_KEY, message);
}

// The handle's permission methods are not yet in the TS DOM lib; declare the
// minimum we use.
type Perm = { mode: 'read' | 'readwrite' };
type WithPerms = FileSystemDirectoryHandle & {
  queryPermission(p: Perm): Promise<PermissionState>;
  requestPermission(p: Perm): Promise<PermissionState>;
};

export async function pickBackupFolder(): Promise<FileSystemDirectoryHandle | null> {
  // Must be called from a user gesture (a click handler).
  const picker = (window as unknown as {
    showDirectoryPicker(opts?: { mode?: 'read' | 'readwrite' }): Promise<FileSystemDirectoryHandle>;
  }).showDirectoryPicker;
  try {
    return await picker({ mode: 'readwrite' });
  } catch {
    return null; // user cancelled
  }
}

// queryPermission can reject on a stale/invalid handle in some engines; never
// throw — a failure to determine access is treated as 'denied' so the callers
// (runAutoBackup, autoBackupHealth) stay silent and best-effort.
export async function queryBackupAccess(h: FileSystemDirectoryHandle): Promise<PermissionState> {
  try {
    return await (h as WithPerms).queryPermission({ mode: 'readwrite' });
  } catch {
    return 'denied';
  }
}

export async function requestBackupAccess(h: FileSystemDirectoryHandle): Promise<boolean> {
  // Must be called from a user gesture. requestPermission can reject (e.g. not a
  // gesture, or handle revoked); swallow it and report "not granted" so a click
  // handler reports cleanly instead of aborting on an unhandled rejection.
  try {
    return (await (h as WithPerms).requestPermission({ mode: 'readwrite' })) === 'granted';
  } catch {
    return false;
  }
}

// Write a fresh, uniquely-named backup file. We deliberately never overwrite,
// rename or move an existing file: Android content-URIs (the disk picker on
// Chrome Android M132+) support neither atomic writes nor move()/rename, so the
// previous temp-file + move() scheme failed there. Creating a new timestamped
// file and letting pruneBackups() drop the older same-day ones uses only the two
// operations Android does support (create + delete). The last good backup stays
// untouched until this write closes cleanly, so an interrupted write never
// clobbers it.
export async function writeBackupFile(
  dir: FileSystemDirectoryHandle,
  bytes: Uint8Array,
  dateKey: string,
  timeKey: string
): Promise<void> {
  const name = autoBackupFileName(dateKey, timeKey);
  const fh = await dir.getFileHandle(name, { create: true });
  const w = await fh.createWritable();
  // BlobPart cast mirrors gzip.ts pattern — Uint8Array<ArrayBufferLike> vs strict DOM.
  // On write failure abort() releases the file lock and discards the partial
  // file, so a leaked writable never blocks the next backup run.
  try {
    await w.write(new Blob([bytes as BlobPart]));
    await w.close();
  } catch (err) {
    await w.abort().catch(() => undefined);
    throw err;
  }
}

export async function pruneBackups(
  dir: FileSystemDirectoryHandle,
  retentionDays: number,
  today: string
): Promise<string[]> {
  const names: string[] = [];
  // AsyncIterable keys(); not yet in the TS DOM lib.
  for await (const name of (dir as unknown as { keys(): AsyncIterable<string> }).keys()) {
    names.push(name);
  }
  const { delete: del } = selectForPruning(names, today, retentionDays);
  for (const name of del) await dir.removeEntry(name);
  return del;
}

// Write today's backup file (overwriting) and prune. Silent and best-effort:
// never throws into the caller; failures are recorded for the Settings status.
// `withGesture` allows requesting permission (only true when called from a tap).
export async function runAutoBackup(
  now: number = Date.now(),
  withGesture = false
): Promise<'skipped' | 'ok' | 'unhealthy' | 'error'> {
  if (!isAutoBackupSupported()) return 'skipped';
  // Whole body in try/catch: every await below (config reads, permission API,
  // export, write, prune, status writes) can theoretically reject; "best-effort"
  // means none of that escapes to the `void runAutoBackup()` callers.
  try {
    if (!(await isAutoBackupEnabled())) return 'skipped';
    const dir = await getBackupDirHandle();
    if (!dir) return 'unhealthy';

    let access = await queryBackupAccess(dir);
    if (access !== 'granted' && withGesture) {
      access = (await requestBackupAccess(dir)) ? 'granted' : access;
    }
    if (access !== 'granted') {
      await recordAutoBackupError('permission');
      return 'unhealthy';
    }

    const payload = await exportAll();
    const bytes = await gzip(encodeText(JSON.stringify(payload)));
    const day = todayKey();
    await writeBackupFile(dir, bytes, day, toTimeKey(new Date(now)));
    await pruneBackups(dir, await getRetentionDays(), day);
    await recordAutoBackupSuccess(now);
    await recordBackupTime(now); // keep the reminder clock consistent
    return 'ok';
  } catch (err) {
    await recordAutoBackupError((err as Error)?.message ?? 'write failed').catch(() => undefined);
    return 'error';
  }
}

export async function autoBackupHealth(): Promise<{
  enabled: boolean;
  healthy: boolean;
  reason?: string;
}> {
  try {
    const enabled = isAutoBackupSupported() && (await isAutoBackupEnabled());
    if (!enabled) return { enabled: false, healthy: false };
    const dir = await getBackupDirHandle();
    if (!dir) return { enabled: true, healthy: false, reason: 'no-folder' };
    if ((await queryBackupAccess(dir)) !== 'granted') {
      return { enabled: true, healthy: false, reason: 'permission' };
    }
    const { lastError, lastSuccess } = await getAutoBackupStatus();
    if (lastError) return { enabled: true, healthy: false, reason: lastError };
    // Configured correctly but no backup has actually been written yet: not a
    // failure ('no-backup-yet'), but not healthy either — the caller keeps the
    // ordinary backup reminder visible until a real backup succeeds.
    if (lastSuccess === undefined) return { enabled: true, healthy: false, reason: 'no-backup-yet' };
    return { enabled: true, healthy: true };
  } catch {
    // Best-effort: on an unexpected error, report not-enabled so the day view
    // falls back to the ordinary interval reminder rather than crashing.
    return { enabled: false, healthy: false };
  }
}
