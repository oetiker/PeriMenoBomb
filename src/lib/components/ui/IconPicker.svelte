<script lang="ts">
  import { icons as lucideIcons } from '@lucide/svelte';
  import { SUGGESTED_ICONS } from '$lib/icons/suggested';
  import Badge from './Badge.svelte';

  type Props = { value: string; color: string; onChange: (icon: string) => void };
  let { value, color, onChange }: Props = $props();
  let search = $state('');

  function toKebab(pascal: string): string {
    return pascal.replace(/[A-Z]/g, (m, i) => (i === 0 ? '' : '-') + m.toLowerCase());
  }

  const ALL_ICONS = $derived(
    Object.keys(lucideIcons)
      .filter((k) => /^[A-Z][A-Za-z0-9]+$/.test(k) && k !== 'default')
      .map(toKebab)
  );
  const filtered = $derived(
    search.trim()
      ? ALL_ICONS.filter((i) => i.toLowerCase().includes(search.trim().toLowerCase()))
      : []
  );
</script>

<div class="picker">
  <div class="preview">
    <Badge icon={value} {color} size={36} />
    <span class="name">{value}</span>
  </div>

  <input
    class="search"
    type="search"
    bind:value={search}
    placeholder="Suchen…"
    autocapitalize="off"
    autocomplete="off"
  />

  {#if !search}
    <h3 class="section-title">Vorschläge</h3>
    <div class="grid">
      {#each SUGGESTED_ICONS as i}
        <button
          type="button"
          class="icon-tile {value === i ? 'selected' : ''}"
          data-icon={i}
          onclick={() => onChange(i)}
          aria-label={i}
        >
          <Badge icon={i} {color} size={28} />
        </button>
      {/each}
    </div>
  {:else}
    <h3 class="section-title">{filtered.length} Treffer</h3>
    <div class="grid">
      {#each filtered.slice(0, 120) as i}
        <button
          type="button"
          class="icon-tile {value === i ? 'selected' : ''}"
          data-icon={i}
          onclick={() => onChange(i)}
          aria-label={i}
        >
          <Badge icon={i} {color} size={28} />
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .picker { display: flex; flex-direction: column; gap: var(--sp-3); }
  .preview { display: flex; align-items: center; gap: var(--sp-3); }
  .name { font-family: ui-monospace, monospace; font-size: var(--fs-sm); color: var(--c-text-dim); }
  .search { padding: var(--sp-3); border: 1px solid var(--c-border); border-radius: var(--r-2); }
  .section-title { margin: 0; font-size: var(--fs-xs); color: var(--c-text-dim); text-transform: uppercase; letter-spacing: 0.05em; }
  .grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: var(--sp-2); }
  .icon-tile { aspect-ratio: 1; border: 1px solid var(--c-border); background: var(--c-surface); border-radius: var(--r-2); display: flex; align-items: center; justify-content: center; cursor: pointer; padding: 0; }
  .icon-tile.selected { border-color: var(--c-text); border-width: 2px; }
</style>
