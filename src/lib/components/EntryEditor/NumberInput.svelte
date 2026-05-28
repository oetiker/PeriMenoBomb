<script lang="ts">
  type Props = {
    value: number | null;
    unit: string;
    integer: boolean;
    onChange: (v: number | null) => void;
  };
  let { value, unit, integer, onChange }: Props = $props();

  function onInput(e: Event) {
    const raw = (e.target as HTMLInputElement).value.trim();
    if (raw === '') { onChange(null); return; }
    const parsed = integer ? parseInt(raw, 10) : parseFloat(raw.replace(',', '.'));
    if (Number.isFinite(parsed)) onChange(parsed);
    else onChange(null);
  }
</script>

<div class="number-input">
  <input
    type="number"
    inputmode={integer ? 'numeric' : 'decimal'}
    step={integer ? 1 : 'any'}
    value={value ?? ''}
    oninput={onInput}
  />
  <span class="unit">{unit || 'Einheit'}</span>
</div>

<style>
  .number-input { display: flex; align-items: baseline; gap: var(--sp-2); }
  input {
    width: 6em;
    padding: var(--sp-2) var(--sp-3);
    border: 1px solid var(--c-border);
    border-radius: var(--r-2);
    text-align: right;
    font-size: var(--fs-md);
  }
  .unit { color: var(--c-text); font-size: var(--fs-sm); }
</style>
