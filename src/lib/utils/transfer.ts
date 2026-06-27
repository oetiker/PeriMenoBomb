import { db, CURRENT_DB_VERSION, type Symptom, type Tag, type Entry, type MetaRow } from '$lib/db';
import { migrateBackupPayload } from '$lib/db/importMigrate';

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
  const [symptoms, tags, entries, meta] = await Promise.all([
    db.symptoms.toArray(),
    db.tags.toArray(),
    db.entries.toArray(),
    db.meta.toArray()
  ]);
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

export function downloadJson(filename: string, payload: unknown): void {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsText(file);
  });
}
