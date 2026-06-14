<script lang="ts">
  import { untrack } from 'svelte';
  import Modal from '$lib/components/ui/Modal.svelte';
  import Badge from '$lib/components/ui/Badge.svelte';
  import SymptomSheet from '$lib/components/SymptomSheet/SymptomSheet.svelte';
  import { GripVertical, Trash2, Plus } from '@lucide/svelte';
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

  // ─── flat drag-to-reorder ───────────────────────────────────
  const rowRefs = new Map<string, HTMLElement>();
  function trackRow(node: HTMLElement, id: string) {
    rowRefs.set(id, node);
    return { destroy() { rowRefs.delete(id); } };
  }
  let dragId = $state<string | null>(null);
  let activePointerId: number | null = null;

  function startDrag(e: PointerEvent, id: string) {
    e.preventDefault();
    dragId = id;
    activePointerId = e.pointerId;
    window.addEventListener('pointermove', onDragMove, { passive: false });
    window.addEventListener('pointerup', onDragEnd);
    window.addEventListener('pointercancel', onDragEnd);
  }
  function onDragMove(e: PointerEvent) {
    if (dragId === null || e.pointerId !== activePointerId) return;
    e.preventDefault();
    const y = e.clientY;
    // Insertion index = count of rows whose vertical midpoint sits above y.
    let target = local.length;
    for (let i = 0; i < local.length; i++) {
      const el = rowRefs.get(local[i].id);
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      if (y < rect.top + rect.height / 2) { target = i; break; }
    }
    reorder(dragId, target);
  }
  function onDragEnd(e: PointerEvent) {
    if (e.pointerId !== activePointerId) return;
    window.removeEventListener('pointermove', onDragMove);
    window.removeEventListener('pointerup', onDragEnd);
    window.removeEventListener('pointercancel', onDragEnd);
    activePointerId = null;
    if (dragId !== null) { dragId = null; commit(); }
  }
  function reorder(id: string, toIndex: number) {
    const from = local.findIndex((it) => it.id === id);
    if (from === -1) return;
    if (toIndex === from || toIndex === from + 1) return; // already there
    const arr = [...local];
    const [item] = arr.splice(from, 1);
    arr.splice(toIndex > from ? toIndex - 1 : toIndex, 0, item);
    local = arr;
  }
</script>

<Modal open={open && !picking} {onClose} title="Statusleiste">
  <p class="hint">
    Zeigt pro Symptom, wie viele Tage seit der letzten Erfassung vergangen sind —
    bezogen auf den angezeigten Tag.
  </p>

  <button type="button" class="add" onclick={() => (picking = true)}>
    <Plus size={18} /> Symptom hinzufügen
  </button>

  {#if local.length === 0}
    <p class="empty">Noch keine Symptome. Tippe „Symptom hinzufügen".</p>
  {:else}
    <ul class="items">
      {#each local as item (item.id)}
        {@const sym = symptomFor(item.symptomId)}
        <li class="item" class:dragging={dragId === item.id} use:trackRow={item.id}>
          <button
            type="button"
            class="handle"
            aria-label="Verschieben"
            onpointerdown={(e) => startDrag(e, item.id)}
          >
            <GripVertical size={18} />
          </button>
          {#if sym}
            <Badge icon={sym.icon} color={sym.color} duotone={sym.duotone ?? true} bg={sym.bg ?? true} size={28} />
            <span class="name">{sym.name}</span>
          {:else}
            <span class="name missing">Unbekanntes Symptom</span>
          {/if}
          <button type="button" class="trash" aria-label="Entfernen" onclick={() => remove(item.id)}>
            <Trash2 size={18} />
          </button>
        </li>
      {/each}
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
  .items { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--sp-2); }
  .item {
    display: flex; align-items: center; gap: var(--sp-2);
    padding: var(--sp-2);
    border: 1px solid var(--c-border);
    border-radius: var(--r-2);
    background: var(--c-surface);
  }
  .item.dragging { opacity: 0.6; border-color: var(--c-text-dim); }
  .handle {
    border: 0; background: none; color: var(--c-text-dim);
    cursor: grab; padding: var(--sp-1); display: flex; align-items: center;
    touch-action: none;
  }
  .handle:active { cursor: grabbing; }
  .name { flex: 1; min-width: 0; font-size: var(--fs-md); }
  .name.missing { color: var(--c-text-dim); font-style: italic; }
  .trash {
    border: 0; background: none; color: var(--c-text-dim);
    cursor: pointer; padding: var(--sp-1); display: flex; align-items: center; flex-shrink: 0;
  }
  .trash:hover { color: var(--c-danger, #ef4444); }
</style>
