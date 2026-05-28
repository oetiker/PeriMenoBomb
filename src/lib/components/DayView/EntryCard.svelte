<script lang="ts">
  import Badge from '$lib/components/ui/Badge.svelte';
  import SwipeRow from '$lib/components/ui/SwipeRow.svelte';
  import { MessageCircle } from '@lucide/svelte';
  import type { Symptom, Entry } from '$lib/db';

  type Props = { entry: Entry; symptom: Symptom; onTap: () => void; onSwipe: () => void };
  let { entry, symptom, onTap, onSwipe }: Props = $props();

  // Transient stub — Task 13 replaces the status line with the new slider/number/comment-aware version.
  const valueLabel = $derived(
    entry.sliderValue !== null ? String(entry.sliderValue) : 'erfasst'
  );
</script>

<SwipeRow {onSwipe}>
  <button type="button" class="card" onclick={onTap}>
    <Badge icon={symptom.icon} color={symptom.color} size={28} />
    <div class="text">
      <div class="name">{symptom.name}</div>
      <div class="meta">
        <span class={`level level-${entry.sliderValue ?? 'none'}`}>{valueLabel}</span>
        {#if entry.comment}<MessageCircle size={14} />{/if}
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
  .text { flex: 1; }
  .name { font-weight: var(--fw-bold); }
  .meta { display: flex; align-items: center; gap: var(--sp-2); font-size: var(--fs-sm); color: var(--c-text-dim); margin-top: 2px; }
</style>
