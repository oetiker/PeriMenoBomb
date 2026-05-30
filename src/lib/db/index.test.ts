import { describe, it, expect, beforeEach } from 'vitest';
import { db, resetDatabase } from './index';

describe('db schema', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('exposes the four expected tables', () => {
    expect(db.symptoms).toBeDefined();
    expect(db.tags).toBeDefined();
    expect(db.entries).toBeDefined();
    expect(db.meta).toBeDefined();
  });

  it('can store and read a meta key', async () => {
    await db.meta.put({ key: 'language', value: 'de' });
    const row = await db.meta.get('language');
    expect(row?.value).toBe('de');
  });

  it('reports version 5', () => {
    expect(db.verno).toBe(5);
  });
});
