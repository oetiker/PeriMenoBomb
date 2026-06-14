<script lang="ts">
  import type { Snippet } from 'svelte';
  import { Trash2 } from '@lucide/svelte';

  type Props = {
    threshold?: number;
    onSwipe: () => void;
    children: Snippet;
  };
  let { threshold = 80, onSwipe, children }: Props = $props();

  // Pointer-based so the same gesture works for touch (iOS) and mouse. We lock
  // to an axis after a small move: horizontal → we own it (swipe-to-delete),
  // vertical → we yield so the page can scroll (touch-action: pan-y).
  let dx = $state(0);
  let dragging = false;
  let startX = 0;
  let startY = 0;
  let axis: 'none' | 'horizontal' | 'vertical' = 'none';
  let pointerId: number | null = null;
  // Set once a real horizontal drag happened, so the click it would otherwise
  // synthesise (opening the row) is swallowed.
  let swiped = false;

  const SLOP = 8;

  function down(e: PointerEvent) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    startX = e.clientX;
    startY = e.clientY;
    axis = 'none';
    dragging = true;
    pointerId = e.pointerId;
    swiped = false;
  }
  function move(e: PointerEvent) {
    if (!dragging || e.pointerId !== pointerId) return;
    const ddx = e.clientX - startX;
    const ddy = e.clientY - startY;
    if (axis === 'none') {
      if (Math.abs(ddx) < SLOP && Math.abs(ddy) < SLOP) return;
      axis = Math.abs(ddx) > Math.abs(ddy) ? 'horizontal' : 'vertical';
      if (axis === 'horizontal') {
        const el = e.currentTarget as HTMLElement;
        el.setPointerCapture?.(e.pointerId);
      }
    }
    if (axis !== 'horizontal') return; // vertical: let the page scroll
    e.preventDefault();
    dx = Math.min(0, ddx);
    if (-dx > SLOP) swiped = true;
  }
  function up(e: PointerEvent) {
    if (e.pointerId !== pointerId) return;
    dragging = false;
    pointerId = null;
    const fire = axis === 'horizontal' && -dx >= threshold;
    dx = 0;
    axis = 'none';
    if (fire) onSwipe();
  }
  function clickCapture(e: MouseEvent) {
    if (swiped) {
      e.stopPropagation();
      e.preventDefault();
      swiped = false;
    }
  }
</script>

<div class="swipe-wrap">
  <div class="delete-bar" aria-hidden="true" style="opacity:{Math.min(1, -dx / threshold)}">
    <Trash2 size={20} />
  </div>
  <div
    class="swipe-row"
    role="presentation"
    onpointerdown={down}
    onpointermove={move}
    onpointerup={up}
    onpointercancel={up}
    onclickcapture={clickCapture}
    style="transform: translateX({dx}px);"
  >
    {@render children()}
  </div>
</div>

<style>
  .swipe-wrap { position: relative; }
  .delete-bar {
    position: absolute;
    inset: 0;
    display: flex; align-items: center; justify-content: flex-end;
    padding-right: var(--sp-4);
    background: var(--c-danger);
    color: #fff;
    border-radius: var(--r-2);
    pointer-events: none;
  }
  .swipe-row {
    position: relative;
    transition: transform 80ms ease-out;
    will-change: transform;
    touch-action: pan-y;
  }
</style>
