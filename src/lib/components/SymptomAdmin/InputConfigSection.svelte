<script lang="ts">
  import type { SymptomInputs, SelectOption } from '$lib/db';
  import { newId } from '$lib/utils/uuid';
  import { Trash2, RotateCcw, Plus } from '@lucide/svelte';

  type Props = {
    inputs: SymptomInputs;
    daily: boolean;
    onInputsChange: (next: SymptomInputs) => void;
    onDailyChange: (next: boolean) => void;
  };
  let { inputs, daily, onInputsChange, onDailyChange }: Props = $props();

  // Legacy symptoms may predate the select input; treat a missing block as
  // disabled+empty so the UI always has something concrete to bind to.
  const select = $derived(inputs.select ?? { enabled: false, required: false, options: [] });

  const hasEnabled = $derived(
    inputs.slider.enabled || inputs.number.enabled || inputs.comment.enabled || select.enabled
  );

  function patchSlider(p: Partial<SymptomInputs['slider']>) {
    onInputsChange({ ...inputs, slider: { ...inputs.slider, ...p } });
  }
  function patchNumber(p: Partial<SymptomInputs['number']>) {
    onInputsChange({ ...inputs, number: { ...inputs.number, ...p } });
  }
  function patchComment(p: Partial<SymptomInputs['comment']>) {
    onInputsChange({ ...inputs, comment: { ...inputs.comment, ...p } });
  }
  function patchSelect(p: Partial<NonNullable<SymptomInputs['select']>>) {
    onInputsChange({ ...inputs, select: { ...select, ...p } });
  }
  function setOptions(options: SelectOption[]) {
    patchSelect({ options });
  }
  function addOption() {
    // key is minted once here and never changes — that stable id is what gets
    // stored on each log, so editing the label later keeps continuity.
    setOptions([...select.options, { key: newId(), label: '', value: null }]);
  }
  function updateOption(key: string, patch: Partial<SelectOption>) {
    setOptions(select.options.map((o) => (o.key === key ? { ...o, ...patch } : o)));
  }
  function setOptionValue(key: string, raw: string) {
    const t = raw.trim();
    if (t === '') { updateOption(key, { value: null }); return; }
    const n = parseFloat(t.replace(',', '.'));
    updateOption(key, { value: Number.isFinite(n) ? n : null });
  }
  // Soft delete: keep the option (with its key + label) so historical logs still
  // resolve and it can be restored; just hide it from the live dropdown.
  function deleteOption(key: string) { updateOption(key, { deleted: true }); }
  function restoreOption(key: string) { updateOption(key, { deleted: false }); }
</script>

<section class="config">
  <div class="caption">Eingaben</div>

  <!-- Slider card -->
  <div class="card">
    <header>
      <strong>Slider</strong>
      <label><input type="checkbox" aria-label="Aktiv" checked={inputs.slider.enabled} onchange={(e) => patchSlider({ enabled: (e.currentTarget as HTMLInputElement).checked })} /> Aktiv</label>
      <label><input type="checkbox" aria-label="Pflicht" checked={inputs.slider.required} disabled={!inputs.slider.enabled} onchange={(e) => patchSlider({ required: (e.currentTarget as HTMLInputElement).checked })} /> Pflicht</label>
    </header>
    {#if inputs.slider.enabled}
      <div class="body">
        <label class="field">
          <span>Linker Endpunkt</span>
          <input type="text" value={inputs.slider.lowLabel} placeholder="z.B. kaum spürbar" oninput={(e) => patchSlider({ lowLabel: (e.currentTarget as HTMLInputElement).value })} />
        </label>
        <label class="field">
          <span>Rechter Endpunkt</span>
          <input type="text" value={inputs.slider.highLabel} placeholder="z.B. unerträglich" oninput={(e) => patchSlider({ highLabel: (e.currentTarget as HTMLInputElement).value })} />
        </label>
      </div>
    {/if}
  </div>

  <!-- Number card -->
  <div class="card">
    <header>
      <strong>Zahl</strong>
      <label><input type="checkbox" aria-label="Aktiv" checked={inputs.number.enabled} onchange={(e) => patchNumber({ enabled: (e.currentTarget as HTMLInputElement).checked })} /> Aktiv</label>
      <label><input type="checkbox" aria-label="Pflicht" checked={inputs.number.required} disabled={!inputs.number.enabled} onchange={(e) => patchNumber({ required: (e.currentTarget as HTMLInputElement).checked })} /> Pflicht</label>
    </header>
    {#if inputs.number.enabled}
      <div class="body">
        <label class="field">
          <span>Einheit</span>
          <input type="text" value={inputs.number.unit} placeholder="z.B. Tassen" oninput={(e) => patchNumber({ unit: (e.currentTarget as HTMLInputElement).value })} />
        </label>
        <label class="field row">
          <input type="checkbox" checked={inputs.number.integer} onchange={(e) => patchNumber({ integer: (e.currentTarget as HTMLInputElement).checked })} />
          <span>Nur ganze Zahlen</span>
        </label>
      </div>
    {/if}
  </div>

  <!-- Select card -->
  <div class="card">
    <header>
      <strong>Auswahl</strong>
      <label><input type="checkbox" aria-label="Aktiv" checked={select.enabled} onchange={(e) => patchSelect({ enabled: (e.currentTarget as HTMLInputElement).checked })} /> Aktiv</label>
      <label><input type="checkbox" aria-label="Pflicht" checked={select.required} disabled={!select.enabled} onchange={(e) => patchSelect({ required: (e.currentTarget as HTMLInputElement).checked })} /> Pflicht</label>
    </header>
    {#if select.enabled}
      <div class="body">
        <p class="hint">Optionen mit optionalem Zahlenwert (fließt in die Heatmap ein).</p>
        <ul class="options">
          {#each select.options as o (o.key)}
            <li class="option" class:deleted={o.deleted}>
              {#if o.deleted}
                <span class="opt-label-deleted">{o.label || '(ohne Name)'}</span>
                <button type="button" class="icon-action" aria-label="Wiederherstellen" title="Wiederherstellen" onclick={() => restoreOption(o.key)}><RotateCcw size={16} /></button>
              {:else}
                <input
                  type="text"
                  class="opt-label"
                  aria-label="Bezeichnung"
                  placeholder="z.B. leicht"
                  value={o.label}
                  oninput={(e) => updateOption(o.key, { label: (e.currentTarget as HTMLInputElement).value })}
                />
                <input
                  type="number"
                  class="opt-value"
                  aria-label="Wert"
                  inputmode="decimal"
                  step="any"
                  placeholder="Wert"
                  value={o.value ?? ''}
                  oninput={(e) => setOptionValue(o.key, (e.currentTarget as HTMLInputElement).value)}
                />
                <button type="button" class="icon-action" aria-label="Löschen" title="Löschen" onclick={() => deleteOption(o.key)}><Trash2 size={16} /></button>
              {/if}
            </li>
          {/each}
          {#if select.options.length === 0}
            <li class="opt-empty">Noch keine Optionen.</li>
          {/if}
        </ul>
        <button type="button" class="add-opt" onclick={addOption}><Plus size={16} /> Option hinzufügen</button>
      </div>
    {/if}
  </div>

  <!-- Comment card -->
  <div class="card">
    <header>
      <strong>Kommentar</strong>
      <label><input type="checkbox" aria-label="Aktiv" checked={inputs.comment.enabled} onchange={(e) => patchComment({ enabled: (e.currentTarget as HTMLInputElement).checked })} /> Aktiv</label>
      <label><input type="checkbox" aria-label="Pflicht" checked={inputs.comment.required} disabled={!inputs.comment.enabled} onchange={(e) => patchComment({ required: (e.currentTarget as HTMLInputElement).checked })} /> Pflicht</label>
    </header>
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
  .card { border: 1px solid var(--c-border); border-radius: var(--r-2); padding: var(--sp-2) var(--sp-3); }
  .card header { display: flex; align-items: center; gap: var(--sp-3); }
  .card header strong { flex: 1; }
  .card header label { font-size: var(--fs-sm); display: inline-flex; align-items: center; gap: 4px; }
  .body { display: flex; flex-direction: column; gap: var(--sp-2); margin-top: var(--sp-2); }
  .field { display: flex; flex-direction: column; gap: 4px; font-size: var(--fs-sm); }
  .field > span { color: var(--c-text-dim); }
  .field input[type="text"] { padding: var(--sp-2) var(--sp-3); border: 1px solid var(--c-border); border-radius: var(--r-2); }
  .field.row { flex-direction: row; align-items: center; gap: var(--sp-2); }
  .daily { display: inline-flex; align-items: center; gap: var(--sp-2); margin-top: var(--sp-2); }
  .hint { font-size: var(--fs-xs); color: var(--c-text-dim); margin: 0; }

  .options { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--sp-2); }
  .option { display: flex; align-items: center; gap: var(--sp-2); }
  .option input[type="text"], .option input[type="number"] {
    padding: var(--sp-2) var(--sp-3); border: 1px solid var(--c-border); border-radius: var(--r-2); font-size: var(--fs-sm);
  }
  .opt-label { flex: 1; min-width: 0; }
  .opt-value { width: 5em; text-align: right; }
  .opt-label-deleted { flex: 1; min-width: 0; color: var(--c-text-dim); text-decoration: line-through; font-size: var(--fs-sm); }
  .opt-empty { font-size: var(--fs-xs); color: var(--c-text-dim); }
  .icon-action {
    display: inline-flex; align-items: center; justify-content: center;
    width: 32px; height: 32px; flex-shrink: 0;
    border: 0; background: none; color: var(--c-text-dim); cursor: pointer;
  }
  .icon-action:hover { color: var(--c-text); }
  .add-opt {
    display: inline-flex; align-items: center; gap: 4px; align-self: flex-start;
    padding: var(--sp-2) var(--sp-3); border: 1px solid var(--c-border); border-radius: var(--r-2);
    background: var(--c-surface); color: var(--c-text); cursor: pointer; font-size: var(--fs-sm);
  }
</style>
