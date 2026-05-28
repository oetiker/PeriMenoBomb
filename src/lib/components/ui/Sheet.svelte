<script lang="ts">
  import type { Snippet } from 'svelte';
  type Props = {
    open: boolean;
    title: string;
    canGoBack?: boolean;
    onBack?: () => void;
    onClose: () => void;
    children: Snippet;
  };
  let { open, title, canGoBack = false, onBack, onClose, children }: Props = $props();

  $effect(() => {
    if (!open) return;
    function key(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  });
</script>

{#if open}
  <div
    class="backdrop"
    role="presentation"
    onclick={(e) => { if (e.target === e.currentTarget) onClose(); }}
  >
    <div class="sheet" role="dialog" aria-modal="true" aria-label={title} tabindex={-1}>
      <div class="handle"></div>
      <header>
        {#if canGoBack}
          <button class="back" type="button" onclick={() => onBack?.()}>‹ Zurück</button>
        {:else}<span class="back-spacer"></span>{/if}
        <h2 class="title">{title}</h2>
        <button class="close" type="button" onclick={onClose} aria-label="Schliessen">✕</button>
      </header>
      <div class="body">{@render children()}</div>
    </div>
  </div>
{/if}

<style>
  .backdrop {
    position: fixed; inset: 0;
    background: var(--c-overlay);
    display: flex; align-items: flex-end; justify-content: center;
    z-index: 40;
  }
  .sheet {
    background: var(--c-surface);
    border-radius: var(--r-4) var(--r-4) 0 0;
    box-shadow: var(--shadow-3);
    width: 100%;
    max-width: 480px;
    padding: var(--sp-3) var(--sp-4) calc(var(--sp-4) + var(--safe-bottom));
    max-height: 80vh;
    display: flex; flex-direction: column;
  }
  .handle { width: 36px; height: 4px; background: var(--c-border-strong); border-radius: 2px; margin: 0 auto var(--sp-3); }
  header { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; margin-bottom: var(--sp-2); }
  .back { background: none; border: 0; color: var(--c-text-dim); font-size: var(--fs-sm); justify-self: start; padding: var(--sp-2); cursor: pointer; }
  .back-spacer { display: inline-block; min-width: 60px; }
  .title { margin: 0; font-size: var(--fs-md); font-weight: var(--fw-bold); text-align: center; }
  .close { background: none; border: 0; color: var(--c-text-dim); font-size: 18px; justify-self: end; padding: var(--sp-2); cursor: pointer; }
  .body { overflow-y: auto; flex: 1; }
</style>
