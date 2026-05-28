<script lang="ts">
  import Modal from './Modal.svelte';

  type Props = {
    open: boolean;
    title?: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    danger?: boolean;
    onConfirm: () => void;
    onCancel: () => void;
  };

  let {
    open,
    title,
    message,
    confirmLabel = 'OK',
    cancelLabel = 'Abbrechen',
    danger = false,
    onConfirm,
    onCancel
  }: Props = $props();
</script>

<Modal {open} {title} onClose={onCancel}>
  <p class="message">{message}</p>
  <div class="actions">
    <button type="button" class="secondary" onclick={onCancel}>{cancelLabel}</button>
    <button
      type="button"
      class="primary {danger ? 'danger' : ''}"
      onclick={onConfirm}
    >{confirmLabel}</button>
  </div>
</Modal>

<style>
  .message {
    margin: 0 0 var(--sp-4);
    line-height: 1.4;
  }
  .actions {
    display: flex;
    gap: var(--sp-2);
  }
  .primary,
  .secondary {
    flex: 1;
    padding: var(--sp-3);
    border-radius: var(--r-2);
    cursor: pointer;
    font-weight: var(--fw-bold);
  }
  .primary {
    background: var(--c-primary);
    color: var(--c-primary-contrast);
    border: 0;
  }
  .primary.danger {
    background: var(--c-danger);
  }
  .secondary {
    background: var(--c-surface-2);
    color: var(--c-text);
    border: 1px solid var(--c-border);
    font-weight: var(--fw-normal);
  }
</style>
