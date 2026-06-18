<script lang="ts">
  import Badge from '$lib/components/ui/Badge.svelte';
  import SwipeRow from '$lib/components/ui/SwipeRow.svelte';
  import { MessageCircle, Flame } from '@lucide/svelte';
  import { entryFieldDisplays } from '$lib/db/fields';
  import type { Symptom, Entry } from '$lib/db';

  type Props = { entry: Entry; symptom: Symptom; streak?: number; onTap: () => void; onSwipe: () => void };
  let { entry, symptom, streak = 1, onTap, onSwipe }: Props = $props();

  const displays = $derived(entryFieldDisplays(symptom, entry));
  const valueDisplays = $derived(displays.filter((d) => d.field.type !== 'text'));
  const hasComment = $derived(displays.some((d) => d.field.type === 'text'));
</script>

<SwipeRow {onSwipe}>
  <button type="button" class="card" onclick={onTap}>
    <Badge icon={symptom.icon} color={symptom.color} duotone={symptom.duotone ?? true} bg={symptom.bg ?? true} size={28} />
    <div class="text">
      <div class="name">{symptom.name}</div>
      <div class="meta">
        {#each valueDisplays as d (d.field.id)}<span>{d.text}</span>{/each}
        {#if hasComment}<MessageCircle size={14} />{/if}
        {#if valueDisplays.length === 0 && !hasComment}<span class="empty">erfasst</span>{/if}
        {#if streak >= 2}
          <span class="streak" title="{streak} Tage in Folge erfasst"><Flame size={13} />{streak}</span>
        {/if}
      </div>
    </div>
  </button>
</SwipeRow>

<style>
  .card {
    display: flex; align-items: center; gap: var(--sp-3);
    width: 100%; padding: var(--sp-3) var(--sp-4);
    background: var(--c-surface);
    border: 1px solid var(--c-border);
    border-radius: var(--r-2);
    margin-bottom: var(--sp-2);
    cursor: pointer; text-align: left;
  }
  .text { flex: 1; min-width: 0; }
  .name { font-weight: var(--fw-bold); }
  .meta { display: flex; flex-wrap: wrap; align-items: center; gap: var(--sp-2); font-size: var(--fs-sm); color: var(--c-text-dim); margin-top: 2px; }
  .empty { font-style: italic; }
  .streak {
    display: inline-flex; align-items: center; gap: 3px;
    color: var(--c-accent, #f97316);
    font-weight: var(--fw-medium);
    font-variant-numeric: tabular-nums;
  }
</style>
