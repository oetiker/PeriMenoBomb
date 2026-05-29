<script lang="ts">
  import Badge from '$lib/components/ui/Badge.svelte';
  import SwipeRow from '$lib/components/ui/SwipeRow.svelte';
  import { MessageCircle } from '@lucide/svelte';
  import type { Symptom, Entry } from '$lib/db';

  type Props = { entry: Entry; symptom: Symptom; onTap: () => void; onSwipe: () => void };
  let { entry, symptom, onTap, onSwipe }: Props = $props();

  const sliderText = $derived.by(() => {
    if (!symptom.inputs.slider.enabled) return '';
    if (entry.sliderValue === null) return 'unspezifisch';
    const low = symptom.inputs.slider.lowLabel || 'leicht';
    const high = symptom.inputs.slider.highLabel || 'hoch';
    return `${low} ··· ${entry.sliderValue} ··· ${high}`;
  });

  const numberText = $derived.by(() => {
    if (!symptom.inputs.number.enabled || entry.numberValue === null) return '';
    const unit = symptom.inputs.number.unit;
    return unit ? `${entry.numberValue} ${unit}` : String(entry.numberValue);
  });

  const showComment = $derived(symptom.inputs.comment.enabled && entry.comment.trim().length > 0);
</script>

<SwipeRow {onSwipe}>
  <button type="button" class="card" onclick={onTap}>
    <Badge icon={symptom.icon} color={symptom.color} duotone={symptom.duotone ?? true} bg={symptom.bg ?? true} size={28} />
    <div class="text">
      <div class="name">{symptom.name}</div>
      <div class="meta">
        {#if sliderText}<span class="slider">{sliderText}</span>{/if}
        {#if numberText}<span class="number">{numberText}</span>{/if}
        {#if showComment}<MessageCircle size={14} />{/if}
        {#if !sliderText && !numberText && !showComment}<span class="empty">erfasst</span>{/if}
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
</style>
