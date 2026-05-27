import { describe, it, expect } from 'vitest';
import { newId } from './uuid';

describe('newId', () => {
  it('produces unique ids', () => {
    expect(newId()).not.toBe(newId());
  });
  it('matches UUID v4 shape', () => {
    expect(newId()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});
