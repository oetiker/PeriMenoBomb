<script lang="ts">
  import type { SelectOption } from '$lib/db';

  type Props = {
    value: string | null;
    options: SelectOption[];
    onChange: (key: string | null) => void;
    /** The field's section label; shown as the prompt option when defined so the
        collapsed select is self-describing. Falls back to a generic prompt. */
    label?: string;
  };
  let { value, options, onChange, label }: Props = $props();

  const promptText = $derived(label?.trim() ? `— ${label} —` : '— bitte wählen —');

  // Live choices: active (non-deleted) options.
  const active = $derived(options.filter((o) => !o.deleted));
  // The currently stored choice, if any. A soft-deleted option still resolves
  // here so the user sees what was recorded even though it's no longer offered.
  const current = $derived(value === null ? undefined : options.find((o) => o.key === value));
  const staleSelected = $derived(!!current && !!current.deleted);
  const unknownSelected = $derived(value !== null && !current);

  function onInput(e: Event) {
    const v = (e.target as HTMLSelectElement).value;
    onChange(v === '' ? null : v);
  }
</script>

<div class="select-input">
  <select value={value ?? ''} oninput={onInput} aria-label="Auswahl">
    <option value="">{promptText}</option>
    {#each active as o (o.key)}
      <option value={o.key}>{o.label || '(ohne Name)'}</option>
    {/each}
    {#if staleSelected && current}
      <!-- Keep the recorded-but-deleted choice selectable so it isn't silently
           lost; clearly marked so the user knows it's no longer a live option. -->
      <option value={current.key}>{current.label || '(ohne Name)'} (gelöscht)</option>
    {/if}
    {#if unknownSelected && value}
      <option value={value}>(unbekannte Auswahl)</option>
    {/if}
  </select>
</div>

<style>
  .select-input { display: flex; }
  select {
    width: 100%;
    padding: var(--sp-3);
    border: 1px solid var(--c-border);
    border-radius: var(--r-2);
    background: var(--c-surface);
    font-size: var(--fs-md);
  }
</style>
