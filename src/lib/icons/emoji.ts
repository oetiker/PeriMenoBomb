// Symptom icons are stored as raw emoji glyphs (any Unicode that fits in a few
// code units). System fonts render them, so we don't ship icon assets and users
// see what they already know from their keyboard. Folders default to 📁,
// leaves default to ⚪ so a missing pick is always recognisable as "unset".

export const DEFAULT_SYMPTOM_EMOJI = '⚪';
export const DEFAULT_FOLDER_EMOJI = '📁';

// Curated quick-pick set with German captions. Keep ordered by vague theme —
// body, mood, sleep, food/drugs, weather/cycle, misc — and keep the captions
// short (one-word ideal) so they fit next to the badge in tight rows.
export const SUGGESTED_EMOJIS: Array<{ glyph: string; name: string }> = [
  { glyph: '🔥',  name: 'Feuer' },
  { glyph: '🌡️', name: 'Thermometer' },
  { glyph: '💧',  name: 'Wassertropfen' },
  { glyph: '💦',  name: 'Schweisstropfen' },
  { glyph: '🩸',  name: 'Bluttropfen' },
  { glyph: '💓',  name: 'Herzschlag' },
  { glyph: '❤️',  name: 'Herz' },
  { glyph: '🧠',  name: 'Gehirn' },
  { glyph: '🦴',  name: 'Knochen' },
  { glyph: '🫀',  name: 'Anatomisches Herz' },
  { glyph: '🤕',  name: 'Verletzter Kopf' },
  { glyph: '🤒',  name: 'Krank' },
  { glyph: '🤧',  name: 'Niesen' },
  { glyph: '😵',  name: 'Schwindel' },
  { glyph: '🥵',  name: 'Hitze' },
  { glyph: '🥶',  name: 'Kälte' },
  { glyph: '🫥',  name: 'Gepunktetes Gesicht' },
  { glyph: '🤢',  name: 'Übelkeit' },
  { glyph: '💆',  name: 'Massage' },
  { glyph: '👁️', name: 'Auge' },
  { glyph: '😊',  name: 'Lächeln' },
  { glyph: '😐',  name: 'Neutral' },
  { glyph: '🙁',  name: 'Traurig' },
  { glyph: '😢',  name: 'Weinen' },
  { glyph: '😡',  name: 'Wut' },
  { glyph: '😨',  name: 'Angst' },
  { glyph: '😴',  name: 'Schlaf' },
  { glyph: '🥱',  name: 'Gähnen' },
  { glyph: '✨',  name: 'Glitzer' },
  { glyph: '🌙',  name: 'Mond' },
  { glyph: '☀️',  name: 'Sonne' },
  { glyph: '☁️',  name: 'Wolke' },
  { glyph: '🌧️', name: 'Regen' },
  { glyph: '⚡',  name: 'Blitz' },
  { glyph: '🌪️', name: 'Tornado' },
  { glyph: '🏃',  name: 'Läufer' },
  { glyph: '🛏️', name: 'Bett' },
  { glyph: '💊',  name: 'Pille' },
  { glyph: '🩹',  name: 'Pflaster' },
  { glyph: '☕',  name: 'Kaffee' },
  { glyph: '🍴',  name: 'Besteck' },
  { glyph: '🥤',  name: 'Becher' },
  { glyph: '🍷',  name: 'Wein' },
  { glyph: '🍫',  name: 'Schokolade' },
  { glyph: '🌸',  name: 'Kirschblüte' },
  { glyph: '🍃',  name: 'Blatt' },
  { glyph: '🪶',  name: 'Feder' },
  { glyph: '⚠️',  name: 'Warnung' },
  { glyph: '📅',  name: 'Kalender' },
  { glyph: '📝',  name: 'Notiz' },
  { glyph: '🌫️', name: 'Nebel' },
  { glyph: '⚪',  name: 'Unspezifisch' },
  { glyph: '📁',  name: 'Ordner' }
];

const EMOJI_NAME_BY_GLYPH = new Map(SUGGESTED_EMOJIS.map((e) => [e.glyph, e.name]));

/** Returns the curated German caption for a known emoji, or undefined for
    user-picked glyphs we don't have a name for. */
export function emojiName(glyph: string): string | undefined {
  return EMOJI_NAME_BY_GLYPH.get(glyph);
}

// Migration map for the v2 → v3 schema bump. Anything not in this map gets
// the generic ⚪ — better an obviously-unset marker than a wrong-themed glyph.
export const LUCIDE_TO_EMOJI: Record<string, string> = {
  flame:            '🔥',
  thermometer:      '🌡️',
  wind:             '💨',
  'cloud-drizzle':  '🌧️',
  droplet:          '💧',
  'heart-pulse':    '💓',
  heart:            '❤️',
  brain:            '🧠',
  pill:             '💊',
  bandage:          '🩹',
  bed:              '🛏️',
  moon:             '🌙',
  sun:              '☀️',
  cloud:            '☁️',
  'cloud-rain':     '🌧️',
  'cloud-fog':      '🌫️',
  zap:              '⚡',
  activity:         '🏃',
  eye:              '👁️',
  ear:              '👂',
  smile:            '😊',
  meh:              '😐',
  frown:            '🙁',
  angry:            '😡',
  sparkles:         '✨',
  'alert-triangle': '⚠️',
  feather:          '🪶',
  leaf:             '🍃',
  coffee:           '☕',
  utensils:         '🍴',
  circle:           '⚪',
  folder:           '📁',
  'cup-soda':       '🥤'
};

// Conservative emoji-detection: covers the BMP Misc-Symbols/Pictographs blocks
// plus the supplementary planes where most modern emojis live, plus VS-16
// (the FE0F variation selector that turns ambiguous glyphs into emoji).
const EMOJI_RX = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u;
export function looksLikeEmoji(s: string | undefined | null): boolean {
  return !!s && EMOJI_RX.test(s);
}
