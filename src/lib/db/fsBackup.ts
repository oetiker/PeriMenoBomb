// src/lib/db/fsBackup.ts
import { db } from './index';
import { getMeta, setMeta } from './meta';
import { coerceRetentionDays } from '$lib/utils/backupRotation';

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
