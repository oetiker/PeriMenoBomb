import { describe, it, expect } from 'vitest';
import { DEFAULT_TEMPLATE } from './perimeno-default';

describe('default template — cycle events', () => {
  const zyklus = DEFAULT_TEMPLATE.roots.find((r) => r.name === 'Zyklus');

  it('has a Zyklus root group', () => {
    expect(zyklus).toBeDefined();
    expect(zyklus!.children?.length).toBeGreaterThanOrEqual(2);
  });

  it('contains Start Mens and Ende Mens', () => {
    const names = zyklus!.children!.map((c) => c.name);
    expect(names).toContain('Start Mens');
    expect(names).toContain('Ende Mens');
  });

  it('models both as text-only events (no slider/number), not daily', () => {
    for (const name of ['Start Mens', 'Ende Mens']) {
      const ev = zyklus!.children!.find((c) => c.name === name)!;
      expect(ev.fields).toBeDefined();
      expect(ev.fields!.length).toBe(1);
      expect(ev.fields![0].type).toBe('text');
      expect(ev.fields!.some((f) => f.type === 'slider')).toBe(false);
      expect(ev.fields!.some((f) => f.type === 'number')).toBe(false);
      expect(ev.daily ?? false).toBe(false);
    }
  });
});

describe('default template — Hitzewallungen combined fields', () => {
  const koerperlich = DEFAULT_TEMPLATE.roots.find((r) => r.name === 'Körperlich');
  const hitze = koerperlich?.children?.find((c) => c.name === 'Hitzewallungen');

  it('has Hitzewallungen with slider, number, text in order', () => {
    expect(hitze).toBeDefined();
    expect(hitze!.fields?.map((f) => f.type)).toEqual(['slider', 'number', 'text']);
  });

  it('number field has label Schübe', () => {
    const numField = hitze!.fields?.find((f) => f.type === 'number');
    expect(numField?.label).toBe('Schübe');
  });
});
