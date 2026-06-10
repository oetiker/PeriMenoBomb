<script lang="ts">
  type Props = {
    value: number | null;
    lowLabel: string;
    highLabel: string;
    onChange: (v: number | null) => void;
    // Granularity of the continuous zone. 1 = stepless (every integer 1..100).
    // Larger values snap the thumb to multiples of `step` within [step, 100].
    step?: number;
  };
  let { value, lowLabel, highLabel, onChange, step = 1 }: Props = $props();

  // Snap a raw 1..100 position to the configured granularity. step <= 1 keeps
  // the historical free behaviour. Otherwise: nearest multiple of step, with
  // the lowest stop at `step` and the highest at 100.
  function snap(pos: number): number {
    if (step <= 1) return pos;
    const s = Math.round(pos / step) * step;
    return Math.max(step, Math.min(100, s));
  }

  // Tick fractions (0..1 across the continuous track) for each reachable stop,
  // so users see the slider only stops at these positions. Empty when stepless.
  // Uses the same (v-1)/99 transform as the thumb.
  const ticks = $derived.by<number[]>(() => {
    if (step <= 1) return [];
    const out: number[] = [];
    for (let v = step; v <= 100; v += step) out.push((v - 1) / 99);
    return out;
  });

  // Track layout in track-relative coordinates (px).
  // We compute zones live from each rect to support container resizes.
  const UNSPEZ_PX = 30;
  const GAP_PX = 18;
  const RIGHT_INDENT_PX = 30;

  let trackEl = $state<HTMLElement | undefined>();
  let dragPointerId: number | null = null;

  type Zone = 'unspez' | 'continuous';

  function zoneFromX(rect: DOMRect, clientX: number): { zone: Zone; pos: number | null } {
    const x = clientX - rect.left;
    const unspezEnd = UNSPEZ_PX;
    const contStart = UNSPEZ_PX + GAP_PX;
    if (x < unspezEnd) return { zone: 'unspez', pos: null };
    if (x < contStart) {
      // In the gap → hysteresis: keep current side.
      if (value === null) return { zone: 'unspez', pos: null };
      return { zone: 'continuous', pos: snap(1) };
    }
    const trackWidth = rect.width - contStart - RIGHT_INDENT_PX;
    if (trackWidth <= 0) return { zone: 'continuous', pos: snap(1) };
    const t = Math.max(0, Math.min(1, (x - contStart) / trackWidth));
    const pos = snap(Math.round(1 + t * 99)); // snapped to granularity, 1..100
    return { zone: 'continuous', pos };
  }

  function commit(clientX: number) {
    if (!trackEl) return;
    const rect = trackEl.getBoundingClientRect();
    const { pos } = zoneFromX(rect, clientX);
    onChange(pos);
  }

  function onPointerDown(e: PointerEvent) {
    if (!trackEl) return;
    e.preventDefault();
    dragPointerId = e.pointerId;
    commit(e.clientX);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup',   onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
  }
  function onPointerMove(e: PointerEvent) {
    if (e.pointerId !== dragPointerId) return;
    commit(e.clientX);
  }
  function onPointerUp(e: PointerEvent) {
    if (e.pointerId !== dragPointerId) return;
    dragPointerId = null;
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup',   onPointerUp);
    window.removeEventListener('pointercancel', onPointerUp);
  }

  $effect(() => {
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    };
  });

  // Render position for the thumb. Computed each render; on test environments
  // without layout we still expose the zone via data-attribute for assertions.
  const zone: Zone = $derived(value === null ? 'unspez' : 'continuous');

  function thumbStyle(): string {
    if (!trackEl) {
      // Pre-mount fallback; CSS positions thumb via data-zone too.
      return value === null ? `left: ${UNSPEZ_PX / 2}px;` : 'left: calc(100% - 14px);';
    }
    const rect = trackEl.getBoundingClientRect();
    if (value === null) return `left: ${UNSPEZ_PX / 2}px;`;
    const contStart = UNSPEZ_PX + GAP_PX;
    const trackWidth = rect.width - contStart - RIGHT_INDENT_PX;
    const safeValue = Math.max(1, Math.min(100, value));
    const t = (safeValue - 1) / 99;
    return `left: ${contStart + t * trackWidth}px;`;
  }
</script>

<div class="slider-input">
  <div
    class="track"
    bind:this={trackEl}
    onpointerdown={onPointerDown}
    role="presentation"
    data-track
  >
    <div class="unspez-slot" aria-hidden="true"></div>
    <div class="gap" aria-hidden="true"></div>
    <div class="cont-track" aria-hidden="true">
      {#each ticks as t}<span class="tick" style="left: {t * 100}%"></span>{/each}
    </div>
    <div class="thumb" style={thumbStyle()} data-thumb data-zone={zone}></div>
  </div>
  <div class="labels">
    <span class="unspez-label">unspez</span>
    <span class="spacer"></span>
    <span class="low">{lowLabel || 'linker Endpunkt'}</span>
    <span class="position" data-position>{value ?? '—'}</span>
    <span class="high">{highLabel || 'rechter Endpunkt'}</span>
    <span class="high-spacer"></span>
  </div>
</div>

<style>
  .slider-input { display: flex; flex-direction: column; gap: var(--sp-1); padding: var(--sp-2) 0; }
  .track {
    position: relative;
    height: 32px;
    cursor: pointer;
    touch-action: none;
  }
  .unspez-slot {
    position: absolute; left: 0; top: 14px; width: 30px; height: 4px;
    border-top: 2px dashed var(--c-border-strong);
  }
  .gap {
    position: absolute; left: 30px; top: 14px; width: 18px; height: 4px;
    background: transparent;
  }
  .cont-track {
    position: absolute; left: 48px; right: 30px; top: 14px; height: 4px;
    background: var(--c-border); border-radius: 2px;
  }
  .tick {
    position: absolute; top: -3px; width: 2px; height: 10px;
    margin-left: -1px; border-radius: 1px;
    background: var(--c-border-strong);
  }
  .thumb {
    position: absolute; top: 5.5px; width: 21px; height: 21px;
    margin-left: -10.5px;
    border-radius: 50%; background: var(--c-primary);
    box-shadow: 0 1px 3px rgba(0,0,0,0.2);
    transition: left 50ms ease-out;
  }
  .thumb[data-zone="unspez"] { background: var(--c-text-dim); }
  .labels { display: flex; font-size: var(--fs-xs); color: var(--c-text-dim); }
  .unspez-label { width: 30px; text-align: center; }
  .spacer { width: 18px; }
  .low, .high { flex: 1; }
  .low { text-align: left; padding-left: 4px; }
  .position { text-align: center; min-width: 2.5em; font-variant-numeric: tabular-nums; }
  .high { text-align: right; padding-right: 4px; }
  .high-spacer { width: 30px; }
</style>
