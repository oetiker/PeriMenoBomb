import { describe, it, expect } from 'vitest';
import {
  SUGGESTED_EMOJIS,
  LUCIDE_TO_EMOJI,
  looksLikeEmoji,
  emojiName,
  DEFAULT_SYMPTOM_EMOJI,
  DEFAULT_FOLDER_EMOJI
} from './emoji';

describe('SUGGESTED_EMOJIS', () => {
  it('has at least 24 distinct entries', () => {
    expect(SUGGESTED_EMOJIS.length).toBeGreaterThanOrEqual(24);
    const glyphs = SUGGESTED_EMOJIS.map((e) => e.glyph);
    expect(new Set(glyphs).size).toBe(glyphs.length);
  });
  it('every entry has a non-empty German name and an emoji glyph', () => {
    for (const e of SUGGESTED_EMOJIS) {
      expect(looksLikeEmoji(e.glyph)).toBe(true);
      expect(e.name.length).toBeGreaterThan(0);
    }
  });
});

describe('emojiName', () => {
  it('resolves names for curated suggestions', () => {
    expect(emojiName('🔥')).toBe('Feuer');
    expect(emojiName('😴')).toBe('Schlaf');
    expect(emojiName('⚪')).toBe('Unspezifisch');
  });
  it('returns undefined for unknown glyphs', () => {
    expect(emojiName('🌶️')).toBeUndefined();
    expect(emojiName('')).toBeUndefined();
  });
});

describe('looksLikeEmoji', () => {
  it('accepts common emojis', () => {
    for (const e of ['🔥', '😴', '💧', '✨', '❤️', '⚠️', '⚪']) {
      expect(looksLikeEmoji(e)).toBe(true);
    }
  });
  it('rejects plain text', () => {
    for (const s of ['flame', 'heart-pulse', 'circle', '', '   ', 'abc']) {
      expect(looksLikeEmoji(s)).toBe(false);
    }
  });
});

describe('LUCIDE_TO_EMOJI migration map', () => {
  it('covers every legacy icon used in the v2 default template', () => {
    const required = [
      'activity', 'flame', 'cloud-drizzle', 'heart-pulse', 'bandage',
      'brain', 'sparkles', 'heart', 'angry', 'frown', 'alert-triangle',
      'cloud-fog', 'moon', 'bed', 'zap', 'coffee', 'cloud', 'cup-soda',
      'droplet', 'circle', 'folder'
    ];
    for (const r of required) {
      expect(LUCIDE_TO_EMOJI[r], `missing mapping for ${r}`).toBeTruthy();
      expect(looksLikeEmoji(LUCIDE_TO_EMOJI[r])).toBe(true);
    }
  });
  it('defaults are emojis', () => {
    expect(looksLikeEmoji(DEFAULT_SYMPTOM_EMOJI)).toBe(true);
    expect(looksLikeEmoji(DEFAULT_FOLDER_EMOJI)).toBe(true);
  });
});
