<script lang="ts">
  import Badge from '$lib/components/ui/Badge.svelte';
  import SymptomEditModal from './SymptomEditModal.svelte';
  import { ChevronDown, ChevronRight, Plus, FolderPlus, ArrowUpDown, Check } from '@lucide/svelte';
  import {
    listTree,
    reorderSiblings,
    DEFAULT_COLOR,
    DEFAULT_ICON,
    DEFAULT_FOLDER_ICON,
    type TreeNode
  } from '$lib/db/symptoms';
  import { liveQuery } from '$lib/stores/liveQuery.svelte';
  import { dndzone, type DndEvent } from 'svelte-dnd-action';
  import type { Symptom } from '$lib/db';

  const treeQ = liveQuery(() => listTree(), [] as TreeNode[]);
  $effect(() => () => treeQ.dispose());

  let expanded = $state(new Set<string>());
  let editing = $state<{ symptom: Symptom; isNew: boolean } | null>(null);
  let reorderMode = $state(false);

  function toggle(id: string) {
    if (expanded.has(id)) expanded.delete(id);
    else expanded.add(id);
    expanded = new Set(expanded);
  }

  function startAdd(isFolder: boolean) {
    // Synthetic draft Symptom — never persisted unless the user clicks Anlegen.
    const draft: Symptom = {
      id: '',
      name: '',
      color: DEFAULT_COLOR,
      icon: isFolder ? DEFAULT_FOLDER_ICON : DEFAULT_ICON,
      tagIds: [],
      parentId: null,
      sortIndex: 0,
      depth: 0,
      isFolder,
      archived: false,
      createdAt: 0,
      updatedAt: 0
    };
    editing = { symptom: draft, isNew: true };
  }

  function startEdit(s: Symptom) {
    editing = { symptom: s, isNew: false };
  }

  function handleConsider(_parentId: string | null, _e: CustomEvent<DndEvent<TreeNode>>) {
    // Optimistic UI: dnd-action drives its own internal state during drag.
    // We persist only on finalize. Visual feedback during drag is best-effort in MVP.
  }

  async function handleFinalize(parentId: string | null, e: CustomEvent<DndEvent<TreeNode>>) {
    await reorderSiblings(parentId, e.detail.items.map((i) => i.id));
  }
</script>

<header class="bar">
  <h1>Symptome</h1>
  <div class="actions">
    <button
      type="button"
      class="icon-btn"
      onclick={() => startAdd(false)}
      aria-label="Neues Symptom"
      title="Neues Symptom"
    ><Plus size={20} /></button>
    <button
      type="button"
      class="icon-btn"
      onclick={() => startAdd(true)}
      aria-label="Neuer Ordner"
      title="Neuer Ordner"
    ><FolderPlus size={20} /></button>
    <button
      type="button"
      class="icon-btn {reorderMode ? 'active' : ''}"
      onclick={() => reorderMode = !reorderMode}
      aria-label={reorderMode ? 'Sortier-Modus beenden' : 'Umsortieren'}
      title={reorderMode ? 'Fertig' : 'Umsortieren'}
    >
      {#if reorderMode}<Check size={20} />{:else}<ArrowUpDown size={20} />{/if}
    </button>
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
    <button type="button" class="entry" onclick={() => startEdit(node)}>
      <Badge icon={node.icon} color={node.color} size={28} />
      <span>{node.name}</span>
    </button>
  </li>
  {#if node.isFolder && expanded.has(node.id)}
    {#each node.children as c}{@render renderNode(c, level + 1)}{/each}
  {/if}
{/snippet}

<ul
  class="list"
  use:dndzone={{ items: treeQ.current, flipDurationMs: 0, dragDisabled: !reorderMode, type: 'roots' }}
  onconsider={(e) => handleConsider(null, e as CustomEvent<DndEvent<TreeNode>>)}
  onfinalize={(e) => handleFinalize(null, e as CustomEvent<DndEvent<TreeNode>>)}
>
  {#each treeQ.current as n (n.id)}{@render renderNode(n, 0)}{/each}
  {#if treeQ.current.length === 0}<li class="empty">Noch keine Symptome.</li>{/if}
</ul>

{#if editing}
  <SymptomEditModal
    open={true}
    symptom={editing.symptom}
    isNew={editing.isNew}
    onClose={() => (editing = null)}
  />
{/if}

<style>
  .bar { display: flex; align-items: center; justify-content: space-between; gap: var(--sp-2); padding: var(--sp-4); border-bottom: 1px solid var(--c-border); }
  .bar h1 { margin: 0; font-size: var(--fs-lg); min-width: 0; overflow: hidden; text-overflow: ellipsis; }
  .actions { display: flex; gap: var(--sp-1); flex-shrink: 0; }
  .icon-btn {
    width: 40px; height: 40px;
    display: inline-flex; align-items: center; justify-content: center;
    padding: 0;
    border: 1px solid var(--c-border); border-radius: var(--r-2);
    background: var(--c-surface);
    color: var(--c-text);
    cursor: pointer;
  }
  .icon-btn.active { background: var(--c-primary); color: var(--c-primary-contrast); border-color: var(--c-primary); }
  .list { list-style: none; margin: 0; padding: 0; }
  .row { display: flex; align-items: center; gap: var(--sp-2); padding: var(--sp-2); border-bottom: 1px solid var(--c-border); }
  .chev, .chev-spacer { width: 20px; height: 20px; display: inline-flex; align-items: center; justify-content: center; background: none; border: 0; color: var(--c-text-dim); cursor: pointer; }
  .entry { display: flex; align-items: center; gap: var(--sp-3); background: none; border: 0; padding: var(--sp-2); cursor: pointer; flex: 1; text-align: left; }
  .empty { padding: var(--sp-5); text-align: center; color: var(--c-text-dim); }
</style>
