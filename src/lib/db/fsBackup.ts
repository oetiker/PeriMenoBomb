// src/lib/db/fsBackup.ts
import { db } from './index';
import { getMeta, setMeta } from './meta';
import { coerceRetentionDays, backupFileName, selectForPruning } from '$lib/utils/backupRotation';
import { gzip, encodeText } from '$lib/utils/gzip';
import { exportAll } from '$lib/utils/transfer';
import { recordBackupTime } from './backup';
import { todayKey } from '$lib/utils/date';

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

export function queryBackupAccess(h: FileSystemDirectoryHandle): Promise<PermissionState> {
  return (h as WithPerms).queryPermission({ mode: 'readwrite' });
}

export async function requestBackupAccess(h: FileSystemDirectoryHandle): Promise<boolean> {
  // Must be called from a user gesture.
  return (await (h as WithPerms).requestPermission({ mode: 'readwrite' })) === 'granted';
}

// Atomic: write a temp file, then move() it onto the final name only after a
// clean close, so an interrupted write never clobbers the last good backup.
export async function writeBackupFile(
  dir: FileSystemDirectoryHandle,
  bytes: Uint8Array,
  dateKey: string
): Promise<void> {
  const finalName = backupFileName(dateKey);
  const tmpName = `${finalName}.tmp`;
  const tmp = await dir.getFileHandle(tmpName, { create: true });
  const w = await tmp.createWritable();
  // BlobPart cast mirrors gzip.ts pattern — Uint8Array<ArrayBufferLike> vs strict DOM.
  // On write failure (e.g. disk full) abort() releases the file lock and discards
  // the partial temp, so a leaked writable never blocks the next backup run.
  try {
    await w.write(new Blob([bytes as BlobPart]));
    await w.close();
  } catch (err) {
    await w.abort().catch(() => undefined);
    throw err;
  }
  const movable = tmp as FileSystemFileHandle & { move?(name: string): Promise<void> };
  if (typeof movable.move === 'function') {
    await movable.move(finalName); // replaces an existing same-day file
  } else {
    // Fallback for engines without move(): copy then drop the temp.
    const out = await dir.getFileHandle(finalName, { create: true });
    const ow = await out.createWritable();
    try {
      await ow.write(new Blob([bytes as BlobPart]));
      await ow.close();
    } catch (err) {
      await ow.abort().catch(() => undefined);
      throw err; // leave the temp in place; do not remove on a failed copy
    }
    await dir.removeEntry(tmpName);
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

  try {
    const payload = await exportAll();
    const bytes = await gzip(encodeText(JSON.stringify(payload)));
    const day = todayKey();
    await writeBackupFile(dir, bytes, day);
    await pruneBackups(dir, await getRetentionDays(), day);
    await recordAutoBackupSuccess(now);
    await recordBackupTime(now); // keep the reminder clock consistent
    return 'ok';
  } catch (err) {
    await recordAutoBackupError((err as Error)?.message ?? 'write failed');
    return 'error';
  }
}

export async function autoBackupHealth(): Promise<{
  enabled: boolean;
  healthy: boolean;
  reason?: string;
}> {
  const enabled = isAutoBackupSupported() && (await isAutoBackupEnabled());
  if (!enabled) return { enabled: false, healthy: false };
  const dir = await getBackupDirHandle();
  if (!dir) return { enabled: true, healthy: false, reason: 'no-folder' };
  if ((await queryBackupAccess(dir)) !== 'granted') {
    return { enabled: true, healthy: false, reason: 'permission' };
  }
  const { lastError } = await getAutoBackupStatus();
  if (lastError) return { enabled: true, healthy: false, reason: lastError };
  return { enabled: true, healthy: true };
}
