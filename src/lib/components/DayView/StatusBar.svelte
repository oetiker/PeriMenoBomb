<script lang="ts">
  import Badge from '$lib/components/ui/Badge.svelte';
  import { liveQueryEffect } from '$lib/stores/liveQuery.svelte';
  import { daysSinceLastOccurrence, type StatusItem } from '$lib/db/statusBar';
  import type { Symptom } from '$lib/db';

  type Props = {
    date: string;
    items: StatusItem[];
    symptoms: Symptom[];
    onConfigure: () => void;
  };
  let { date, items, symptoms, onConfigure }: Props = $props();

  function symptomFor(id: string): Symptom | undefined {
    return symptoms.find((s) => s.id === id);
  }

  // Counts recompute when the viewed date or the item set changes, and stay
  // live as entries are logged/removed (Dexie tracks the reads inside the query).
  const countsQ = liveQueryEffect<Record<string, number | null>>(
    async () => {
      const out: Record<string, number | null> = {};
      for (const it of items) {
        out[it.id] = await daysSinceLastOccurrence(it.symptomId, date);
      }
      return out;
    },
    {},
    () => [date, items]
  );

  // Manual double-tap detection — dblclick is unreliable on touch, so we compare
  // tap timestamps ourselves. Two taps within 350ms open the config.
  let lastTap = 0;
  function onTap() {
    const now = Date.now();
    if (now - lastTap < 350) {
      lastTap = 0;
      onConfigure();
    } else {
      lastTap = now;
    }
  }
</script>

<div
  class="status-bar"
  role="button"
  tabindex="0"
  aria-label="Statusleiste — doppeltippen zum Einrichten"
  onclick={onTap}
  ondblclick={onConfigure}
  onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onConfigure(); } }}
>
  {#if items.length === 0}
    <span class="empty">Doppeltippen zum Einrichten</span>
  {:else}
    {#each items as item (item.id)}
      {@const sym = symptomFor(item.symptomId)}
      {#if sym}
        {@const count = countsQ.current[item.id]}
        <div class="cell" title={sym.name}>
          <Badge icon={sym.icon} color={sym.color} duotone={sym.duotone ?? true} bg={sym.bg ?? true} size={28} />
          <span class="count">{count === null || count === undefined ? '–' : count}</span>
        </div>
      {/if}
    {/each}
  {/if}
</div>

<style>
  .status-bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--sp-4);
    padding: var(--sp-3) var(--sp-4);
    border-bottom: 1px solid var(--c-border);
    cursor: pointer;
    -webkit-user-select: none;
    user-select: none;
    min-height: 28px;
  }
  .empty { font-size: var(--fs-xs); color: var(--c-text-dim); font-style: italic; }
  .cell { display: flex; align-items: center; gap: var(--sp-2); }
  .count { font-size: var(--fs-lg); font-weight: var(--fw-bold); color: var(--c-text); font-variant-numeric: tabular-nums; }
</style>
