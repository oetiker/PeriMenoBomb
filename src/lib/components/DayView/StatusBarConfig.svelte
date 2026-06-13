<script lang="ts">
  import { untrack } from 'svelte';
  import Modal from '$lib/components/ui/Modal.svelte';
  import Badge from '$lib/components/ui/Badge.svelte';
  import { ChevronUp, ChevronDown, Trash2, Plus } from '@lucide/svelte';
  import { newId } from '$lib/utils/uuid';
  import type { StatusItem } from '$lib/db/statusBar';
  import type { Symptom } from '$lib/db';

  type Props = {
    open: boolean;
    items: StatusItem[];
    /** Selectable symptoms — leaf, non-archived. Folders/archived are excluded
        upstream so the picker only offers things that can actually be logged. */
    symptoms: Symptom[];
    onSave: (items: StatusItem[]) => void;
    onClose: () => void;
  };
  let { open, items, symptoms, onSave, onClose }: Props = $props();

  // Working copy; committed only on Speichern (same pattern as the icon picker).
  let local = $state<StatusItem[]>(untrack(() => $state.snapshot(items)));
  $effect(() => {
    if (!open) return;
    untrack(() => { local = $state.snapshot(items); });
  });

  function symptomFor(id: string): Symptom | undefined {
    return symptoms.find((s) => s.id === id);
  }

  function add() {
    const first = symptoms[0];
    if (!first) return;
    local = [...local, { id: newId(), type: 'daysSince', symptomId: first.id }];
  }
  function remove(id: string) {
    local = local.filter((it) => it.id !== id);
  }
  function move(i: number, delta: number) {
    const j = i + delta;
    if (j < 0 || j >= local.length) return;
    const next = [...local];
    [next[i], next[j]] = [next[j], next[i]];
    local = next;
  }
  function setSymptom(id: string, symptomId: string) {
    local = local.map((it) => (it.id === id ? { ...it, symptomId } : it));
  }

  function save() {
    // Snapshot to strip the Svelte state proxy — dexie (IndexedDB structured
    // clone) can't serialise a proxy.
    onSave($state.snapshot(local) as StatusItem[]);
    onClose();
  }
</script>

<Modal {open} {onClose} title="Statusleiste einrichten">
  {#if symptoms.length === 0}
    <p class="hint">Keine Symptome vorhanden. Lege zuerst ein Symptom an.</p>
  {:else}
    <p class="hint">
      Zeigt pro Eintrag, wie viele Tage seit der letzten Erfassung des gewählten
      Symptoms vergangen sind — bezogen auf den angezeigten Tag.
    </p>

    <ul class="items">
      {#each local as item, i (item.id)}
        {@const sym = symptomFor(item.symptomId)}
        <li class="item">
          {#if sym}
            <Badge icon={sym.icon} color={sym.color} duotone={sym.duotone ?? true} bg={sym.bg ?? true} size={28} />
          {/if}
          <select
            class="sym-select"
            value={item.symptomId}
            onchange={(e) => setSymptom(item.id, (e.currentTarget as HTMLSelectElement).value)}
          >
            {#each symptoms as s}
              <option value={s.id}>{s.name}</option>
            {/each}
          </select>
          <div class="row-actions">
            <button type="button" class="icon-action" aria-label="Nach oben" disabled={i === 0} onclick={() => move(i, -1)}>
              <ChevronUp size={18} />
            </button>
            <button type="button" class="icon-action" aria-label="Nach unten" disabled={i === local.length - 1} onclick={() => move(i, 1)}>
              <ChevronDown size={18} />
            </button>
            <button type="button" class="icon-action danger" aria-label="Entfernen" onclick={() => remove(item.id)}>
              <Trash2 size={18} />
            </button>
          </div>
        </li>
      {/each}
    </ul>

    <button type="button" class="add" onclick={add}>
      <Plus size={18} /> Eintrag hinzufügen
    </button>
  {/if}

  {#snippet footer()}
    <button type="button" class="secondary" onclick={onClose}>Verwerfen</button>
    <button type="button" class="primary" onclick={save}>Speichern</button>
  {/snippet}
</Modal>

<style>
  .hint { color: var(--c-text-dim); font-size: var(--fs-sm); margin: 0 0 var(--sp-4); }
  .items { list-style: none; margin: 0 0 var(--sp-3); padding: 0; display: flex; flex-direction: column; gap: var(--sp-2); }
  .item { display: flex; align-items: center; gap: var(--sp-2); }
  .sym-select {
    flex: 1; min-width: 0;
    padding: var(--sp-2);
    border: 1px solid var(--c-border);
    border-radius: var(--r-2);
    background: var(--c-surface); color: var(--c-text);
    font-size: var(--fs-sm);
  }
  .row-actions { display: flex; align-items: center; gap: 2px; flex-shrink: 0; }
  .icon-action {
    border: 0; background: none; color: var(--c-text-dim);
    cursor: pointer; padding: var(--sp-1); display: flex; align-items: center;
  }
  .icon-action:hover:not(:disabled) { color: var(--c-text); }
  .icon-action:disabled { opacity: 0.3; cursor: default; }
  .icon-action.danger:hover { color: var(--c-danger, #ef4444); }
  .add {
    display: inline-flex; align-items: center; gap: var(--sp-2);
    border: 1px dashed var(--c-border-strong); background: none; color: var(--c-text);
    border-radius: var(--r-2); padding: var(--sp-2) var(--sp-3); cursor: pointer;
    font-size: var(--fs-sm);
  }
  .primary { background: var(--c-primary); color: var(--c-primary-contrast); border: 0; padding: var(--sp-3); border-radius: var(--r-2); font-weight: var(--fw-bold); cursor: pointer; }
  .secondary { background: var(--c-surface-2); color: var(--c-text); border: 1px solid var(--c-border); padding: var(--sp-3); border-radius: var(--r-2); cursor: pointer; }
</style>
