<script lang="ts">
  import type { Snippet } from 'svelte';
  type Props = {
    open: boolean;
    title?: string;
    onClose?: () => void;
    children: Snippet;
  };
  let { open, title, onClose, children }: Props = $props();

  function close() { onClose?.(); }

  $effect(() => {
    if (!open) return;
    function key(e: KeyboardEvent) { if (e.key === 'Escape') close(); }
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  });
</script>

{#if open}
  <div class="backdrop" onclick={close} role="presentation">
    <div class="sheet" role="dialog" aria-modal="true" aria-label={title} onclick={(e) => e.stopPropagation()}>
      <div class="handle"></div>
      {#if title}<h2 class="title">{title}</h2>{/if}
      <div class="body">{@render children()}</div>
    </div>
  </div>
{/if}

<style>
  .backdrop {
    position: fixed; inset: 0;
    background: var(--c-overlay);
    display: flex; align-items: flex-end; justify-content: center;
    z-index: 50;
  }
  .sheet {
    background: var(--c-surface);
    border-radius: var(--r-4) var(--r-4) 0 0;
    box-shadow: var(--shadow-3);
    width: 100%;
    max-width: 480px;
    padding: var(--sp-4) var(--sp-4) calc(var(--sp-4) + var(--safe-bottom));
    max-height: 90vh;
    overflow-y: auto;
  }
  .handle {
    width: 36px; height: 4px; background: var(--c-border-strong);
    border-radius: 2px; margin: 0 auto var(--sp-3);
  }
  .title {
    margin: 0 0 var(--sp-3);
    font-size: var(--fs-lg); font-weight: var(--fw-bold); text-align: center;
  }
</style>
