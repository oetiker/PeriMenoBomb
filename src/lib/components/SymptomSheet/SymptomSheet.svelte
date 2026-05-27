<script lang="ts">
  import Sheet from '$lib/components/ui/Sheet.svelte';
  import Badge from '$lib/components/ui/Badge.svelte';
  import { ChevronRight, Plus, Check } from '@lucide/svelte';
  import { liveQuery } from '$lib/stores/liveQuery.svelte';
  import { db, type Symptom } from '$lib/db';

  type Props = {
    open: boolean;
    onClose: () => void;
    onPick: (symptomId: string) => void;
    enteredIds?: Set<string>;
  };
  let { open, onClose, onPick, enteredIds = new Set() }: Props = $props();

  let stack = $state<{ parentId: string | null; title: string }[]>([{ parentId: null, title: 'Symptom auswählen' }]);
  const current = $derived(stack[stack.length - 1]);

  const allQ = liveQuery(() => db.symptoms.filter((s) => !s.archived).toArray(), [] as Symptom[]);
  const rows = $derived(
    allQ.current.filter((s) => s.parentId === current.parentId).sort((a, b) => a.sortIndex - b.sortIndex)
  );

  function reset() { stack = [{ parentId: null, title: 'Symptom auswählen' }]; }

  $effect(() => { if (!open) reset(); });
  $effect(() => () => allQ.dispose());

  function drill(s: Symptom) {
    stack = [...stack, { parentId: s.id, title: s.name }];
  }
  function back() { if (stack.length > 1) stack = stack.slice(0, -1); }
  function pick(s: Symptom) { onPick(s.id); }
</script>

<Sheet {open} title={current.title} canGoBack={stack.length > 1} onBack={back} {onClose}>
  {#if rows.length === 0}
    <p class="empty">Keine Symptome vorhanden.</p>
  {/if}
  <ul class="list">
    {#each rows as s}
      <li>
        <button
          type="button"
          class="row {s.isFolder ? 'folder' : 'symptom'}"
          onclick={() => s.isFolder ? drill(s) : pick(s)}
        >
          <Badge icon={s.icon} color={s.color} size={28} />
          <span class="name">{s.name}</span>
          {#if enteredIds.has(s.id) && !s.isFolder}
            <span class="chip">erfasst</span>
          {/if}
          {#if s.isFolder}
            <ChevronRight size={18} />
          {:else if enteredIds.has(s.id)}
            <Check size={18} />
          {:else}
            <Plus size={18} />
          {/if}
        </button>
      </li>
    {/each}
  </ul>
</Sheet>

<style>
  .list { list-style: none; padding: 0; margin: 0; }
  .row {
    display: flex; align-items: center; gap: var(--sp-3);
    width: 100%; padding: var(--sp-3) var(--sp-2);
    border: 0; background: transparent; cursor: pointer;
    border-bottom: 1px solid var(--c-border);
  }
  .name { flex: 1; text-align: left; font-size: var(--fs-md); }
  .chip { font-size: var(--fs-xs); padding: 2px var(--sp-2); background: var(--c-surface-3); border-radius: var(--r-1); color: var(--c-text-dim); }
  .empty { text-align: center; color: var(--c-text-dim); padding: var(--sp-5); }
</style>
