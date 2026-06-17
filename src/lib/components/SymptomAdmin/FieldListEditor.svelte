<script lang="ts">
  import type { MetaField, SelectOption, FieldType } from '$lib/db';
  import { newField } from '$lib/db/fields';
  import { newId } from '$lib/utils/uuid';
  import { GripVertical, Trash2, RotateCcw, Plus } from '@lucide/svelte';

  type Props = {
    fields: MetaField[];
    daily: boolean;
    onFieldsChange: (next: MetaField[]) => void;
    onDailyChange: (next: boolean) => void;
  };
  let { fields, daily, onFieldsChange, onDailyChange }: Props = $props();

  const TYPE_LABELS: Record<FieldType, string> = {
    slider: 'Slider', number: 'Zahl', select: 'Auswahl', text: 'Notiz'
  };
  const ADD_ORDER: FieldType[] = ['slider', 'number', 'select', 'text'];

  const hasEnabled = $derived(fields.some((f) => !f.deleted));
  let addOpen = $state(false);

  function patch(id: string, p: Partial<MetaField>) {
    onFieldsChange(fields.map((f) => (f.id === id ? ({ ...f, ...p } as MetaField) : f)));
  }
  function add(type: FieldType) {
    onFieldsChange([...fields, newField(type)]);
    addOpen = false;
  }
  function removeField(id: string) { patch(id, { deleted: true }); }
  function restoreField(id: string) { patch(id, { deleted: false }); }

  // ── select-option sub-editor (per select field) ───────────────────────────
  function setOptions(id: string, options: SelectOption[]) { patch(id, { options } as Partial<MetaField>); }
  function addOption(f: MetaField) {
    if (f.type !== 'select') return;
    setOptions(f.id, [...f.options, { key: newId(), label: '', value: null }]);
  }
  function updateOption(f: MetaField, key: string, p: Partial<SelectOption>) {
    if (f.type !== 'select') return;
    setOptions(f.id, f.options.map((o) => (o.key === key ? { ...o, ...p } : o)));
  }
  function setOptionValue(f: MetaField, key: string, raw: string) {
    const t = raw.trim();
    if (t === '') { updateOption(f, key, { value: null }); return; }
    const n = parseFloat(t.replace(',', '.'));
    updateOption(f, key, { value: Number.isFinite(n) ? n : null });
  }

  // ── drag-to-reorder (lift + dashed placeholder, like the status bar) ───────
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
    const y = e.clientY;
    let idx = 0;
    for (const f of fields) {
      if (f.id === dragState.id) continue;
      const el = rowRefs.get(f.id);
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
    dragState = null;
  }
  function reorderTo(id: string, insertIdx: number) {
    const cur = fields.findIndex((f) => f.id === id);
    if (cur === -1) return;
    const without = fields.filter((f) => f.id !== id);
    const clamped = Math.max(0, Math.min(insertIdx, without.length));
    const next = [...without.slice(0, clamped), fields[cur], ...without.slice(clamped)];
    if (next.some((f, i) => f.id !== fields[i].id)) onFieldsChange(next);
  }
  function dragTransform(id: string): string {
    const ds = dragState;
    if (!ds || ds.id !== id || !listEl) return '';
    const idx = fields.findIndex((f) => f.id === id);
    if (idx < 0) return '';
    const listTop = listEl.getBoundingClientRect().top;
    const naturalTop = listTop + idx * ds.rowHeight;
    const wantedTop = ds.currentY - ds.grabOffsetY;
    return `translateY(${wantedTop - naturalTop}px)`;
  }
  function draggedIndex(): number {
    return dragState ? fields.findIndex((f) => f.id === dragState!.id) : -1;
  }
</script>

<section class="config">
  <div class="caption">Felder</div>

  <ul class="fields" bind:this={listEl}>
    {#each fields as f (f.id)}
      <li class="card" class:dragging={dragState?.id === f.id} class:deleted={f.deleted} use:trackRow={f.id} style:transform={dragTransform(f.id)}>
        <header>
          <span class="type">{TYPE_LABELS[f.type]}</span>
          {#if f.deleted}
            <span class="del-label">{f.label || '(ohne Name)'} (gelöscht)</span>
            <button type="button" class="icon-action" aria-label="Feld wiederherstellen" title="Wiederherstellen" onclick={() => restoreField(f.id)}><RotateCcw size={16} /></button>
          {:else}
            <input type="text" class="label" aria-label="Bezeichnung" placeholder="z.B. Systolisch" value={f.label} oninput={(e) => patch(f.id, { label: (e.currentTarget as HTMLInputElement).value })} />
            <label class="req"><input type="checkbox" checked={f.required} onchange={(e) => patch(f.id, { required: (e.currentTarget as HTMLInputElement).checked })} /> Pflicht</label>
            <button type="button" class="icon-action" aria-label="Feld löschen" title="Löschen" onclick={() => removeField(f.id)}><Trash2 size={16} /></button>
            <button type="button" class="handle" aria-label="Verschieben" onpointerdown={(e) => startDrag(e, f.id)}><GripVertical size={18} /></button>
          {/if}
        </header>

        {#if !f.deleted && f.type === 'slider'}
          <div class="body">
            <label class="field"><span>Linker Endpunkt</span>
              <input type="text" value={f.lowLabel} placeholder="z.B. kaum spürbar" oninput={(e) => patch(f.id, { lowLabel: (e.currentTarget as HTMLInputElement).value } as Partial<MetaField>)} /></label>
            <label class="field"><span>Rechter Endpunkt</span>
              <input type="text" value={f.highLabel} placeholder="z.B. unerträglich" oninput={(e) => patch(f.id, { highLabel: (e.currentTarget as HTMLInputElement).value } as Partial<MetaField>)} /></label>
          </div>
        {:else if !f.deleted && f.type === 'number'}
          <div class="body">
            <label class="field"><span>Einheit</span>
              <input type="text" value={f.unit} placeholder="z.B. Tassen" oninput={(e) => patch(f.id, { unit: (e.currentTarget as HTMLInputElement).value } as Partial<MetaField>)} /></label>
            <label class="field row"><input type="checkbox" checked={f.integer} onchange={(e) => patch(f.id, { integer: (e.currentTarget as HTMLInputElement).checked } as Partial<MetaField>)} /><span>Nur ganze Zahlen</span></label>
          </div>
        {:else if !f.deleted && f.type === 'select'}
          <div class="body">
            <p class="hint">Optionen mit optionalem Zahlenwert (fließt in die Heatmap ein).</p>
            <ul class="options">
              {#each f.options as o (o.key)}
                <li class="option" class:deleted={o.deleted}>
                  {#if o.deleted}
                    <span class="opt-label-deleted">{o.label || '(ohne Name)'}</span>
                    <button type="button" class="icon-action" aria-label="Option wiederherstellen" title="Wiederherstellen" onclick={() => updateOption(f, o.key, { deleted: false })}><RotateCcw size={16} /></button>
                  {:else}
                    <input type="text" class="opt-label" aria-label="Option" placeholder="z.B. leicht" value={o.label} oninput={(e) => updateOption(f, o.key, { label: (e.currentTarget as HTMLInputElement).value })} />
                    <input type="number" class="opt-value" aria-label="Wert" inputmode="decimal" step="any" placeholder="Wert" value={o.value ?? ''} oninput={(e) => setOptionValue(f, o.key, (e.currentTarget as HTMLInputElement).value)} />
                    <button type="button" class="icon-action" aria-label="Option löschen" title="Löschen" onclick={() => updateOption(f, o.key, { deleted: true })}><Trash2 size={16} /></button>
                  {/if}
                </li>
              {/each}
              {#if f.options.length === 0}<li class="opt-empty">Noch keine Optionen.</li>{/if}
            </ul>
            <button type="button" class="add-opt" onclick={() => addOption(f)}><Plus size={16} /> Option hinzufügen</button>
          </div>
        {/if}
      </li>
    {/each}
    {#if dragState}
      <li class="drop-placeholder" aria-hidden="true" style:top="{draggedIndex() * dragState.rowHeight}px" style:height="{dragState.rowHeight}px"></li>
    {/if}
  </ul>

  <div class="add-wrap">
    <button type="button" class="add" onclick={() => (addOpen = !addOpen)}><Plus size={18} /> Feld hinzufügen</button>
    {#if addOpen}
      <div class="add-menu" role="menu">
        {#each ADD_ORDER as t}
          <button type="button" role="menuitem" aria-label="{TYPE_LABELS[t]} hinzufügen" onclick={() => add(t)}>{TYPE_LABELS[t]}</button>
        {/each}
      </div>
    {/if}
  </div>

  {#if hasEnabled}
    <label class="daily">
      <input type="checkbox" checked={daily} onchange={(e) => onDailyChange((e.currentTarget as HTMLInputElement).checked)} />
      <span>Täglich erfassen</span>
    </label>
    <p class="hint">Erscheint jeden Tag als graue Erinnerungs-Karte oben in der Liste, bis ein Eintrag erfasst ist.</p>
  {/if}
</section>

<style>
  .config { display: flex; flex-direction: column; gap: var(--sp-3); margin-bottom: var(--sp-4); }
  .caption { font-size: var(--fs-xs); color: var(--c-text-dim); text-transform: uppercase; letter-spacing: 0.05em; }
  .fields { list-style: none; margin: 0; padding: 0; position: relative; display: flex; flex-direction: column; gap: var(--sp-2); }
  .card { border: 1px solid var(--c-border); border-radius: var(--r-2); padding: var(--sp-2) var(--sp-3); background: var(--c-surface); will-change: transform; }
  .card.dragging { z-index: 10; box-shadow: var(--shadow-2); }
  .card.deleted header .del-label { flex: 1; color: var(--c-text-dim); text-decoration: line-through; font-size: var(--fs-sm); }
  .card header { display: flex; align-items: center; gap: var(--sp-2); }
  .type { font-size: var(--fs-xs); color: var(--c-text-dim); flex-shrink: 0; min-width: 3.5em; }
  .label { flex: 1; min-width: 0; padding: var(--sp-2) var(--sp-3); border: 1px solid var(--c-border); border-radius: var(--r-2); }
  .req { font-size: var(--fs-sm); display: inline-flex; align-items: center; gap: 4px; flex-shrink: 0; }
  .body { display: flex; flex-direction: column; gap: var(--sp-2); margin-top: var(--sp-2); }
  .field { display: flex; flex-direction: column; gap: 4px; font-size: var(--fs-sm); }
  .field > span { color: var(--c-text-dim); }
  .field input[type="text"] { padding: var(--sp-2) var(--sp-3); border: 1px solid var(--c-border); border-radius: var(--r-2); }
  .field.row { flex-direction: row; align-items: center; gap: var(--sp-2); }
  .handle { border: 0; background: none; color: var(--c-text-dim); cursor: grab; padding: var(--sp-1); display: flex; align-items: center; flex-shrink: 0; touch-action: none; }
  .handle:active { cursor: grabbing; }
  .icon-action { display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; flex-shrink: 0; border: 0; background: none; color: var(--c-text-dim); cursor: pointer; }
  .icon-action:hover { color: var(--c-text); }
  .options { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--sp-2); }
  .option { display: flex; align-items: center; gap: var(--sp-2); }
  .option input[type="text"], .option input[type="number"] { padding: var(--sp-2) var(--sp-3); border: 1px solid var(--c-border); border-radius: var(--r-2); font-size: var(--fs-sm); }
  .opt-label { flex: 1; min-width: 0; }
  .opt-value { width: 5em; text-align: right; }
  .opt-label-deleted { flex: 1; min-width: 0; color: var(--c-text-dim); text-decoration: line-through; font-size: var(--fs-sm); }
  .opt-empty { font-size: var(--fs-xs); color: var(--c-text-dim); }
  .hint { font-size: var(--fs-xs); color: var(--c-text-dim); margin: 0; }
  .add-wrap { position: relative; }
  .add { display: inline-flex; align-items: center; gap: var(--sp-2); width: 100%; justify-content: center; border: 1px dashed var(--c-border-strong); background: none; color: var(--c-text); border-radius: var(--r-2); padding: var(--sp-3); cursor: pointer; font-size: var(--fs-sm); font-weight: var(--fw-medium); }
  .add-menu { display: flex; flex-wrap: wrap; gap: var(--sp-2); margin-top: var(--sp-2); }
  .add-menu button { flex: 1; padding: var(--sp-2) var(--sp-3); border: 1px solid var(--c-border); border-radius: var(--r-2); background: var(--c-surface); cursor: pointer; font-size: var(--fs-sm); }
  .add-opt { display: inline-flex; align-items: center; gap: 4px; align-self: flex-start; padding: var(--sp-2) var(--sp-3); border: 1px solid var(--c-border); border-radius: var(--r-2); background: var(--c-surface); color: var(--c-text); cursor: pointer; font-size: var(--fs-sm); }
  .daily { display: inline-flex; align-items: center; gap: var(--sp-2); margin-top: var(--sp-2); }
  .drop-placeholder { position: absolute; left: 0; right: 0; box-sizing: border-box; border: 1px dashed var(--c-accent, var(--c-text-dim)); border-radius: var(--r-2); background: color-mix(in srgb, var(--c-accent, var(--c-text-dim)) 10%, transparent); pointer-events: none; z-index: 1; }
</style>
