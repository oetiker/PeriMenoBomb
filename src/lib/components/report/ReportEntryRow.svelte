<script lang="ts">
  import Badge from '$lib/components/ui/Badge.svelte';
  import { base } from '$app/paths';
  import { selectLabelFor } from '$lib/db/entries';
  import type { Entry, Symptom } from '$lib/db';

  type Props = { entry: Entry; symptom: Symptom; tagNames: string[] };
  let { entry, symptom, tagNames }: Props = $props();

  const sliderText = $derived.by(() => {
    if (!symptom.inputs.slider.enabled) return '';
    if (entry.sliderValue === null) return 'unspez';
    const low = symptom.inputs.slider.lowLabel || 'leicht';
    const high = symptom.inputs.slider.highLabel || 'hoch';
    return `${low} ··· ${entry.sliderValue} ··· ${high}`;
  });
  const numberText = $derived.by(() => {
    if (!symptom.inputs.number.enabled || entry.numberValue === null) return '';
    const unit = symptom.inputs.number.unit;
    return unit ? `${entry.numberValue} ${unit}` : String(entry.numberValue);
  });
  const selectText = $derived(selectLabelFor(symptom, entry));
  const showComment = $derived(symptom.inputs.comment.enabled && entry.comment.trim().length > 0);
</script>

<a class="row" href="{base}/day/{entry.date}">
  <Badge icon={symptom.icon} color={symptom.color} duotone={symptom.duotone ?? true} bg={symptom.bg ?? true} size={20} />
  <div class="text">
    <div class="name">{symptom.name}</div>
    <div class="meta">
      {#if sliderText}<span>{sliderText}</span>{/if}
      {#if numberText}<span>{numberText}</span>{/if}
      {#if selectText}<span>{selectText}</span>{/if}
      {#if showComment}<span class="comment">{entry.comment}</span>{/if}
      {#if !sliderText && !numberText && !selectText && !showComment}<span class="empty">erfasst</span>{/if}
    </div>
    {#if tagNames.length}<div class="tags">{#each tagNames as t}<span class="chip">{t}</span>{/each}</div>{/if}
  </div>
</a>

<style>
  .row { display: flex; align-items: flex-start; gap: var(--sp-3); padding: var(--sp-2) var(--sp-3); border: 1px solid var(--c-border); border-radius: var(--r-2); margin-bottom: var(--sp-2); text-decoration: none; color: var(--c-text); background: var(--c-surface); }
  .text { flex: 1; min-width: 0; }
  .name { font-weight: var(--fw-bold); }
  .meta { display: flex; flex-wrap: wrap; gap: var(--sp-2); font-size: var(--fs-sm); color: var(--c-text-dim); margin-top: 2px; }
  .empty { font-style: italic; }
  .tags { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; }
  .chip { font-size: var(--fs-xs); padding: 1px var(--sp-2); background: var(--c-surface-3); border-radius: var(--r-1); color: var(--c-text-dim); }
</style>
