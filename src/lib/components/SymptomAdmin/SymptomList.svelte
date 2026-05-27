<script lang="ts">
  import Badge from '$lib/components/ui/Badge.svelte';
  import SymptomEditModal from './SymptomEditModal.svelte';
  import { ChevronDown, ChevronRight, Plus } from '@lucide/svelte';
  import { listTree, createSymptom, type TreeNode } from '$lib/db/symptoms';
  import { liveQuery } from '$lib/stores/liveQuery.svelte';
  import type { Symptom } from '$lib/db';

  const treeQ = liveQuery(() => listTree(), [] as TreeNode[]);
  $effect(() => () => treeQ.dispose());

  let expanded = $state(new Set<string>());
  let editing = $state<Symptom | null>(null);

  function toggle(id: string) {
    if (expanded.has(id)) expanded.delete(id);
    else expanded.add(id);
    expanded = new Set(expanded);
  }

  async function addRoot(isFolder: boolean) {
    const name = prompt(isFolder ? 'Name des neuen Ordners?' : 'Name des neuen Symptoms?');
    if (!name) return;
    await createSymptom({ name, isFolder });
  }
</script>

<header class="bar">
  <h1>Symptome</h1>
  <div class="actions">
    <button type="button" onclick={() => addRoot(false)}><Plus size={16} /> Symptom</button>
    <button type="button" onclick={() => addRoot(true)}><Plus size={16} /> Ordner</button>
  </div>
</header>

{#snippet renderNode(node: TreeNode, level: number)}
  <li class="row" style="padding-left: calc({level} * var(--sp-4) + var(--sp-3))">
    {#if node.isFolder}
      <button type="button" class="chev" onclick={() => toggle(node.id)} aria-label="Aufklappen">
        {#if expanded.has(node.id)}<ChevronDown size={16} />{:else}<ChevronRight size={16} />{/if}
      </button>
    {:else}
      <span class="chev-spacer"></span>
    {/if}
    <button type="button" class="entry" onclick={() => editing = node}>
      <Badge icon={node.icon} color={node.color} size={28} />
      <span>{node.name}</span>
    </button>
  </li>
  {#if node.isFolder && expanded.has(node.id)}
    {#each node.children as c}{@render renderNode(c, level + 1)}{/each}
  {/if}
{/snippet}

<ul class="list">
  {#each treeQ.current as n}{@render renderNode(n, 0)}{/each}
  {#if treeQ.current.length === 0}<li class="empty">Noch keine Symptome.</li>{/if}
</ul>

{#if editing}
  <SymptomEditModal open={true} symptom={editing} onClose={() => editing = null} />
{/if}

<style>
  .bar { display: flex; align-items: center; justify-content: space-between; padding: var(--sp-4); border-bottom: 1px solid var(--c-border); }
  .bar h1 { margin: 0; font-size: var(--fs-lg); }
  .actions { display: flex; gap: var(--sp-2); }
  .actions button { display: inline-flex; align-items: center; gap: 4px; padding: var(--sp-2) var(--sp-3); border: 1px solid var(--c-border); border-radius: var(--r-2); background: var(--c-surface); cursor: pointer; }
  .list { list-style: none; margin: 0; padding: 0; }
  .row { display: flex; align-items: center; gap: var(--sp-2); padding: var(--sp-2); border-bottom: 1px solid var(--c-border); }
  .chev, .chev-spacer { width: 20px; height: 20px; display: inline-flex; align-items: center; justify-content: center; background: none; border: 0; color: var(--c-text-dim); cursor: pointer; }
  .entry { display: flex; align-items: center; gap: var(--sp-3); background: none; border: 0; padding: var(--sp-2); cursor: pointer; flex: 1; text-align: left; }
  .empty { padding: var(--sp-5); text-align: center; color: var(--c-text-dim); }
</style>
