import { describe, it, expect, beforeEach } from 'vitest';
import Dexie from 'dexie';
import 'fake-indexeddb/auto';
import { upgradeV1toV2, upgradeV4toV5, upgradeV5toV6 } from './index';

const STORES = {
  symptoms: 'id, parentId, [parentId+sortIndex], archived',
  tags:     'id, name',
  entries:  'id, date, symptomId, [date+symptomId]',
  meta:     'key'
};

const DB_NAME = 'perimenobomb-migrationtest';

async function deleteDb() {
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });
}

describe('Dexie schema v1 → v2 upgrade', () => {
  beforeEach(deleteDb);

  it('clears entries, adds inputs+daily defaults to symptoms, drops meta.openDialog', async () => {
    // 1) Open v1 explicitly, seed legacy data.
    const v1 = new Dexie(DB_NAME);
    v1.version(1).stores({
      symptoms: 'id, parentId, [parentId+sortIndex], archived',
      tags:     'id, name',
      entries:  'id, date, symptomId, [date+symptomId]',
      meta:     'key'
    });
    await v1.open();
    await v1.table('symptoms').add({
      id: 's1', name: 'Old', color: '#000', icon: 'circle',
      tagIds: [], parentId: null, sortIndex: 0, depth: 0,
      isFolder: false, archived: false, createdAt: 1, updatedAt: 1
      // NB: no inputs, no daily — v1 shape
    });
    await v1.table('entries').add({
      id: '2026-05-27__s1', date: '2026-05-27', symptomId: 's1',
      intensity: 'mittel', comment: 'legacy', updatedAt: 1
    });
    await v1.table('meta').add({ key: 'openDialog', value: { stale: true } });
    v1.close();

    // 2) Open v2 with the same name → upgrade fires.
    const v2 = new Dexie(DB_NAME);
    v2.version(1).stores({
      symptoms: 'id, parentId, [parentId+sortIndex], archived',
      tags:     'id, name',
      entries:  'id, date, symptomId, [date+symptomId]',
      meta:     'key'
    });
    v2.version(2).stores({
      symptoms: 'id, parentId, [parentId+sortIndex], archived',
      tags:     'id, name',
      entries:  'id, date, symptomId, [date+symptomId]',
      meta:     'key'
    }).upgrade(upgradeV1toV2);
    await v2.open();

    const entries = await v2.table('entries').toArray();
    expect(entries).toEqual([]);

    const sym = await v2.table('symptoms').get('s1');
    expect(sym.inputs).toEqual({
      slider:  { enabled: false, required: false, lowLabel: '', highLabel: '' },
      number:  { enabled: false, required: false, unit: '', integer: true },
      comment: { enabled: false, required: false },
      select:  { enabled: false, required: false, options: [] }
    });
    expect(sym.daily).toBe(false);

    const od = await v2.table('meta').get('openDialog');
    expect(od).toBeUndefined();
    v2.close();
  });
});

describe('Dexie schema v4 → v5 upgrade', () => {
  beforeEach(deleteDb);

  it('backfills a disabled+empty select block on existing symptoms', async () => {
    // Seed a v4-shaped symptom whose inputs lack the select block.
    const v4 = new Dexie(DB_NAME);
    v4.version(4).stores(STORES);
    await v4.open();
    await v4.table('symptoms').add({
      id: 's1', name: 'Old', color: '#000', icon: '⚪',
      tagIds: [], parentId: null, sortIndex: 0, depth: 0,
      isFolder: false, archived: false, createdAt: 1, updatedAt: 1,
      daily: false, duotone: true, bg: true,
      inputs: {
        slider:  { enabled: false, required: false, lowLabel: '', highLabel: '' },
        number:  { enabled: false, required: false, unit: '', integer: true },
        comment: { enabled: false, required: false }
        // NB: no select — v4 shape
      }
    });
    v4.close();

    const v5 = new Dexie(DB_NAME);
    v5.version(4).stores(STORES);
    v5.version(5).stores(STORES).upgrade(upgradeV4toV5);
    await v5.open();

    const sym = await v5.table('symptoms').get('s1');
    expect(sym.inputs.select).toEqual({ enabled: false, required: false, options: [] });
    v5.close();
  });
});

describe('Dexie schema v5 → v6 upgrade', () => {
  beforeEach(deleteDb);

  it('converts inputs→fields, rewrites entry values, and remaps the cycle value series', async () => {
    const v5 = new Dexie(DB_NAME);
    v5.version(5).stores(STORES);
    await v5.open();
    await v5.table('symptoms').add({
      id: 's1', name: 'Hitze', color: '#000', icon: '🔥', tagIds: [], parentId: null,
      sortIndex: 0, depth: 0, isFolder: false, archived: false, createdAt: 1, updatedAt: 1,
      daily: false, duotone: true, bg: true,
      inputs: {
        slider:  { enabled: true,  required: false, lowLabel: 'kurz', highLabel: 'lang' },
        number:  { enabled: true,  required: true,  unit: 'Schübe', integer: true },
        comment: { enabled: true,  required: false },
        select:  { enabled: false, required: false, options: [] }
      }
    });
    await v5.table('entries').add({
      id: '2026-06-01__s1', date: '2026-06-01', symptomId: 's1',
      sliderValue: 50, numberValue: 3, comment: 'warm', selectKey: null, updatedAt: 1
    });
    await v5.table('meta').add({ key: 'report.cycle.valueId', value: 's1' });
    v5.close();

    const v6 = new Dexie(DB_NAME);
    v6.version(5).stores(STORES);
    v6.version(6).stores(STORES).upgrade(upgradeV5toV6);
    await v6.open();

    const sym = await v6.table('symptoms').get('s1');
    expect(sym.inputs).toBeUndefined();
    expect(sym.fields.map((f: { type: string; label: string }) => `${f.type}:${f.label}`))
      .toEqual(['slider:Intensität', 'number:Schübe', 'text:Notiz']);
    const sliderId = sym.fields[0].id, numberId = sym.fields[1].id, textId = sym.fields[2].id;
    expect(sym.fields[1].required).toBe(true);

    const e = await v6.table('entries').get('2026-06-01__s1');
    expect(e.values).toEqual({ [sliderId]: 50, [numberId]: 3, [textId]: 'warm' });
    expect(e.sliderValue).toBeUndefined();

    const meta = await v6.table('meta').get('report.cycle.valueFieldId');
    expect(meta.value).toBe(sliderId);
    v6.close();
  });
});
