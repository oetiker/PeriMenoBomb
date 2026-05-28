<script lang="ts">
  import { untrack } from 'svelte';
  import Modal from './Modal.svelte';

  type Props = {
    open: boolean;
    title: string;
    label?: string;
    placeholder?: string;
    initialValue?: string;
    submitLabel?: string;
    onSubmit: (value: string) => void;
    onCancel: () => void;
  };

  let {
    open,
    title,
    label,
    placeholder = '',
    initialValue = '',
    submitLabel = 'Speichern',
    onSubmit,
    onCancel
  }: Props = $props();

  let value = $state(untrack(() => initialValue));
  let inputEl: HTMLInputElement | undefined = $state();

  $effect(() => {
    if (open) {
      value = initialValue;
      requestAnimationFrame(() => {
        inputEl?.focus();
        inputEl?.select();
      });
    }
  });

  function submit() {
    const v = value.trim();
    if (!v) return;
    onSubmit(v);
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      submit();
    }
  }
</script>

<Modal {open} {title} onClose={onCancel}>
  {#if label}<div class="lbl">{label}</div>{/if}
  <input
    bind:this={inputEl}
    class="input"
    type="text"
    bind:value
    {placeholder}
    onkeydown={onKey}
  />
  <div class="actions">
    <button type="button" class="secondary" onclick={onCancel}>Abbrechen</button>
    <button type="button" class="primary" onclick={submit}>{submitLabel}</button>
  </div>
</Modal>

<style>
  .lbl {
    font-size: var(--fs-xs);
    color: var(--c-text-dim);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: var(--sp-2);
  }
  .input {
    width: 100%;
    padding: var(--sp-3);
    border: 1px solid var(--c-border);
    border-radius: var(--r-2);
    box-sizing: border-box;
  }
  .actions {
    display: flex;
    gap: var(--sp-2);
    margin-top: var(--sp-4);
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
  .secondary {
    background: var(--c-surface-2);
    color: var(--c-text);
    border: 1px solid var(--c-border);
    font-weight: var(--fw-normal);
  }
</style>
