<script lang="ts">
  import { untrack } from 'svelte';
  import Modal from '$lib/components/ui/Modal.svelte';
  import Badge from '$lib/components/ui/Badge.svelte';
  import SwipeRow from '$lib/components/ui/SwipeRow.svelte';
  import SymptomSheet from '$lib/components/SymptomSheet/SymptomSheet.svelte';
  import { GripVertical, Plus } from '@lucide/svelte';
  import { newId } from '$lib/utils/uuid';
  import type { StatusItem } from '$lib/db/statusBar';
  import type { Symptom } from '$lib/db';

  type Props = {
    open: boolean;
    items: StatusItem[];
    /** All non-archived symptoms (incl. folders) — the picker drills the tree
        like the logging sheet; only leaves can be added. */
    symptoms: Symptom[];
    /** Persisted immediately on every add/remove/reorder. */
    onSave: (items: StatusItem[]) => void;
    onClose: () => void;
  };
  let { open, items, symptoms, onSave, onClose }: Props = $props();

  // Working copy, source of truth for the list while open. Re-synced from the
  // prop only when the dialog (re)opens — our own saves echo back through the
  // liveQuery, and resyncing then would fight an in-progress drag.
  let local = $state<StatusItem[]>(untrack(() => $state.snapshot(items) as StatusItem[]));
  $effect(() => {
    if (!open) return;
    untrack(() => { local = $state.snapshot(items) as StatusItem[]; });
  });

  // While picking, the config Modal yields to the symptom tree (the Sheet sits
  // below the Modal in z-order, so they can't both be visible).
  let picking = $state(false);
  $effect(() => { if (!open) picking = false; });

  function symptomFor(id: string): Symptom | undefined {
    return symptoms.find((s) => s.id === id);
  }
  const configuredIds = $derived(new Set(local.map((it) => it.symptomId)));

  function commit() {
    onSave($state.snapshot(local) as StatusItem[]);
  }

  function onPick(symptomId: string) {
    if (!configuredIds.has(symptomId)) {
      local = [...local, { id: newId(), type: 'daysSince', symptomId }];
      commit();
    }
    picking = false;
  }
  function remove(id: string) {
    local = local.filter((it) => it.id !== id);
    commit();
  }

  // ─── drag-to-reorder (lift + dashed placeholder, like the symptoms tab) ──
  const rowRefs = new Map<string, HTMLElement>();
  function trackRow(node: HTMLElement, id: string) {
    rowRefs.set(id, node);
    return { destroy() { rowRefs.delete(id); } };
  }
  let listEl = $state<HTMLElement | null>(null);

  type DragState = { id: string; rowHeight: number; grabOffsetY: number; currentY: number };
  let dragState = $state<DragState | null>(null);
  let activePointerId: number | null = null;

  function startDrag(e: PointerEvent, id: string) {
    e.preventDefault();
    e.stopPropagation(); // don't let the SwipeRow treat the grab as a swipe
    const li = rowRefs.get(id);
    if (!li) return;
    const rect = li.getBoundingClientRect();
    dragState = { id, rowHeight: rect.height, grabOffsetY: e.clientY - rect.top, currentY: e.clientY };
    activePointerId = e.pointerId;
    window.addEventListener('pointermove', onDragMove, { passive: false });
    window.addEventListener('pointerup', onDragEnd);
    window.addEventListener('pointercancel', onDragEnd);
  }
  function onDragMove(e: PointerEvent) {
    if (!dragState || e.pointerId !== activePointerId) return;
    e.preventDefault();
    dragState.currentY = e.clientY;
    // Insertion index among the non-dragged rows: count those whose midpoint
    // sits above the pointer. Their layout boxes are untransformed, so their
    // rects are stable as the list reflows around the lifted row.
    const y = e.clientY;
    let idx = 0;
    for (const it of local) {
      if (it.id === dragState.id) continue;
      const el = rowRefs.get(it.id);
      if (!el) { idx++; continue; }
      const r = el.getBoundingClientRect();
      if (y < r.top + r.height / 2) break;
      idx++;
    }
    reorderTo(dragState.id, idx);
  }
  function onDragEnd(e: PointerEvent) {
    if (e.pointerId !== activePointerId) return;
    window.removeEventListener('pointermove', onDragMove);
    window.removeEventListener('pointerup', onDragEnd);
    window.removeEventListener('pointercancel', onDragEnd);
    activePointerId = null;
    if (dragState) { dragState = null; commit(); }
  }
  function reorderTo(id: string, insertIdx: number) {
    const cur = local.findIndex((it) => it.id === id);
    if (cur === -1) return;
    const without = local.filter((it) => it.id !== id);
    const clamped = Math.max(0, Math.min(insertIdx, without.length));
    const next = [...without.slice(0, clamped), local[cur], ...without.slice(clamped)];
    if (next.some((it, i) => it.id !== local[i].id)) local = next;
  }

  function dragTransform(id: string): string {
    const ds = dragState;
    if (!ds || ds.id !== id || !listEl) return '';
    const idx = local.findIndex((it) => it.id === id);
    if (idx < 0) return '';
    const listTop = listEl.getBoundingClientRect().top;
    const naturalTop = listTop + idx * ds.rowHeight;
    const wantedTop = ds.currentY - ds.grabOffsetY;
    return `translateY(${wantedTop - naturalTop}px)`;
  }
  function draggedIndex(): number {
    return dragState ? local.findIndex((it) => it.id === dragState!.id) : -1;
  }
</script>

<Modal open={open && !picking} {onClose} title="Statusleiste">
  <p class="hint">
    Zeigt pro Symptom, wie viele Tage seit der letzten Erfassung vergangen sind —
    bezogen auf den angezeigten Tag. Nach links wischen zum Entfernen.
  </p>

  <button type="button" class="add" onclick={() => (picking = true)}>
    <Plus size={18} /> Symptom hinzufügen
  </button>

  {#if local.length === 0}
    <p class="empty">Noch keine Symptome. Tippe „Symptom hinzufügen".</p>
  {:else}
    <ul class="items" bind:this={listEl}>
      {#each local as item (item.id)}
        {@const sym = symptomFor(item.symptomId)}
        <li
          class="item"
          class:dragging={dragState?.id === item.id}
          use:trackRow={item.id}
          style:transform={dragTransform(item.id)}
        >
          <SwipeRow onSwipe={() => remove(item.id)}>
            <div class="row-inner">
              {#if sym}
                <Badge icon={sym.icon} color={sym.color} duotone={sym.duotone ?? true} bg={sym.bg ?? true} size={28} />
                <span class="name">{sym.name}</span>
              {:else}
                <span class="name missing">Unbekanntes Symptom</span>
              {/if}
              <button
                type="button"
                class="handle"
                aria-label="Verschieben"
                onpointerdown={(e) => startDrag(e, item.id)}
              >
                <GripVertical size={18} />
              </button>
            </div>
          </SwipeRow>
        </li>
      {/each}
      {#if dragState}
        <li
          class="drop-placeholder"
          aria-hidden="true"
          style:top="{draggedIndex() * dragState.rowHeight}px"
          style:height="{dragState.rowHeight}px"
        ></li>
      {/if}
    </ul>
  {/if}
</Modal>

<SymptomSheet
  open={open && picking}
  enteredIds={configuredIds}
  {onPick}
  onClose={() => (picking = false)}
/>

<style>
  .hint { color: var(--c-text-dim); font-size: var(--fs-sm); margin: 0 0 var(--sp-4); }
  .add {
    display: inline-flex; align-items: center; gap: var(--sp-2);
    width: 100%; justify-content: center;
    border: 1px dashed var(--c-border-strong); background: none; color: var(--c-text);
    border-radius: var(--r-2); padding: var(--sp-3); cursor: pointer;
    font-size: var(--fs-sm); font-weight: var(--fw-medium);
    margin-bottom: var(--sp-4);
  }
  .empty { font-size: var(--fs-sm); color: var(--c-text-dim); text-align: center; padding: var(--sp-4); }
  .items {
    list-style: none; margin: 0; padding: 0;
    position: relative;
    border-top: 1px solid var(--c-border);
  }
  .item {
    position: relative;
    background: var(--c-surface);
    will-change: transform;
  }
  .item .row-inner { border-bottom: 1px solid var(--c-border); }
  .item.dragging { z-index: 10; box-shadow: var(--shadow-2); }
  .row-inner {
    display: flex; align-items: center; gap: var(--sp-2);
    padding: var(--sp-2);
    background: var(--c-surface);
  }
  .name { flex: 1; min-width: 0; font-size: var(--fs-md); }
  .name.missing { color: var(--c-text-dim); font-style: italic; }
  .handle {
    border: 0; background: none; color: var(--c-text-dim);
    cursor: grab; padding: var(--sp-1); display: flex; align-items: center;
    flex-shrink: 0;
    touch-action: none;
  }
  .handle:active { cursor: grabbing; }
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
</style>
