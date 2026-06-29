import { describe, it, expect, beforeEach } from 'vitest';
import { resetDatabase, db } from '$lib/db';
import { exportAll, importAll, validateExportPayload, gzipExport, jsonExport, readImportFile } from './transfer';
import { isGzip } from '$lib/utils/gzip';

describe('transfer', () => {
  beforeEach(() => resetDatabase());

  it('round-trips an export through import', async () => {
    await db.tags.add({ id: 't1', name: 'körperlich', createdAt: 1 });
    await db.symptoms.add({ id: 's1', name: 'A', color: '#000', icon: 'circle', tagIds: ['t1'], parentId: null, sortIndex: 0, depth: 0, isFolder: false, archived: false, createdAt: 1, updatedAt: 1, fields: [], daily: false });
    await db.entries.add({ id: '2026-05-27__s1', date: '2026-05-27', symptomId: 's1', values: { v1: 50 }, updatedAt: 1 });

    const payload = await exportAll();
    await resetDatabase();
    await importAll(payload, 'replace');

    expect(await db.tags.count()).toBe(1);
    expect((await db.symptoms.get('s1'))?.name).toBe('A');
    expect((await db.entries.get('2026-05-27__s1'))?.values.v1).toBe(50);
  });

  it('excludes device-local meta (folder handle, auto-backup status) from the export', async () => {
    await db.meta.bulkPut([
      { key: 'sliderStep', value: 10 },
      { key: 'autoBackupDirHandle', value: { fake: 'handle' } },
      { key: 'autoBackupLastSuccess', value: 123 },
      { key: 'autoBackupLastError', value: 'permission' },
      { key: 'autoBackupEnabled', value: true }
    ]);
    const payload = await exportAll();
    const keys = payload.meta.map((m) => m.key);
    // Portable settings survive...
    expect(keys).toContain('sliderStep');
    expect(keys).toContain('autoBackupEnabled');
    // ...device-local rows are stripped.
    expect(keys).not.toContain('autoBackupDirHandle');
    expect(keys).not.toContain('autoBackupLastSuccess');
    expect(keys).not.toContain('autoBackupLastError');
  });

  it('validates payload version', () => {
    expect(validateExportPayload({ version: 'bogus' } as any)).toBe(false);
    expect(validateExportPayload({ version: 1, symptoms: [], tags: [], entries: [], meta: [] })).toBe(true);
  });

  it('merge keeps existing rows and overlays imported ids', async () => {
    await db.tags.add({ id: 't1', name: 'alt', createdAt: 1 });
    await importAll({ version: 1, tags: [{ id: 't1', name: 'neu', createdAt: 2 }, { id: 't2', name: 'andere', createdAt: 2 }], symptoms: [], entries: [], meta: [] }, 'merge');
    expect((await db.tags.get('t1'))?.name).toBe('neu');
    expect(await db.tags.get('t2')).toBeTruthy();
  });

  it('gzipExport produces gzip that readImportFile reads back', async () => {
    await db.tags.add({ id: 't1', name: 'x', createdAt: 1 });
    const payload = await exportAll();
    const blob = await gzipExport(payload);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    expect(isGzip(bytes)).toBe(true);
    const file = new File([blob], 'b.json.gz');
    const parsed = await readImportFile(file) as { tags: unknown[] };
    expect(parsed.tags).toHaveLength(1);
  });

  it('readImportFile also reads a plain-JSON file', async () => {
    const file = new File(['{"version":1,"symptoms":[],"tags":[],"entries":[],"meta":[]}'], 'b.json');
    const parsed = await readImportFile(file) as { version: number };
    expect(parsed.version).toBe(1);
  });

  it('jsonExport (gzip-less fallback) round-trips through readImportFile', async () => {
    await db.tags.add({ id: 't1', name: 'x', createdAt: 1 });
    const payload = await exportAll();
    const blob = jsonExport(payload);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    expect(isGzip(bytes)).toBe(false); // plain JSON, not gzip
    const file = new File([blob], 'b.json');
    const parsed = await readImportFile(file) as { tags: unknown[] };
    expect(parsed.tags).toHaveLength(1);
  });

  it('imports a legacy (pre-v6) backup as readable fields/values', async () => {
    // The bug: a v5-era export (symptom.inputs, entry value-columns) used to be
    // bulkPut raw, leaving the v6 app unable to read it. Import must migrate it.
    const legacy = {
      version: 1 as const,
      symptoms: [{
        id: 's1', name: 'Hitze', color: '#000', icon: '🔥', tagIds: [], parentId: null,
        sortIndex: 0, depth: 0, isFolder: false, archived: false, createdAt: 1, updatedAt: 1,
        daily: false, duotone: true, bg: true,
        inputs: { slider: { enabled: true, required: false, lowLabel: 'kurz', highLabel: 'lang' } }
      }],
      tags: [],
      entries: [{ id: '2026-06-01__s1', date: '2026-06-01', symptomId: 's1', sliderValue: 50, numberValue: null, comment: '', selectKey: null, updatedAt: 1 }],
      meta: []
    } as never;

    await importAll(legacy, 'replace');

    const sym = await db.symptoms.get('s1');
    expect((sym as unknown as { inputs?: unknown }).inputs).toBeUndefined();
    expect(sym?.fields.map((f) => f.type)).toEqual(['slider']);
    const fieldId = sym!.fields[0].id;
    const entry = await db.entries.get('2026-06-01__s1');
    expect(entry?.values).toEqual({ [fieldId]: 50 });
  });
});
