import { db, CURRENT_DB_VERSION, type Symptom, type Tag, type Entry, type MetaRow } from '$lib/db';
import { migrateBackupPayload } from '$lib/db/importMigrate';
import { DEVICE_LOCAL_META_KEYS } from '$lib/db/metaKeys';
import { gzip, gunzip, isGzip, encodeText, decodeText } from '$lib/utils/gzip';

export const EXPORT_VERSION = 1 as const;

export interface ExportPayload {
  version: typeof EXPORT_VERSION;
  /** The Dexie schema version the rows are in. Stamped by current exports so an
      import can replay an old backup through the right migrations; absent on
      backups taken before this field existed (handled by shape detection). */
  dbVersion?: number;
  exportedAt?: string;
  symptoms: Symptom[];
  tags: Tag[];
  entries: Entry[];
  meta: MetaRow[];
}

export type ImportMode = 'replace' | 'merge';

export function validateExportPayload(x: unknown): x is ExportPayload {
  if (!x || typeof x !== 'object') return false;
  const p = x as Record<string, unknown>;
  return p.version === EXPORT_VERSION
    && Array.isArray(p.symptoms)
    && Array.isArray(p.tags)
    && Array.isArray(p.entries)
    && Array.isArray(p.meta);
}

export async function exportAll(): Promise<ExportPayload> {
  const [symptoms, tags, entries, allMeta] = await Promise.all([
    db.symptoms.toArray(),
    db.tags.toArray(),
    db.entries.toArray(),
    db.meta.toArray()
  ]);
  // Drop device-local meta (the FileSystemDirectoryHandle and auto-backup status):
  // a handle serialises to {} through JSON and would read back as a dead-but-truthy
  // handle, silently breaking auto-backup on the restoring device. See metaKeys.ts.
  const meta = allMeta.filter((row) => !DEVICE_LOCAL_META_KEYS.has(row.key));
  return { version: EXPORT_VERSION, dbVersion: CURRENT_DB_VERSION, exportedAt: new Date().toISOString(), symptoms, tags, entries, meta };
}

export async function importAll(payload: ExportPayload, mode: ImportMode): Promise<void> {
  if (!validateExportPayload(payload)) throw new Error('Ungültiges Export-Format');
  // Replay older backups through the real migration chain so their rows match
  // the current schema before they land in the live DB.
  const migrated = await migrateBackupPayload(payload);
  await db.transaction('rw', db.symptoms, db.tags, db.entries, db.meta, async () => {
    if (mode === 'replace') {
      await Promise.all([db.symptoms.clear(), db.tags.clear(), db.entries.clear(), db.meta.clear()]);
    }
    await db.symptoms.bulkPut(migrated.symptoms);
    await db.tags.bulkPut(migrated.tags);
    await db.entries.bulkPut(migrated.entries);
    await db.meta.bulkPut(migrated.meta);
  });
}

// gzip needs the Compression Streams API. It's near-universal (Chrome 80+,
// Firefox 113+, Safari 16.4+) but absent on older engines, so the manual-export
// path feature-detects and falls back to plain JSON (which readImportFile still
// reads). Auto-backup is FSA-gated (modern Chromium) so it always has gzip.
export function isCompressionSupported(): boolean {
  return typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined';
}

export async function gzipExport(payload: ExportPayload): Promise<Blob> {
  const bytes = await gzip(encodeText(JSON.stringify(payload)));
  // Uint8Array satisfies BlobPart; cast required by the project's strict tsconfig.
  return new Blob([bytes as BlobPart], { type: 'application/gzip' });
}

// Uncompressed fallback for engines without Compression Streams.
export function jsonExport(payload: ExportPayload): Blob {
  return new Blob([JSON.stringify(payload)], { type: 'application/json' });
}

export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Read an export file regardless of compression: gzip is detected by its magic
// bytes (so both .json and .json.gz work, by content not extension), then JSON-
// parsed. Throws on invalid JSON for the caller to surface.
export async function readImportFile(file: File): Promise<unknown> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const text = isGzip(bytes) ? decodeText(await gunzip(bytes)) : decodeText(bytes);
  return JSON.parse(text);
}
