<script lang="ts">
  import Badge from '$lib/components/ui/Badge.svelte';
  import SymptomEditModal from './SymptomEditModal.svelte';
  import { ChevronDown, ChevronRight, Plus, FolderPlus, GripVertical } from '@lucide/svelte';
  import {
    listTree,
    reorderSiblings,
    moveSymptom,
    listArchivedSymptoms,
    unarchiveSymptom,
    DEFAULT_COLOR,
    DEFAULT_ICON,
    DEFAULT_FOLDER_ICON,
    type TreeNode
  } from '$lib/db/symptoms';
  import { liveQuery } from '$lib/stores/liveQuery.svelte';
  import { snackbar } from '$lib/stores/snackbar.svelte';
  import { pendingRestore } from '$lib/stores/openDialog.svelte';
  import { db, type Symptom, defaultSymptomInputs } from '$lib/db';

  const treeQ = liveQuery(() => listTree(), [] as TreeNode[]);
  $effect(() => () => treeQ.dispose());

  const archivedQ = liveQuery(() => listArchivedSymptoms(), [] as Symptom[]);
  $effect(() => () => archivedQ.dispose());
  // All symptoms (including archived) so we can resolve a parent's name even
  // if that parent itself was archived.
  const allSymptomsQ = liveQuery(() => db.symptoms.toArray(), [] as Symptom[]);
  $effect(() => () => allSymptomsQ.dispose());

  let showArchived = $state(false);

  function parentNameOf(s: Symptom): string | null {
    if (!s.parentId) return null;
    const p = allSymptomsQ.current.find((x) => x.id === s.parentId);
    return p?.name ?? null;
  }

  async function restore(s: Symptom) {
    await unarchiveSymptom(s.id);
    snackbar.show({ message: `${s.name} wiederhergestellt` });
  }

  let expanded = $state(new Set<string>());
  let editing = $state<{ symptom: Symptom; isNew: boolean } | null>(null);
  let localTree = $state<TreeNode[]>([]);

  // Cold-Start-Restore: wartet auf den Tree (für bestehende Symptome müssen wir
  // die Node auflösen), konsumiert dann einen evtl. wartenden symptom-edit-
  // Restore und öffnet den Editor mit dem persistierten Payload.
  // Hinweis: Für isNew-Restores wäre der Tree theoretisch nicht nötig; das
  // Warten verzögert den new-Restore um einen Tick, was in der Praxis irrelevant
  // ist, hält die Logik aber einheitlich (ein gemeinsamer Konsum-Pfad).
  $effect.pre(() => {
    if (editing !== null) return;
    if (treeQ.current.length === 0) return;
    const r = pendingRestore.consume('symptom-edit');
    if (!r) return;

    if (r.payload.symptomId) {
      const find = (nodes: TreeNode[]): Symptom | null => {
        for (const n of nodes) {
          if (n.id === r.payload.symptomId) {
            const { children: _c, ...plain } = n;
            return plain as Symptom;
          }
          const sub = find(n.children);
          if (sub) return sub;
        }
        return null;
      };
      const sym = find(treeQ.current);
      if (!sym) return; // archiviert/gelöscht — stillschweigend überspringen
      editing = {
        symptom: {
          ...sym,
          name: r.payload.name,
          color: r.payload.color,
          icon: r.payload.icon,
          tagIds: r.payload.tagIds,
          parentId: r.payload.parentId,
          inputs: r.payload.inputs,
          daily: r.payload.daily
        },
        isNew: false
      };
    } else if (r.payload.isNew) {
      editing = {
        symptom: {
          id: '',
          name: r.payload.name,
          color: r.payload.color,
          icon: r.payload.icon,
          tagIds: r.payload.tagIds,
          parentId: r.payload.parentId,
          sortIndex: 0,
          depth: 0,
          isFolder: r.payload.isFolder,
          archived: false,
          createdAt: 0,
          updatedAt: 0,
          inputs: r.payload.inputs,
          daily: r.payload.daily
        } as Symptom,
        isNew: true
      };
    }
  });

  type DragState = {
    id: string;
    originalParentId: string | null;
    parentId: string | null;
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

  // ─── Tree helpers ──────────────────────────────────────────

  function findNodeById(nodes: TreeNode[], id: string): TreeNode | null {
    for (const n of nodes) {
      if (n.id === id) return n;
      const r = findNodeById(n.children, id);
      if (r) return r;
    }
    return null;
  }

  function isInSubtree(root: TreeNode, id: string): boolean {
    if (root.id === id) return true;
    for (const c of root.children) if (isInSubtree(c, id)) return true;
    return false;
  }

  function findSiblings(parentId: string | null, tree: TreeNode[] = localTree): TreeNode[] {
    if (parentId === null) return tree;
    for (const n of tree) {
      if (n.id === parentId) return n.children;
      if (n.children.length > 0) {
        const r = findSiblings(parentId, n.children);
        if (r.length > 0 || n.children.some((c) => c.id === parentId)) return r;
      }
    }
    return [];
  }

  // Depth-first visible rows, skipping the entire dragged subtree.
  function visibleRowsExcludingDragged(): Array<{ node: TreeNode; parentId: string | null }> {
    const dragId = dragState?.id;
    const out: Array<{ node: TreeNode; parentId: string | null }> = [];
    function recur(nodes: TreeNode[], parentId: string | null) {
      for (const n of nodes) {
        if (n.id === dragId) continue;
        out.push({ node: n, parentId });
        if (n.isFolder && expanded.has(n.id)) recur(n.children, n.id);
      }
    }
    recur(localTree, null);
    return out;
  }

  // Visible index of the dragged item (counting only visible non-dragged rows above it
  // in depth-first order). Used to compute its "natural top" without DOM reads.
  function draggedVisibleIndex(): number {
    if (!dragState) return -1;
    let count = 0;
    let found = false;
    function recur(nodes: TreeNode[]) {
      if (found) return;
      for (const n of nodes) {
        if (n.id === dragState!.id) { found = true; return; }
        count++;
        if (n.isFolder && expanded.has(n.id)) recur(n.children);
        if (found) return;
      }
    }
    recur(localTree);
    return found ? count : -1;
  }

  function nextNonDraggedSiblingOf(nodeId: string, parentId: string | null): TreeNode | null {
    const dragId = dragState?.id;
    const sibs = findSiblings(parentId).filter((s) => s.id !== dragId);
    const idx = sibs.findIndex((s) => s.id === nodeId);
    if (idx < 0 || idx + 1 >= sibs.length) return null;
    return sibs[idx + 1];
  }

  function firstNonDraggedChild(folderId: string): TreeNode | null {
    const dragId = dragState?.id;
    const folder = findNodeById(localTree, folderId);
    if (!folder) return null;
    return folder.children.find((c) => c.id !== dragId) ?? null;
  }

  // ─── Drop target ───────────────────────────────────────────

  type DropTarget = { parentId: string | null; beforeId: string | null };

  function currentDropTarget(): DropTarget {
    if (!dragState) return { parentId: null, beforeId: null };
    const sibs = findSiblings(dragState.parentId);
    const curIdx = sibs.findIndex((s) => s.id === dragState!.id);
    const beforeId = curIdx >= 0 ? sibs[curIdx + 1]?.id ?? null : null;
    return { parentId: dragState.parentId, beforeId };
  }

  function computeDropTarget(y: number): DropTarget {
    const rows = visibleRowsExcludingDragged();
    if (rows.length === 0) return { parentId: null, beforeId: null };

    // Find the row whose vertical band contains the cursor.
    let containing: { node: TreeNode; parentId: string | null; rect: DOMRect } | null = null;
    for (const r of rows) {
      const el = rowRefs.get(r.node.id);
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      if (y >= rect.top && y < rect.bottom) { containing = { ...r, rect }; break; }
    }

    if (containing) {
      const { node, parentId, rect } = containing;
      const relY = y - rect.top;

      // Top quarter → drop above this row at its parent.
      if (relY < rect.height * 0.25) {
        cancelHoverExpand();
        return { parentId, beforeId: node.id };
      }

      if (node.isFolder) {
        if (expanded.has(node.id)) {
          cancelHoverExpand();
          const first = firstNonDraggedChild(node.id);
          return { parentId: node.id, beforeId: first?.id ?? null };
        }
        // Closed folder: schedule hover-expand; meanwhile drop after at parent.
        scheduleHoverExpand(node.id);
        const next = nextNonDraggedSiblingOf(node.id, parentId);
        return { parentId, beforeId: next?.id ?? null };
      }

      // Leaf symptom: drop after at parent.
      cancelHoverExpand();
      const next = nextNonDraggedSiblingOf(node.id, parentId);
      return { parentId, beforeId: next?.id ?? null };
    }

    // Cursor is not inside any visible row. Three sub-cases:
    //   a) above the first visible row → drop at start of that parent
    //   b) below the last visible row → drop at end of that parent
    //   c) in the gap left by the dragged subtree (between two visible rows)
    //      → keep the current target. This is what gives the drag its natural
    //      hysteresis: as long as the cursor is over the empty slot, the item
    //      stays where it is.
    const first = rows[0];
    const firstEl = rowRefs.get(first.node.id);
    if (firstEl && y < firstEl.getBoundingClientRect().top) {
      cancelHoverExpand();
      return { parentId: first.parentId, beforeId: first.node.id };
    }
    const last = rows[rows.length - 1];
    const lastEl = rowRefs.get(last.node.id);
    if (lastEl && y >= lastEl.getBoundingClientRect().bottom) {
      cancelHoverExpand();
      const lastNext = nextNonDraggedSiblingOf(last.node.id, last.parentId);
      return { parentId: last.parentId, beforeId: lastNext?.id ?? null };
    }
    cancelHoverExpand();
    return currentDropTarget();
  }

  // ─── Apply drop target (mutate localTree) ──────────────────

  function applyDropTarget(target: DropTarget) {
    if (!dragState) return;
    const dragId = dragState.id;
    const sibs = findSiblings(dragState.parentId);
    const curIdx = sibs.findIndex((s) => s.id === dragId);
    if (curIdx < 0) return;
    const currentBeforeId = sibs[curIdx + 1]?.id ?? null;
    if (dragState.parentId === target.parentId && currentBeforeId === target.beforeId) return;

    moveNodeToTarget(dragId, target);
    dragState.parentId = target.parentId;
  }

  function moveNodeToTarget(nodeId: string, target: DropTarget) {
    let removed: TreeNode | null = null;
    function removeFrom(nodes: TreeNode[]): TreeNode[] {
      const out: TreeNode[] = [];
      for (const n of nodes) {
        if (n.id === nodeId) { removed = n; continue; }
        const newKids = n.children.length > 0 ? removeFrom(n.children) : n.children;
        out.push(newKids === n.children ? n : { ...n, children: newKids });
      }
      return out;
    }
    let next = removeFrom(localTree);
    if (!removed) return;
    const moved = removed as TreeNode;

    function insertAt(arr: TreeNode[]): TreeNode[] {
      if (target.beforeId === null) return [...arr, moved];
      const idx = arr.findIndex((n) => n.id === target.beforeId);
      if (idx < 0) return [...arr, moved];
      return [...arr.slice(0, idx), moved, ...arr.slice(idx)];
    }
    function insertInto(nodes: TreeNode[]): TreeNode[] {
      return nodes.map((n) => {
        if (n.id === target.parentId) return { ...n, children: insertAt(n.children) };
        if (n.children.length === 0) return n;
        return { ...n, children: insertInto(n.children) };
      });
    }
    localTree = target.parentId === null ? insertAt(next) : insertInto(next);
  }

  // ─── Hover-to-expand ───────────────────────────────────────

  let hoverFolderId: string | null = null;
  let hoverTimer: ReturnType<typeof setTimeout> | null = null;
  function scheduleHoverExpand(folderId: string) {
    if (hoverFolderId === folderId) return;
    cancelHoverExpand();
    hoverFolderId = folderId;
    hoverTimer = setTimeout(() => {
      if (hoverFolderId === folderId && !expanded.has(folderId)) {
        expanded = new Set([...expanded, folderId]);
      }
      hoverTimer = null;
      hoverFolderId = null;
    }, 600);
  }
  function cancelHoverExpand() {
    if (hoverTimer) { clearTimeout(hoverTimer); hoverTimer = null; }
    hoverFolderId = null;
  }

  // ─── Drag lifecycle ────────────────────────────────────────

  let activePointerId: number | null = null;

  function startDrag(e: PointerEvent, node: TreeNode, parentId: string | null) {
    e.preventDefault();
    const rowEl = rowRefs.get(node.id);
    if (!rowEl) return;
    const rect = rowEl.getBoundingClientRect();
    dragState = {
      id: node.id,
      originalParentId: parentId,
      parentId,
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
    const rawY = e.clientY;
    const target = computeDropTarget(rawY);
    applyDropTarget(target);

    let y = rawY;
    if (listEl) {
      const listRect = listEl.getBoundingClientRect();
      const minY = listRect.top + dragState.grabOffsetY;
      const maxY = listRect.bottom - (dragState.rowHeight - dragState.grabOffsetY);
      if (y < minY) y = minY;
      else if (y > maxY) y = maxY;
    }
    dragState.currentY = y;
  }

  function onDragEnd(e: PointerEvent) {
    if (e.pointerId !== activePointerId) return;
    void endDrag();
  }

  async function endDrag() {
    window.removeEventListener('pointermove', onDragMove);
    window.removeEventListener('pointerup', onDragEnd);
    window.removeEventListener('pointercancel', onDragEnd);
    activePointerId = null;
    cancelHoverExpand();
    if (!dragState) return;
    const finished = dragState;

    // Snapshot the in-drag sibling orders *before* clearing dragState. The
    // `$effect` that resets localTree to `treeQ.current` runs on the next
    // await, wiping the in-drag mutations. Calling findSiblings afterwards
    // would return the pre-drag DB order — so the cross-parent reorder
    // would not include the moved item, and it would stay at the end
    // (where moveSymptom appends it by default).
    const newSibIds = findSiblings(finished.parentId).map((s) => s.id);
    const origSibIds = (finished.originalParentId !== finished.parentId)
      ? findSiblings(finished.originalParentId).map((s) => s.id)
      : null;

    dragState = null;

    try {
      if (finished.parentId !== finished.originalParentId) {
        await moveSymptom(finished.id, finished.parentId);
      }
      if (newSibIds.length > 0) {
        await reorderSiblings(finished.parentId, newSibIds);
      }
      if (origSibIds && origSibIds.length > 0) {
        await reorderSiblings(finished.originalParentId, origSibIds);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      snackbar.show({ message: `Verschieben fehlgeschlagen: ${msg}` });
      // localTree will re-sync from treeQ via the $effect now that dragState is null
    }
  }

  // ─── Visual transform during drag ──────────────────────────

  function dragTransform(id: string): string {
    const ds = dragState;
    if (!ds || !listEl) return '';
    const dragged = findNodeById(localTree, ds.id);
    if (!dragged) return '';
    const isDragged = ds.id === id;
    const isInDragged = !isDragged && isInSubtree(dragged, id);
    if (!isDragged && !isInDragged) return '';

    const draggedIdx = draggedVisibleIndex();
    if (draggedIdx < 0) return '';
    const listTop = listEl.getBoundingClientRect().top;
    const naturalTop = listTop + draggedIdx * ds.rowHeight;
    const wantedTop = ds.currentY - ds.grabOffsetY;
    return `translateY(${wantedTop - naturalTop}px)`;
  }

  // How many flattened (visible) rows the dragged subtree spans.
  function draggedSubtreeRowCount(): number {
    const ds = dragState;
    if (!ds) return 0;
    const dragged = findNodeById(localTree, ds.id);
    if (!dragged) return 0;
    let count = 0;
    function recur(node: TreeNode) {
      count++;
      if (node.isFolder && expanded.has(node.id)) {
        for (const c of node.children) recur(c);
      }
    }
    recur(dragged);
    return count;
  }

  // ─── Toggle / create / edit ────────────────────────────────

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
      updatedAt: 0,
      inputs: defaultSymptomInputs(),
      daily: false
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
    class:in-drag-subtree={dragState && dragState.id !== node.id && (() => {
      const dragged = findNodeById(localTree, dragState.id);
      return dragged ? isInSubtree(dragged, node.id) : false;
    })()}
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
  {#if dragState}
    <li
      class="drop-placeholder"
      aria-hidden="true"
      style:top="{draggedVisibleIndex() * dragState.rowHeight}px"
      style:height="{draggedSubtreeRowCount() * dragState.rowHeight}px"
    ></li>
  {/if}
</ul>

{#if archivedQ.current.length > 0}
  <div class="archive-block">
    <button
      type="button"
      class="archive-toggle"
      onclick={() => (showArchived = !showArchived)}
      aria-expanded={showArchived}
    >
      {showArchived ? 'Archiv ausblenden' : 'Archiv anzeigen'} ({archivedQ.current.length})
    </button>
    {#if showArchived}
      <ul class="archived-list">
        {#each archivedQ.current as s (s.id)}
          {@const pn = parentNameOf(s)}
          <li class="archived-row">
            <div class="archived-badge"><Badge icon={s.icon} color={s.color} size={28} archived /></div>
            <div class="archived-text">
              <div class="archived-name">{s.name}</div>
              {#if pn}<div class="archived-parent">im Ordner: {pn}</div>{/if}
            </div>
            <button type="button" class="restore-btn" onclick={() => restore(s)}>Wiederherstellen</button>
          </li>
        {/each}
      </ul>
    {/if}
  </div>
{/if}

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
  .list { list-style: none; margin: 0; padding: 0; position: relative; }
  .drop-placeholder {
    position: absolute;
    left: var(--sp-2);
    right: var(--sp-2);
    box-sizing: border-box;
    border: 1px dashed var(--c-accent, var(--c-text-dim));
    border-radius: var(--r-2);
    background: color-mix(in srgb, var(--c-accent, var(--c-text-dim)) 10%, transparent);
    pointer-events: none;
    z-index: 1;
  }
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
  .row.in-drag-subtree {
    z-index: 99;
    opacity: 0.85;
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

  .archive-block {
    margin: var(--sp-4);
    padding-top: var(--sp-3);
    border-top: 1px solid var(--c-border);
  }
  .archive-toggle {
    background: none;
    border: 0;
    padding: var(--sp-2) 0;
    color: var(--c-text-dim);
    font-size: var(--fs-sm);
    cursor: pointer;
    text-decoration: underline;
  }
  .archived-list {
    list-style: none;
    margin: var(--sp-2) 0 0;
    padding: 0;
  }
  .archived-row {
    display: flex;
    align-items: center;
    gap: var(--sp-3);
    padding: var(--sp-2) 0;
    border-bottom: 1px solid var(--c-border);
  }
  .archived-badge { flex-shrink: 0; }
  .archived-text { flex: 1; min-width: 0; }
  .archived-name { color: var(--c-text-dim); font-weight: var(--fw-medium); }
  .archived-parent { font-size: var(--fs-xs); color: var(--c-text-dim); font-style: italic; }
  .restore-btn {
    background: var(--c-surface);
    border: 1px solid var(--c-border);
    border-radius: var(--r-2);
    padding: var(--sp-2) var(--sp-3);
    cursor: pointer;
    color: var(--c-text);
    font-size: var(--fs-sm);
    flex-shrink: 0;
  }
  .restore-btn:hover { background: var(--c-surface-2); }
</style>
