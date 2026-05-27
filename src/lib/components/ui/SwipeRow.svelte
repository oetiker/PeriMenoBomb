<script lang="ts">
  import type { Snippet } from 'svelte';
  type Props = {
    threshold?: number;
    onSwipe: () => void;
    children: Snippet;
  };
  let { threshold = 80, onSwipe, children }: Props = $props();
  let startX = $state<number | null>(null);
  let dx = $state(0);

  function onStart(e: TouchEvent) {
    startX = e.touches[0].clientX;
    dx = 0;
  }
  function onMove(e: TouchEvent) {
    if (startX === null) return;
    dx = Math.min(0, e.touches[0].clientX - startX);
  }
  function onEnd() {
    if (startX !== null && -dx >= threshold) onSwipe();
    startX = null;
    dx = 0;
  }
</script>

<div
  class="swipe-row"
  ontouchstart={onStart}
  ontouchmove={onMove}
  ontouchend={onEnd}
  style="transform: translateX({dx}px);"
>
  {@render children()}
</div>

<style>
  .swipe-row {
    transition: transform 80ms ease-out;
    will-change: transform;
  }
</style>
