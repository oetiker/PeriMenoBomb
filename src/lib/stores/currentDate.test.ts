import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { currentDate } from './currentDate.svelte';

describe('currentDate', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-27T08:00:00'));
    currentDate.reset();
  });
  afterEach(() => vi.useRealTimers());

  it('defaults to today', () => {
    expect(currentDate.value).toBe('2026-05-27');
  });

  it('next/prev shift by one day', () => {
    currentDate.next();
    expect(currentDate.value).toBe('2026-05-28');
    currentDate.prev();
    currentDate.prev();
    expect(currentDate.value).toBe('2026-05-26');
  });

  it('set accepts a valid key and rejects invalid', () => {
    currentDate.set('2026-01-01');
    expect(currentDate.value).toBe('2026-01-01');
    expect(() => currentDate.set('bad')).toThrow();
  });
});
