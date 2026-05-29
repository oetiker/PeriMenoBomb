export interface Tick { index: number; pos: number }
export interface ViewState { scale: number; tx: number; ty: number }

export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/** Screen positions of axis-tick cell-centers under translate+scale, culled to
    [0, viewport] and thinned so consecutive shown ticks are >= minSpacingPx
    apart. Drives the fixed gutters: ticks reflow as the plot pans/zooms. */
export function tickPositions(
  count: number,
  cellSize: number,
  scale: number,
  translate: number,
  viewport: number,
  minSpacingPx: number
): Tick[] {
  const ticks: Tick[] = [];
  let lastShown = -Infinity;
  for (let i = 0; i < count; i++) {
    const pos = translate + (i * cellSize + cellSize / 2) * scale;
    if (pos < 0 || pos > viewport) continue;
    if (pos - lastShown < minSpacingPx) continue;
    ticks.push({ index: i, pos });
    lastShown = pos;
  }
  return ticks;
}

/** Keep large content from drifting fully out of the viewport (>= `margin` px
    stays visible on each edge). Content smaller than the viewport is centered. */
export function clampTranslate(
  translate: number,
  scale: number,
  contentSize: number,
  viewport: number,
  margin: number
): number {
  const scaled = contentSize * scale;
  if (scaled <= viewport) return (viewport - scaled) / 2;
  const min = viewport - scaled - margin;
  const max = margin;
  return clamp(translate, min, max);
}

/** Zoom by `factor` around screen focus (fx,fy), clamping scale to [min,max]
    and keeping the content point under the focus stationary. */
export function zoomAt(state: ViewState, factor: number, fx: number, fy: number, minScale: number, maxScale: number): ViewState {
  const ns = clamp(state.scale * factor, minScale, maxScale);
  const k = ns / state.scale;
  return { scale: ns, tx: fx - (fx - state.tx) * k, ty: fy - (fy - state.ty) * k };
}
