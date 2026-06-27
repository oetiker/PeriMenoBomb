import { db } from './index';

export async function getMeta<T = unknown>(key: string): Promise<T | undefined> {
  const row = await db.meta.get(key);
  return row?.value as T | undefined;
}

export async function setMeta<T = unknown>(key: string, value: T): Promise<void> {
  await db.meta.put({ key, value });
}

export async function getOrDefault<T>(key: string, fallback: T): Promise<T> {
  const v = await getMeta<T>(key);
  return v === undefined ? fallback : v;
}

// Decide whether to show the first-run welcome screen.
//
// Defensive against partial data loss: the `firstRunCompleted` meta flag can go
// missing on its own (e.g. browser storage eviction dropping rows). Relying on
// the flag alone would greet a long-time user with the welcome/test-data screen
// even though their symptoms and entries are intact. So we only treat it as a
// genuine first run when the flag is unset AND there is no real data to show.
export async function shouldShowFirstRun(): Promise<boolean> {
  if (await getOrDefault('firstRunCompleted', false)) return false;
  const [symptomCount, entryCount, tagCount] = await Promise.all([
    db.symptoms.count(),
    db.entries.count(),
    db.tags.count()
  ]);
  return symptomCount === 0 && entryCount === 0 && tagCount === 0;
}
