import Dexie from 'dexie';
import { STORES, CURRENT_DB_VERSION, defineSchema } from './index';
import type { ExportPayload } from '$lib/utils/transfer';

// Monotonic suffix so two imports within the same millisecond can't collide on
// the throwaway database name (Date.now() alone is not unique enough).
let importSeq = 0;

/** The schema version a backup payload is in.
 *  - a valid `dbVersion` (stamped by current exports) wins, clamped to current;
 *  - a `fields`-shaped symptom means it is already current;
 *  - an `inputs`-shaped symptom is pre-v6 — seed at v2, the lowest rung that
 *    already has the `inputs` shape, so the (idempotent) v3→v6 upgrades replay
 *    forward regardless of whether it was really v2/v3/v4/v5;
 *  - anything else (no symptoms, or a true v1 export) is treated as current —
 *    v1 is not recoverable here anyway (v1→v2 cleared entries by design).
 *
 *  A `dbVersion` that is not a finite integer ≥ 2 is ignored and we fall back to
 *  shape detection: trusting it could throw (`seed.version(0)`) or, worse, seed
 *  at v1 and run the destructive v1→v2 upgrade we deliberately step over. */
export function detectSourceVersion(payload: ExportPayload): number {
  const dv = payload.dbVersion;
  if (typeof dv === 'number' && Number.isInteger(dv) && dv >= 2) {
    return Math.min(dv, CURRENT_DB_VERSION);
  }
  const syms = payload.symptoms as unknown as Array<Record<string, unknown>>;
  if (syms.some((s) => Array.isArray(s.fields))) return CURRENT_DB_VERSION;
  if (syms.some((s) => s.inputs && typeof s.inputs === 'object')) return 2;
  return CURRENT_DB_VERSION;
}

function deleteDatabase(name: string): Promise<void> {
  return new Promise((resolve) => {
    const req = indexedDB.deleteDatabase(name);
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });
}

/** Bring a backup payload up to the current schema by replaying it through the
 *  real Dexie migration chain: seed the raw rows into a throwaway database at
 *  the payload's source version, reopen it declaring the full chain so Dexie
 *  runs its own upgrades, then read the upgraded rows back out. Reusing the live
 *  migrations means there is no parallel transform to drift out of sync. */
export async function migrateBackupPayload(payload: ExportPayload): Promise<ExportPayload> {
  const source = detectSourceVersion(payload);
  if (source >= CURRENT_DB_VERSION) return payload;

  const name = `perimenobomb-import-${Date.now()}-${importSeq++}`;
  try {
    // Phase 1: seed at the source version so Dexie records it and will run only
    // the upgrades that come after it (notably skipping the destructive v1→v2).
    const seed = new Dexie(name);
    seed.version(source).stores(STORES);
    await seed.open();
    await seed.transaction('rw', seed.table('symptoms'), seed.table('tags'), seed.table('entries'), seed.table('meta'), async () => {
      await seed.table('symptoms').bulkPut(payload.symptoms);
      await seed.table('tags').bulkPut(payload.tags);
      await seed.table('entries').bulkPut(payload.entries);
      await seed.table('meta').bulkPut(payload.meta);
    });
    seed.close();

    // Phase 2: reopen with the full chain; Dexie upgrades source → current.
    const upgraded = new Dexie(name);
    defineSchema(upgraded);
    await upgraded.open();
    const [symptoms, tags, entries, meta] = await Promise.all([
      upgraded.table('symptoms').toArray(),
      upgraded.table('tags').toArray(),
      upgraded.table('entries').toArray(),
      upgraded.table('meta').toArray()
    ]);
    upgraded.close();

    return { ...payload, dbVersion: CURRENT_DB_VERSION, symptoms, tags, entries, meta };
  } finally {
    await deleteDatabase(name);
  }
}
