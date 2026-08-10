<script lang="ts">
  type Props = {
    value: boolean;
    label: string;
    onChange: (v: boolean) => void;
  };
  let { value, label, onChange }: Props = $props();
</script>

<label class="check">
  <input
    type="checkbox"
    checked={value}
    onchange={(e) => onChange((e.currentTarget as HTMLInputElement).checked)}
  />
  <span>{label}</span>
</label>

<style>
  /* Whole row is the tap target: 44px is the iOS minimum for a comfortable
     thumb hit, and this control is meant to be tapped in a hurry. */
  .check {
    display: flex;
    align-items: center;
    gap: var(--sp-3);
    min-height: 44px;
    padding: 0 var(--sp-2);
    border: 1px solid var(--c-border);
    border-radius: var(--r-2);
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }
  .check:active { background: var(--c-surface-2); }
  .check input[type='checkbox'] { width: 20px; height: 20px; flex-shrink: 0; }
  .check span { font-weight: var(--fw-medium); }
</style>
