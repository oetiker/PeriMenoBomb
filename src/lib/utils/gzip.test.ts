import { describe, it, expect } from 'vitest';
import { gzip, gunzip, isGzip, encodeText, decodeText } from './gzip';

describe('gzip utility', () => {
  it('round-trips text through gzip/gunzip', async () => {
    const original = JSON.stringify({ hello: 'wörld', n: [1, 2, 3] });
    const compressed = await gzip(encodeText(original));
    expect(decodeText(await gunzip(compressed))).toBe(original);
  });

  it('compressed output carries the gzip magic bytes', async () => {
    const compressed = await gzip(encodeText('aaaaaaaaaaaaaaaaaaaa'));
    expect(isGzip(compressed)).toBe(true);
  });

  it('isGzip is false for plain bytes', () => {
    expect(isGzip(encodeText('{"a":1}'))).toBe(false);
  });
});
