import { describe, it, expect } from 'vitest';
import { hexToRgba } from './color';

describe('hexToRgba', () => {
  it('expands 6-digit hex with alpha', () => {
    expect(hexToRgba('#be123c', 0.5)).toBe('rgba(190, 18, 60, 0.5)');
  });
  it('accepts hex without leading #', () => {
    expect(hexToRgba('10b981', 1)).toBe('rgba(16, 185, 129, 1)');
  });
  it('falls back to black on invalid input', () => {
    expect(hexToRgba('nope', 0.3)).toBe('rgba(0, 0, 0, 0.3)');
  });
});
