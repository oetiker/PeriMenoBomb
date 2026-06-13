<script lang="ts">
  import { untrack } from 'svelte';
  type Props = {
    value: string;
    onChange: (color: string) => void;
    /** Drop swatch size from ~60px to ~36px so the picker doesn't dominate
        tall modals like the Icon Picker. */
    compact?: boolean;
  };
  let { value, onChange, compact = false }: Props = $props();

  const PALETTE = [
    '#ef4444','#f97316','#f59e0b','#eab308',
    '#84cc16','#10b981','#06b6d4','#3b82f6',
    '#6366f1','#8b5cf6','#ec4899','#6b7280'
  ];

  const isCustom = $derived(!!value && !PALETTE.includes(value.toLowerCase()));

  // Inline HSV picker, revealed by the "+" tile. Starts open when the current
  // value isn't one of the presets so the user lands on their existing colour.
  let showCustom = $state(untrack(() => isCustom));

  // --- colour conversion (no deps — offline-first) ---
  function hexToRgb(hex: string): [number, number, number] {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
    if (!m) return [0, 0, 0];
    const n = parseInt(m[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function rgbToHex(r: number, g: number, b: number): string {
    const h = (x: number) => Math.round(x).toString(16).padStart(2, '0');
    return `#${h(r)}${h(g)}${h(b)}`;
  }
  function rgbToHsv(r: number, g: number, b: number): { h: number; s: number; v: number } {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    let h = 0;
    if (d !== 0) {
      if (max === r) h = ((g - b) / d) % 6;
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
      if (h < 0) h += 360;
    }
    return { h, s: max === 0 ? 0 : d / max, v: max };
  }
  function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
    const c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c;
    let r = 0, g = 0, b = 0;
    if (h < 60) [r, g, b] = [c, x, 0];
    else if (h < 120) [r, g, b] = [x, c, 0];
    else if (h < 180) [r, g, b] = [0, c, x];
    else if (h < 240) [r, g, b] = [0, x, c];
    else if (h < 300) [r, g, b] = [x, 0, c];
    else [r, g, b] = [c, 0, x];
    return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
  }

  // HSV working state. Synced from `value` whenever the prop changes from the
  // outside (preset tap), but our own emits won't fight it because we compare
  // the round-tripped hex first.
  let h = $state(0);
  let s = $state(0);
  let v = $state(0);
  let lastEmitted = '';

  $effect(() => {
    const hex = value;
    if (hex === lastEmitted) return;
    untrack(() => {
      const [r, g, b] = hexToRgb(hex || '#000000');
      const hsv = rgbToHsv(r, g, b);
      h = hsv.h; s = hsv.s; v = hsv.v;
    });
  });

  const hueColor = $derived(rgbToHex(...hsvToRgb(h, 1, 1)));

  function emit() {
    const hex = rgbToHex(...hsvToRgb(h, s, v));
    lastEmitted = hex;
    onChange(hex);
  }

  function pick(c: string) {
    onChange(c);
  }

  function clamp01(x: number) {
    return x < 0 ? 0 : x > 1 ? 1 : x;
  }

  function dragSV(e: PointerEvent) {
    const el = e.currentTarget as HTMLElement;
    const rect = el.getBoundingClientRect();
    s = clamp01((e.clientX - rect.left) / rect.width);
    v = 1 - clamp01((e.clientY - rect.top) / rect.height);
    emit();
  }
  function dragHue(e: PointerEvent) {
    const el = e.currentTarget as HTMLElement;
    const rect = el.getBoundingClientRect();
    h = clamp01((e.clientY - rect.top) / rect.height) * 360;
    emit();
  }

  function startDrag(handler: (e: PointerEvent) => void) {
    return (e: PointerEvent) => {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      handler(e);
    };
  }
  function moveDrag(handler: (e: PointerEvent) => void) {
    return (e: PointerEvent) => {
      // Buttons bitmask: 1 = primary button / active touch.
      if (e.buttons !== 1 && e.pointerType === 'mouse') return;
      handler(e);
    };
  }

  function keySV(e: KeyboardEvent) {
    const step = e.shiftKey ? 0.1 : 0.02;
    if (e.key === 'ArrowLeft') s = clamp01(s - step);
    else if (e.key === 'ArrowRight') s = clamp01(s + step);
    else if (e.key === 'ArrowUp') v = clamp01(v + step);
    else if (e.key === 'ArrowDown') v = clamp01(v - step);
    else return;
    e.preventDefault();
    emit();
  }
  function keyHue(e: KeyboardEvent) {
    const step = e.shiftKey ? 30 : 6;
    if (e.key === 'ArrowUp') h = (h - step + 360) % 360;
    else if (e.key === 'ArrowDown') h = (h + step) % 360;
    else return;
    e.preventDefault();
    emit();
  }
</script>

<div class="grid" class:compact>
  {#each PALETTE as c}
    <button
      type="button"
      class="swatch {value?.toLowerCase() === c ? 'selected' : ''}"
      data-color={c}
      style="background:{c}"
      aria-label={c}
      onclick={() => pick(c)}
    ></button>
  {/each}
  <button
    type="button"
    class="swatch more {isCustom ? 'selected' : ''}"
    style={isCustom ? `background:${value}` : ''}
    aria-label="Eigene Farbe"
    aria-pressed={showCustom}
    onclick={() => (showCustom = !showCustom)}
  >
    <span class:on-color={isCustom}>+</span>
  </button>
</div>

{#if showCustom}
  <div class="hsv">
    <div
      class="sv"
      role="slider"
      tabindex="0"
      aria-label="Sättigung und Helligkeit"
      aria-valuenow={Math.round(s * 100)}
      aria-valuetext="Sättigung {Math.round(s * 100)}%, Helligkeit {Math.round(v * 100)}%"
      style="--hue:{hueColor}"
      onpointerdown={startDrag(dragSV)}
      onpointermove={moveDrag(dragSV)}
      onkeydown={keySV}
    >
      <div class="sv-handle" style="left:{s * 100}%; top:{(1 - v) * 100}%"></div>
    </div>
    <div
      class="hue"
      role="slider"
      tabindex="0"
      aria-label="Farbton"
      aria-valuemin="0"
      aria-valuemax="360"
      aria-valuenow={Math.round(h)}
      onpointerdown={startDrag(dragHue)}
      onpointermove={moveDrag(dragHue)}
      onkeydown={keyHue}
    >
      <div class="hue-handle" style="top:{(h / 360) * 100}%"></div>
    </div>
  </div>
{/if}

<style>
  .grid {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: var(--sp-2);
  }
  .grid.compact {
    grid-template-columns: repeat(auto-fill, minmax(32px, 1fr));
    gap: var(--sp-1);
  }
  .grid.compact .swatch { max-width: 36px; max-height: 36px; }
  .swatch {
    aspect-ratio: 1;
    border-radius: 50%;
    border: 2px solid transparent;
    cursor: pointer;
    padding: 0;
  }
  .swatch.selected { border-color: var(--c-text); box-shadow: 0 0 0 2px var(--c-surface), 0 0 0 4px var(--c-text); }
  .more {
    background: var(--c-surface-2);
    color: var(--c-text-dim);
    display: flex; align-items: center; justify-content: center;
    font-size: var(--fs-lg);
    border: 1px dashed var(--c-border-strong);
  }
  .more .on-color {
    color: #fff;
    text-shadow: 0 0 2px rgba(0,0,0,0.6);
  }

  .hsv {
    display: flex;
    gap: var(--sp-4);
    height: 150px;
    margin-top: var(--sp-3);
    /* Right inset so the hue handle (which overhangs the bar) isn't clipped
       by the modal edge. */
    padding-right: var(--sp-2);
  }
  .sv {
    position: relative;
    flex: 1;
    border-radius: var(--r-2);
    cursor: crosshair;
    touch-action: none;
    background:
      linear-gradient(to top, #000, transparent),
      linear-gradient(to right, #fff, transparent),
      var(--hue);
  }
  .sv-handle {
    position: absolute;
    width: 16px; height: 16px;
    border-radius: 50%;
    border: 2px solid #fff;
    box-shadow: 0 0 0 1px rgba(0,0,0,0.4);
    transform: translate(-50%, -50%);
    pointer-events: none;
  }
  .hue {
    position: relative;
    width: 28px;
    flex-shrink: 0;
    border-radius: var(--r-2);
    cursor: pointer;
    touch-action: none;
    background: linear-gradient(
      to bottom,
      #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%
    );
  }
  .hue-handle {
    position: absolute;
    left: -2px; right: -2px;
    height: 6px;
    border: 2px solid #fff;
    border-radius: var(--r-1);
    box-shadow: 0 0 0 1px rgba(0,0,0,0.4);
    transform: translateY(-50%);
    pointer-events: none;
  }
</style>
