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
  import type { Symptom } from '$lib/db';

  const treeQ = liveQuery(() => listTree(), [] as TreeNode[]);
  $effect(() => () => treeQ.dispose());

  let expanded = $state(new Set<string>());
  let editing = $state<{ symptom: Symptom; isNew: boolean } | null>(null);

  // Local mirror of the tree. Synced from live query when not dragging so
  // reorder visuals don't fight Dexie's notifications during a drag.
  let localTree = $state<TreeNode[]>([]);

  type DragState = {
    id: string;
    parentId: string | null;
    initialIndex: number;
    initialNaturalTop: number;
    rowHeight: number;
    grabOffsetY: number;
    currentY: number;
  };
  let dragState = $state<DragState | null>(null);

  $effect(() => {
    if (!dragState) localTree = treeQ.current;
  });

  const rowRefs = new Map<string, HTMLElement>();
  let listEl: HTMLElement | undefined = $state();

  function rowRef(node: HTMLElement, id: string) {
    rowRefs.set(id, node);
    return {
      update(newId: string) {
        rowRefs.delete(id);
        id = newId;
        rowRefs.set(id, node);
      },
      destroy() { rowRefs.delete(id); }
    };
  }

  function findSiblings(parentId: string | null, tree: TreeNode[] = localTree): TreeNode[] {
    if (parentId === null) return tree;
    for (const n of tree) {
      if (n.id === parentId) return n.children;
      const r = findSiblings(parentId, n.children);
      if (r.length > 0 || n.children.some((c) => c.id === parentId)) return r;
    }
    return [];
  }

  function moveInSiblings(parentId: string | null, from: number, to: number) {
    if (parentId === null) {
      const next = [...localTree];
      const [m] = next.splice(from, 1);
      next.splice(to, 0, m);
      localTree = next;
      return;
    }
    function recur(nodes: TreeNode[]): TreeNode[] {
      return nodes.map((n) => {
        if (n.id === parentId) {
          const kids = [...n.children];
          const [m] = kids.splice(from, 1);
          kids.splice(to, 0, m);
          return { ...n, children: kids };
        }
        if (n.children.length === 0) return n;
        return { ...n, children: recur(n.children) };
      });
    }
    localTree = recur(localTree);
  }

  // We bind pointermove/up to window (not the handle) so the drag survives any
  // DOM reshuffles that happen while items reorder. Pointer capture on a moving
  // element is fragile across browsers; window listeners are bulletproof.
  let activePointerId: number | null = null;

  function startDrag(e: PointerEvent, node: TreeNode, parentId: string | null) {
    e.preventDefault();
    const rowEl = rowRefs.get(node.id);
    if (!rowEl) return;
    const rect = rowEl.getBoundingClientRect();
    const siblings = findSiblings(parentId);
    const idx = siblings.findIndex((s) => s.id === node.id);
    dragState = {
      id: node.id,
      parentId,
      initialIndex: idx,
      initialNaturalTop: rect.top,
      rowHeight: rect.height,
      grabOffsetY: e.clientY - rect.top,
      currentY: e.clientY
    };
    activePointerId = e.pointerId;
    window.addEventListener('pointermove', onDragMove, { passive: false });
    window.addEventListener('pointerup', onDragEnd);
    window.addEventListener('pointercancel', onDragEnd);
  }

  function onDragMove(e: PointerEvent) {
    if (!dragState || e.pointerId !== activePointerId) return;
    e.preventDefault();
    // Clamp Y to the list's vertical bounds so the dragged row can't be flung
    // above the first row or below the last.
    let y = e.clientY;
    if (listEl) {
      const listRect = listEl.getBoundingClientRect();
      const minY = listRect.top + dragState.grabOffsetY;
      const maxY = listRect.bottom - (dragState.rowHeight - dragState.grabOffsetY);
      if (y < minY) y = minY;
      else if (y > maxY) y = maxY;
    }
    dragState.currentY = y;
    reorderIfNeeded();
  }

  function onDragEnd(e: PointerEvent) {
    if (e.pointerId !== activePointerId) return;
    void endDrag();
  }

  function reorderIfNeeded() {
    const ds = dragState;
    if (!ds) return;
    const siblings = findSiblings(ds.parentId);
    const currentIdx = siblings.findIndex((s) => s.id === ds.id);
    if (currentIdx < 0) return;

    // Count siblings (other than the dragged one) whose midpoint is above the cursor.
    // That count is the index we want the dragged item to occupy.
    let newIdx = 0;
    for (const sib of siblings) {
      if (sib.id === ds.id) continue;
      const el = rowRefs.get(sib.id);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (ds.currentY > r.top + r.height / 2) newIdx++;
    }
    if (newIdx !== currentIdx) moveInSiblings(ds.parentId, currentIdx, newIdx);
  }

  async function endDrag() {
    window.removeEventListener('pointermove', onDragMove);
    window.removeEventListener('pointerup', onDragEnd);
    window.removeEventListener('pointercancel', onDragEnd);
    activePointerId = null;
    if (!dragState) return;
    const finished = dragState;
    dragState = null;
    const siblings = findSiblings(finished.parentId);
    if (siblings.length > 0) {
      await reorderSiblings(finished.parentId, siblings.map((s) => s.id));
    }
  }

  function dragTransform(id: string): string {
    if (!dragState || dragState.id !== id) return '';
    const siblings = findSiblings(dragState.parentId);
    const currentIdx = siblings.findIndex((s) => s.id === id);
    if (currentIdx < 0) return '';
    const currentNaturalTop =
      dragState.initialNaturalTop +
      (currentIdx - dragState.initialIndex) * dragState.rowHeight;
    const wantedTop = dragState.currentY - dragState.grabOffsetY;
    const dy = wantedTop - currentNaturalTop;
    return `translateY(${dy}px)`;
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

{#snippet renderNode(node: TreeNode, parentId: string | null, level: number)}
  <li
    class="row"
    class:dragging={dragState?.id === node.id}
    use:rowRef={node.id}
    style:padding-left="calc({level} * var(--sp-4) + var(--sp-2))"
    style:transform={dragTransform(node.id)}
  >
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
      onpointerdown={(e) => startDrag(e, node, parentId)}
    >
      <GripVertical size={20} />
    </span>
  </li>
  {#if node.isFolder && expanded.has(node.id)}
    {#each node.children as c (c.id)}{@render renderNode(c, node.id, level + 1)}{/each}
  {/if}
{/snippet}

<ul class="list" bind:this={listEl}>
  {#each localTree as n (n.id)}{@render renderNode(n, null, 0)}{/each}
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
    position: relative;
    display: flex; align-items: center; gap: 0;
    padding: var(--sp-2);
    border-bottom: 1px solid var(--c-border);
    background: var(--c-surface);
    will-change: transform;
  }
  .row.dragging {
    z-index: 100;
    background: var(--c-surface-2);
    box-shadow: var(--shadow-2);
    border-radius: var(--r-2);
    cursor: grabbing;
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
