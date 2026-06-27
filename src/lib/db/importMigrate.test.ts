import { describe, it, expect } from 'vitest';
import 'fake-indexeddb/auto';
import { detectSourceVersion, migrateBackupPayload } from './importMigrate';
import type { ExportPayload } from '$lib/utils/transfer';

function payload(over: Partial<ExportPayload>): ExportPayload {
  return { version: 1, symptoms: [], tags: [], entries: [], meta: [], ...over };
}

// A v5-era symptom: fixed `inputs` struct, no `fields`.
function legacySymptom(over = {}) {
  return {
    id: 's1', name: 'Hitze', color: '#000', icon: '🔥', tagIds: [], parentId: null,
    sortIndex: 0, depth: 0, isFolder: false, archived: false, createdAt: 1, updatedAt: 1,
    daily: false, duotone: true, bg: true,
    inputs: {
      slider:  { enabled: true,  required: false, lowLabel: 'kurz', highLabel: 'lang' },
      number:  { enabled: true,  required: true,  unit: 'Schübe', integer: true },
      comment: { enabled: false, required: false },
      select:  { enabled: false, required: false, options: [] }
    },
    ...over
  };
}
function legacyEntry(over = {}) {
  return { id: '2026-06-01__s1', date: '2026-06-01', symptomId: 's1', sliderValue: 50, numberValue: 3, comment: '', selectKey: null, updatedAt: 1, ...over };
}

describe('detectSourceVersion', () => {
  it('uses an explicit dbVersion when present', () => {
    expect(detectSourceVersion(payload({ dbVersion: 5 }))).toBe(5);
  });
  it('treats a fields-shaped payload as current', () => {
    expect(detectSourceVersion(payload({ symptoms: [{ id: 'a', fields: [] }] as never }))).toBe(6);
  });
  it('treats an inputs-shaped payload as v2 (lowest non-destructive rung)', () => {
    expect(detectSourceVersion(payload({ symptoms: [legacySymptom()] as never }))).toBe(2);
  });

  it('ignores a dbVersion below 2 (would hit the destructive v1→v2 path) and shape-detects', () => {
    expect(detectSourceVersion(payload({ dbVersion: 1, symptoms: [legacySymptom()] as never }))).toBe(2);
    expect(detectSourceVersion(payload({ dbVersion: 0, symptoms: [legacySymptom()] as never }))).toBe(2);
  });

  it('ignores a non-integer / NaN dbVersion and shape-detects', () => {
    expect(detectSourceVersion(payload({ dbVersion: Number.NaN, symptoms: [legacySymptom()] as never }))).toBe(2);
    expect(detectSourceVersion(payload({ dbVersion: 2.5, symptoms: [{ id: 'a', fields: [] }] as never }))).toBe(6);
  });

  it('clamps a too-new dbVersion down to current', () => {
    expect(detectSourceVersion(payload({ dbVersion: 99 }))).toBe(6);
  });
});

describe('migrateBackupPayload', () => {
  it('returns a current-shaped payload untouched', async () => {
    const p = payload({ dbVersion: 6, symptoms: [{ id: 'a', fields: [] }] as never });
    expect(await migrateBackupPayload(p)).toBe(p);
  });

  it('upgrades a legacy inputs/columns payload to fields/values', async () => {
    const out = await migrateBackupPayload(payload({
      symptoms: [legacySymptom()] as never,
      entries: [legacyEntry()] as never,
      meta: [{ key: 'report.cycle.valueId', value: 's1' }]
    }));
    const sym = out.symptoms[0] as unknown as Record<string, unknown>;
    expect(sym.inputs).toBeUndefined();
    const fields = sym.fields as Array<{ id: string; type: string }>;
    expect(fields.map((f) => f.type)).toEqual(['slider', 'number']);
    const ent = out.entries[0] as unknown as Record<string, unknown>;
    expect(ent.values).toEqual({ [fields[0].id]: 50, [fields[1].id]: 3 });
    expect(ent.sliderValue).toBeUndefined();
    expect(out.dbVersion).toBe(6);
    expect(out.meta.find((m) => m.key === 'report.cycle.valueFieldId')?.value).toBe(fields[0].id);
  });

  it('runs intermediate upgrades too (seed-at-v2 backfills bg for an older shape)', async () => {
    // A symptom that predates bg (v3) and predates inputs.select (v4): seeding
    // at v2 must run v3→v4 (adds bg) and v4→v5 (adds select) before v5→v6.
    const old = legacySymptom({ bg: undefined, inputs: { slider: { enabled: true, required: false, lowLabel: '', highLabel: '' } } });
    delete (old as Record<string, unknown>).bg;
    const out = await migrateBackupPayload(payload({ symptoms: [old] as never }));
    const sym = out.symptoms[0] as unknown as Record<string, unknown>;
    expect(sym.bg).toBe(true);
    expect((sym.fields as unknown[]).length).toBe(1);
  });
});
