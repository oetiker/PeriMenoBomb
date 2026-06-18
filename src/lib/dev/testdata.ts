import { db, type Symptom } from '$lib/db';
import { importTemplate } from '$lib/templates/import';
import { DEFAULT_TEMPLATE } from '$lib/templates/perimeno-default';
import { upsertEntry } from '$lib/db/entries';
import { listAllSymptoms } from '$lib/db/symptoms';
import { todayKey, addDays } from '$lib/utils/date';

export interface TestDataResult {
  symptoms: number;
  entries: number;
  cycles: number;
}

/** Populate the database with realistic sample data so the report views have
    something to show. Imports the default template first if the DB is empty,
    then generates ~6 irregular cycles of Start/Ende-Mens plus a PMS-style
    headache build-up and several daily symptoms across the last ~120 days.
    Idempotent per (date, symptom): re-running overwrites the same entries. */
export async function loadTestData(): Promise<TestDataResult> {
  if ((await db.symptoms.count()) === 0) {
    await importTemplate(DEFAULT_TEMPLATE);
  }

  const all = await listAllSymptoms();
  const byName = (n: string) => all.find((s) => s.name === n && !s.isFolder);
  const startMens = byName('Start Mens');
  const endeMens = byName('Ende Mens');
  const kopf = byName('Kopfschmerzen');
  const reiz = byName('Reizbarkeit');
  const mued = byName('Müdigkeit');
  const schlaf = byName('Schlafqualität');
  const kaffee = byName('Kaffee');

  const today = todayKey();
  let entries = 0;

  // Resolve the id of a symptom's first non-deleted field of the given type, so
  // the seeded value lands under the right field key in the entry's value map.
  const fieldId = (sym: Symptom | undefined, type: 'slider' | 'number' | 'text'): string | null =>
    sym?.fields.find((f) => !f.deleted && f.type === type)?.id ?? null;

  const put = async (
    sym: Symptom | undefined,
    date: string,
    spec: { slider?: number | null; number?: number | null; comment?: string }
  ) => {
    if (!sym) return;
    const values: Record<string, number | string | null> = {};
    if (spec.slider !== undefined) { const id = fieldId(sym, 'slider'); if (id) values[id] = spec.slider; }
    if (spec.number !== undefined) { const id = fieldId(sym, 'number'); if (id) values[id] = spec.number; }
    if (spec.comment !== undefined) { const id = fieldId(sym, 'text'); if (id) values[id] = spec.comment; }
    await upsertEntry({ date, symptomId: sym.id, values });
    entries++;
  };

  // Irregular cycle lengths (newest first), most recent period start ~12 days ago.
  const cycleLengths = [29, 27, 31, 26, 30, 28];
  let cursor = addDays(today, -12);
  const starts: string[] = [];
  for (let i = 0; i < cycleLengths.length; i++) {
    starts.push(cursor);
    cursor = addDays(cursor, -cycleLengths[i]);
  }
  starts.reverse(); // ascending

  for (const start of starts) {
    await put(startMens, start, { comment: 'Beginn' });
    await put(endeMens, addDays(start, 5), { comment: '' });
    // PMS-style headache: rises toward day 0, eases after.
    await put(kopf, addDays(start, -3), { slider: 35 });
    await put(kopf, addDays(start, -2), { slider: 60 });
    await put(kopf, addDays(start, -1), { slider: 85 });
    await put(kopf, addDays(start, 0), { slider: 50 });
  }

  // Daily symptoms: (almost) every day with smooth, phase-shifted waves so the
  // data reads like real tracking — not a mechanical every-other-day pattern.
  for (let d = 120; d >= 0; d--) {
    const date = addDays(today, -d);
    const wave = (period: number, phase: number, base: number, amp: number) =>
      Math.max(1, Math.min(100, Math.round(base + amp * Math.sin(d / period + phase))));
    if (d % 7 !== 6) await put(reiz, date, { slider: wave(6, 0, 45, 35) }); // skips ~1 day/week
    if (d % 9 !== 0) await put(mued, date, { slider: wave(8, 1, 50, 30) });
    if (d % 6 !== 5) await put(schlaf, date, { slider: wave(5, 2, 55, 25) });
    if (d % 3 === 0) await put(kaffee, date, { number: 1 + (d % 3) });
  }

  return { symptoms: all.length, entries, cycles: starts.length };
}
