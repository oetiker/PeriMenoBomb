<script lang="ts">
  type Props = { value: string; onChange: (color: string) => void };
  let { value, onChange }: Props = $props();

  const PALETTE = [
    '#ef4444','#f97316','#f59e0b','#eab308',
    '#84cc16','#10b981','#06b6d4','#3b82f6',
    '#6366f1','#8b5cf6','#ec4899','#6b7280'
  ];
  let custom = $state(value && !PALETTE.includes(value) ? value : '');

  function pick(c: string) {
    onChange(c);
  }
  function onCustom(e: Event) {
    const v = (e.target as HTMLInputElement).value;
    custom = v;
    onChange(v);
  }
</script>

<div class="grid">
  {#each PALETTE as c}
    <button
      type="button"
      class="swatch {value === c ? 'selected' : ''}"
      data-color={c}
      style="background:{c}"
      aria-label={c}
      onclick={() => pick(c)}
    ></button>
  {/each}
  <label class="swatch more" aria-label="Mehr…">
    <input type="color" value={custom || '#000000'} oninput={onCustom} />
    <span>+</span>
  </label>
</div>

<style>
  .grid {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: var(--sp-2);
  }
  .swatch {
    aspect-ratio: 1;
    border-radius: 50%;
    border: 2px solid transparent;
    cursor: pointer;
  }
  .swatch.selected { border-color: var(--c-text); box-shadow: 0 0 0 2px var(--c-surface), 0 0 0 4px var(--c-text); }
  .more {
    background: var(--c-surface-2);
    color: var(--c-text-dim);
    display: flex; align-items: center; justify-content: center;
    position: relative;
    font-size: var(--fs-lg);
    border: 1px dashed var(--c-border-strong);
  }
  .more input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
</style>
