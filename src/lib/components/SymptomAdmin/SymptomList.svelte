<script lang="ts">
  import Badge from '$lib/components/ui/Badge.svelte';
  import SymptomEditModal from './SymptomEditModal.svelte';
  import { ChevronDown, ChevronRight, Plus, FolderPlus, GripVertical } from '@lucide/svelte';
  import {
    listTree,
    reorderSiblings,
    DEFAULT_COLOR,
    DEFAULT_ICON,
    DEFAULT_FOLDER_ICON,
    type TreeNode
  } from '$lib/db/symptoms';
  import { liveQuery } from '$lib/stores/liveQuery.svelte';
  import { dndzone, type DndEvent, SOURCES, TRIGGERS } from 'svelte-dnd-action';
  import type { Symptom } from '$lib/db';

  const treeQ = liveQuery(() => listTree(), [] as TreeNode[]);
  $effect(() => () => treeQ.dispose());

  let expanded = $state(new Set<string>());
  let editing = $state<{ symptom: Symptom; isNew: boolean } | null>(null);

  // Local mirror of the tree — required so svelte-dnd-action can update visuals
  // during drag. Synced from the live query when no drag is in progress.
  let localTree = $state<TreeNode[]>([]);
  let isDragging = $state(false);
  $effect(() => {
    if (!isDragging) localTree = treeQ.current;
  });

  // Drag is disabled by default and only enabled while a drag handle is held.
  // This is svelte-dnd-action's documented pattern for handle-only drag: flip
  // `dragDisabled` in pointerdown on the handle, flip it back in dragend/finalize.
  let dndDisabled = $state(true);

  function armDrag() {
    dndDisabled = false;
    const release = () => {
      if (!isDragging) dndDisabled = true;
      document.removeEventListener('pointerup', release);
      document.removeEventListener('pointercancel', release);
    };
    document.addEventListener('pointerup', release, { once: true });
    document.addEventListener('pointercancel', release, { once: true });
  }

  function toggle(id: string) {
    if (expanded.has(id)) expanded.delete(id);
    else expanded.add(id);
    expanded = new Set(expanded);
  }

  function startAdd(isFolder: boolean) {
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

  function handleConsider(e: CustomEvent<DndEvent<TreeNode>>) {
    if (e.detail.info.trigger === TRIGGERS.DRAG_STARTED) isDragging = true;
    localTree = e.detail.items;
  }

  async function handleFinalize(e: CustomEvent<DndEvent<TreeNode>>) {
    localTree = e.detail.items;
    isDragging = false;
    dndDisabled = true;
    // Only persist if the drop came from this list (not from a foreign zone)
    if (e.detail.info.source === SOURCES.POINTER || e.detail.info.source === SOURCES.KEYBOARD) {
      await reorderSiblings(null, e.detail.items.map((i) => i.id));
    }
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
  </div>
</header>

{#snippet renderNode(node: TreeNode, level: number)}
  <li class="row" style="padding-left: calc({level} * var(--sp-4) + var(--sp-2))">
    {#if node.isFolder}
      <button
        type="button"
        class="chev"
        onclick={() => toggle(node.id)}
        aria-label={expanded.has(node.id) ? 'Zuklappen' : 'Aufklappen'}
        aria-expanded={expanded.has(node.id)}
      >
        {#if expanded.has(node.id)}<ChevronDown size={22} />{:else}<ChevronRight size={22} />{/if}
      </button>
    {:else}
      <span class="chev-spacer" aria-hidden="true"></span>
    {/if}
    <button type="button" class="entry" onclick={() => startEdit(node)}>
      <Badge icon={node.icon} color={node.color} size={28} />
      <span class="entry-name">{node.name}</span>
    </button>
    <span
      class="drag-handle"
      role="button"
      tabindex="0"
      aria-label="Ziehen zum Verschieben"
      title="Ziehen zum Verschieben"
      onpointerdown={armDrag}
    >
      <GripVertical size={20} />
    </span>
  </li>
  {#if node.isFolder && expanded.has(node.id)}
    {#each node.children as c}{@render renderNode(c, level + 1)}{/each}
  {/if}
{/snippet}

<ul
  class="list"
  use:dndzone={{
    items: localTree,
    flipDurationMs: 150,
    dragDisabled: dndDisabled,
    dropTargetStyle: {},
    type: 'roots'
  }}
  onconsider={(e) => handleConsider(e as CustomEvent<DndEvent<TreeNode>>)}
  onfinalize={(e) => handleFinalize(e as CustomEvent<DndEvent<TreeNode>>)}
>
  {#each localTree as n (n.id)}{@render renderNode(n, 0)}{/each}
  {#if localTree.length === 0}<li class="empty">Noch keine Symptome.</li>{/if}
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
  .list { list-style: none; margin: 0; padding: 0; }
  .row {
    display: flex; align-items: center; gap: 0;
    padding: var(--sp-2);
    border-bottom: 1px solid var(--c-border);
    background: var(--c-surface);
  }
  .chev {
    width: 28px; height: 28px;
    display: inline-flex; align-items: center; justify-content: center;
    background: none;
    border: 0;
    color: var(--c-text);
    cursor: pointer;
    flex-shrink: 0;
    padding: 0;
    margin-right: var(--sp-1);
  }
  .chev-spacer { width: 28px; flex-shrink: 0; margin-right: var(--sp-1); }
  .entry {
    display: flex; align-items: center; gap: var(--sp-3);
    background: none; border: 0; padding: var(--sp-2) 0;
    cursor: pointer; flex: 1; text-align: left;
    min-width: 0;
  }
  .entry-name {
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .drag-handle {
    display: inline-flex; align-items: center; justify-content: center;
    width: 36px; height: 36px;
    color: var(--c-text-dim);
    cursor: grab;
    flex-shrink: 0;
    touch-action: none;
    user-select: none;
  }
  .drag-handle:active { cursor: grabbing; color: var(--c-text); }
  .empty { padding: var(--sp-5); text-align: center; color: var(--c-text-dim); }
</style>
