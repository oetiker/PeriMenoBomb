<script lang="ts">
  import Badge from '$lib/components/ui/Badge.svelte';
  import type { Symptom } from '$lib/db';

  type Props = { symptom: Symptom; onTap: () => void };
  let { symptom, onTap }: Props = $props();
</script>

<button type="button" class="card" data-muted="true" onclick={onTap}>
  <div class="badge-wrap"><Badge icon={symptom.icon} color={symptom.color} size={28} /></div>
  <div class="text">
    <div class="name">{symptom.name}</div>
    <div class="hint">noch nicht erfasst</div>
  </div>
</button>

<style>
  .card {
    display: flex; align-items: center; gap: var(--sp-3);
    width: 100%; padding: var(--sp-3) var(--sp-4);
    background: var(--c-surface);
    border: 1px dashed var(--c-border);
    border-radius: var(--r-2);
    margin-bottom: var(--sp-2);
    cursor: pointer; text-align: left;
  }
  .badge-wrap :global(*) { opacity: 0.5; }
  .text { flex: 1; min-width: 0; }
  .name { font-weight: var(--fw-medium); color: var(--c-text-dim); }
  .hint { font-size: var(--fs-sm); color: var(--c-text-dim); font-style: italic; }
</style>
