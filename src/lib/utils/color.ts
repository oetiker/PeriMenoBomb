// CSS filter that re-tints a full-color emoji to the chosen hue, producing a
// duotone-style "monochrome in your color" effect. The pipeline collapses the
// glyph to grayscale, lays a sepia base (≈ hue 50°), then rotates onto the
// target hue and pumps saturation back up. Result is consistent across all
// emojis at the cost of losing native colour detail — exactly the trade the
// user opts into via the per-symptom duotone flag.

function parseHex(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i.exec(hex.trim());
  if (!m) return null;
  const h = m[1].length === 3 ? m[1].split('').map((c) => c + c).join('') : m[1];
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16)
  };
}

export function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const rgb = parseHex(hex) ?? { r: 0, g: 0, b: 0 };
  const r = rgb.r / 255, g = rgb.g / 255, b = rgb.b / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)); break;
      case g: h = ((b - r) / d + 2); break;
      case b: h = ((r - g) / d + 4); break;
    }
    h = h * 60;
  }
  return { h, s, l };
}

export function emojiDuotoneFilter(hex: string): string {
  const { h, l } = hexToHsl(hex);
  // sepia anchors the hue near 50°. Rotate the gap to land on the user's hue.
  // Brightness drops slightly for very light targets to keep the glyph readable
  // on a tinted background.
  const rot = Math.round(h - 50);
  const bright = l > 0.6 ? 0.75 : 0.85;
  return `grayscale(1) brightness(${bright}) sepia(1) saturate(12) hue-rotate(${rot}deg)`;
}
