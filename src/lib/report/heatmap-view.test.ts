import { describe, it, expect } from 'vitest';
import { clamp, tickPositions, clampTranslate, zoomAt } from './heatmap-view';

describe('clamp', () => {
  it('bounds a value', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(11, 0, 10)).toBe(10);
  });
});

describe('tickPositions', () => {
  it('returns cell-center screen positions within the viewport', () => {
    // 4 cells of 10px, scale 1, no translate, viewport 100, minSpacing 0
    const t = tickPositions(4, 10, 1, 0, 100, 0);
    expect(t.map((x) => x.pos)).toEqual([5, 15, 25, 35]);
    expect(t.map((x) => x.index)).toEqual([0, 1, 2, 3]);
  });
  it('culls ticks outside the viewport', () => {
    // translate -25 shifts left; only indices whose center lands in [0,100] survive
    const t = tickPositions(20, 10, 1, -25, 100, 0);
    expect(t[0].pos).toBeGreaterThanOrEqual(0);
    expect(t[t.length - 1].pos).toBeLessThanOrEqual(100);
  });
  it('thins ticks so visible ones respect minSpacing', () => {
    // 10 cells of 10px → centers 5,15,...; minSpacing 25 keeps every 3rd-ish
    const t = tickPositions(10, 10, 1, 0, 200, 25);
    for (let i = 1; i < t.length; i++) expect(t[i].pos - t[i - 1].pos).toBeGreaterThanOrEqual(25);
  });
});

describe('clampTranslate', () => {
  it('centers content smaller than the viewport', () => {
    // content 40px, viewport 100 → centered translate (100-40)/2 = 30
    expect(clampTranslate(999, 1, 40, 100, 40)).toBe(30);
  });
  it('keeps a margin of large content within view', () => {
    // content 1000px, viewport 100, margin 40 → translate clamped to [100-1000-40, 40]
    expect(clampTranslate(9999, 1, 1000, 100, 40)).toBe(40);
    expect(clampTranslate(-9999, 1, 1000, 100, 40)).toBe(100 - 1000 - 40);
  });
});

describe('zoomAt', () => {
  it('keeps the focus point stationary while scaling', () => {
    const s = { scale: 1, tx: 0, ty: 0 };
    const z = zoomAt(s, 2, 50, 50, 0.5, 4);
    expect(z.scale).toBe(2);
    // focus content point under (50,50) stays under (50,50): tx = 50 - (50-0)*2 = -50
    expect(z.tx).toBe(-50);
    expect(z.ty).toBe(-50);
  });
  it('clamps scale to [min,max]', () => {
    expect(zoomAt({ scale: 3, tx: 0, ty: 0 }, 10, 0, 0, 0.5, 4).scale).toBe(4);
    expect(zoomAt({ scale: 1, tx: 0, ty: 0 }, 0.1, 0, 0, 0.5, 4).scale).toBe(0.5);
  });
});
