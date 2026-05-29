<script lang="ts">
  import type { Snippet } from 'svelte';
  import { X } from '@lucide/svelte';
  type Props = {
    open: boolean;
    title?: string;
    onClose?: () => void;
    /** Render an X button in the top-right of the sheet. On by default —
        backdrop-tap and Esc alone proved too hidden on mobile. Opt out via
        closeButton={false} for tiny confirmation dialogs that already have a
        prominent Cancel button. */
    closeButton?: boolean;
    children: Snippet;
    /** Optional sticky action bar at the bottom of the sheet. Rendered outside
        the scrollable body so primary actions (Save, Confirm) stay visible
        even in tall modals. */
    footer?: Snippet;
  };
  let { open, title, onClose, closeButton = true, children, footer }: Props = $props();

  function close() { onClose?.(); }

  // Track whether the pointer press started on the backdrop itself. Only then
  // does a release on the backdrop count as a "click outside" — otherwise a
  // drag that started inside (e.g. on the SliderInput's track) and ended on
  // the backdrop would dismiss the dialog.
  let pressedOnBackdrop = false;

  function onBackdropPointerDown(e: PointerEvent) {
    pressedOnBackdrop = e.target === e.currentTarget;
  }
  function onBackdropClick(e: MouseEvent) {
    if (pressedOnBackdrop && e.target === e.currentTarget) close();
    pressedOnBackdrop = false;
  }

  $effect(() => {
    if (!open) return;
    function key(e: KeyboardEvent) { if (e.key === 'Escape') close(); }
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  });
</script>

{#if open}
  <div
    class="backdrop"
    role="presentation"
    onpointerdown={onBackdropPointerDown}
    onclick={onBackdropClick}
  >
    <div class="sheet" role="dialog" aria-modal="true" aria-label={title} tabindex={-1} class:has-footer={!!footer}>
      <div class="handle"></div>
      {#if closeButton}
        <button type="button" class="close" aria-label="Schliessen" onclick={close}>
          <X size={20} />
        </button>
      {/if}
      {#if title}<h2 class="title">{title}</h2>{/if}
      <div class="body">{@render children()}</div>
      {#if footer}
        <div class="footer">{@render footer()}</div>
      {/if}
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
    position: relative;
    background: var(--c-surface);
    border-radius: var(--r-4) var(--r-4) 0 0;
    box-shadow: var(--shadow-3);
    width: 100%;
    max-width: 480px;
    padding: var(--sp-4) var(--sp-4) calc(var(--sp-4) + var(--safe-bottom));
    max-height: 90vh;
    overflow-y: auto;
  }
  /* With a sticky footer the scroll context must move from the sheet to the
     body — otherwise the footer scrolls along with the content and the whole
     point (keeping the primary action in view) is lost. */
  .sheet.has-footer {
    display: flex;
    flex-direction: column;
    overflow: hidden;
    padding-bottom: 0;
  }
  .sheet.has-footer .body { flex: 1; overflow-y: auto; min-height: 0; }
  .sheet.has-footer .footer {
    border-top: 1px solid var(--c-border);
    background: var(--c-surface);
    padding: var(--sp-3) var(--sp-4) calc(var(--sp-3) + var(--safe-bottom));
    flex-shrink: 0;
    display: flex;
    gap: var(--sp-2);
  }
  /* Buttons in the action bar share the row equally — one button = full width,
     two = 50/50, three = thirds. Callers that need a fixed-width secondary can
     opt out with `style="flex:none"`. */
  .sheet.has-footer .footer > :global(button) { flex: 1; }
  .close {
    position: absolute;
    top: var(--sp-3);
    right: var(--sp-3);
    width: 32px; height: 32px;
    display: inline-flex; align-items: center; justify-content: center;
    border: 0; background: none;
    color: var(--c-text-dim);
    cursor: pointer;
    padding: 0;
    border-radius: 50%;
  }
  .close:hover { color: var(--c-text); background: var(--c-surface-2); }
  .handle {
    width: 36px; height: 4px; background: var(--c-border-strong);
    border-radius: 2px; margin: 0 auto var(--sp-3);
  }
  .title {
    margin: 0 0 var(--sp-3);
    font-size: var(--fs-lg); font-weight: var(--fw-bold); text-align: center;
  }
</style>
