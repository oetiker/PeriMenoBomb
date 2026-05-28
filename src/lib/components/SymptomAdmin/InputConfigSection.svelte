<script lang="ts">
  import type { SymptomInputs } from '$lib/db';

  type Props = {
    inputs: SymptomInputs;
    daily: boolean;
    onInputsChange: (next: SymptomInputs) => void;
    onDailyChange: (next: boolean) => void;
  };
  let { inputs, daily, onInputsChange, onDailyChange }: Props = $props();

  const hasEnabled = $derived(
    inputs.slider.enabled || inputs.number.enabled || inputs.comment.enabled
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
</style>
