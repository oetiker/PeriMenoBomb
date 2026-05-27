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
