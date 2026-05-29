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

  it('models both as comment-only events (no slider/number), not daily', () => {
    for (const name of ['Start Mens', 'Ende Mens']) {
      const ev = zyklus!.children!.find((c) => c.name === name)!;
      expect(ev.inputs?.comment?.enabled).toBe(true);
      expect(ev.inputs?.slider?.enabled).toBeFalsy();
      expect(ev.inputs?.number?.enabled).toBeFalsy();
      expect(ev.daily ?? false).toBe(false);
    }
  });
});
