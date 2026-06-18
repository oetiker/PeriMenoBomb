import { describe, it, expect, beforeEach } from 'vitest';
import { resetDatabase, db } from '$lib/db';
import { importTemplate } from './import';
import { DEFAULT_TEMPLATE } from './perimeno-default';
import { newField } from '$lib/db/fields';

describe('importTemplate', () => {
  beforeEach(() => resetDatabase());

  it('inserts tags', async () => {
    await importTemplate(DEFAULT_TEMPLATE);
    expect(await db.tags.count()).toBe(DEFAULT_TEMPLATE.tags.length);
  });

  it('inserts root + child symptoms with correct depth', async () => {
    await importTemplate(DEFAULT_TEMPLATE);
    const roots = await db.symptoms.filter((s) => s.parentId === null).toArray();
    expect(roots.length).toBeGreaterThan(0);
    for (const r of roots) expect(r.depth).toBe(0);
    const kids = await db.symptoms.filter((s) => s.parentId === roots[0].id).toArray();
    for (const k of kids) expect(k.depth).toBe(1);
  });

  it('resolves tag references on symptoms', async () => {
    await importTemplate(DEFAULT_TEMPLATE);
    const hitze = await db.symptoms.filter((s) => s.name === 'Hitzewallungen').first();
    const tags = await db.tags.toArray();
    expect(hitze?.tagIds.length).toBeGreaterThan(0);
    for (const tid of hitze!.tagIds) {
      expect(tags.some((t) => t.id === tid)).toBe(true);
    }
  });

  it('imports fields and daily from template', async () => {
    const textField = newField('text');
    await importTemplate({
      tags: [],
      roots: [
        { name: 'Test', icon: 'circle', color: '#000',
          fields: [textField],
          daily: true }
      ]
    });
    const all = await db.symptoms.toArray();
    expect(all).toHaveLength(1);
    expect(all[0].daily).toBe(true);
    expect(all[0].fields[0].type).toBe('text');
  });

  it('imports Hitzewallungen with fields [slider, number, text]', async () => {
    await importTemplate(DEFAULT_TEMPLATE);
    const all = await db.symptoms.toArray();
    const hitze = all.find((s) => s.name === 'Hitzewallungen')!;
    expect(hitze.fields.map((f) => f.type)).toEqual(['slider', 'number', 'text']);
    expect(hitze.fields.find((f) => f.type === 'number')!.label).toBe('Schübe');
  });
});
