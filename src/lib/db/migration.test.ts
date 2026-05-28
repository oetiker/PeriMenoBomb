import { describe, it, expect, beforeEach } from 'vitest';
import Dexie from 'dexie';
import 'fake-indexeddb/auto';
import { defaultSymptomInputs, upgradeV1toV2 } from './index';

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
    expect(sym.inputs).toEqual(defaultSymptomInputs());
    expect(sym.daily).toBe(false);

    const od = await v2.table('meta').get('openDialog');
    expect(od).toBeUndefined();
    v2.close();
  });
});
