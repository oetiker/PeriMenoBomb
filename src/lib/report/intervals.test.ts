import { describe, it, expect } from 'vitest';
import { computeIntervals, intervalStats } from './intervals';

describe('computeIntervals', () => {
  it('returns gaps between consecutive ascending dates, newest first', () => {
    const dates = ['2026-02-25', '2026-03-20', '2026-04-21', '2026-05-18'];
    expect(computeIntervals(dates)).toEqual([
      { from: '2026-04-21', to: '2026-05-18', days: 27 },
      { from: '2026-03-20', to: '2026-04-21', days: 32 },
      { from: '2026-02-25', to: '2026-03-20', days: 23 }
    ]);
  });

  it('returns empty array for 0 or 1 occurrences', () => {
    expect(computeIntervals([])).toEqual([]);
    expect(computeIntervals(['2026-05-18'])).toEqual([]);
  });
});

describe('intervalStats', () => {
  it('computes avg (rounded), min, max over interval days', () => {
    const intervals = [
      { from: '2026-04-21', to: '2026-05-18', days: 27 },
      { from: '2026-03-20', to: '2026-04-21', days: 32 },
      { from: '2026-02-25', to: '2026-03-20', days: 23 }
    ];
    expect(intervalStats(intervals)).toEqual({ avg: 27, min: 23, max: 32, count: 3 });
  });

  it('returns null stats when there are no intervals', () => {
    expect(intervalStats([])).toEqual({ avg: null, min: null, max: null, count: 0 });
  });
});
