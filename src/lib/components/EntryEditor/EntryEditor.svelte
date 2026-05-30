<script lang="ts">
  import { untrack } from 'svelte';
  import Modal from '$lib/components/ui/Modal.svelte';
  import Badge from '$lib/components/ui/Badge.svelte';
  import SliderInput from './SliderInput.svelte';
  import NumberInput from './NumberInput.svelte';
  import SelectInput from './SelectInput.svelte';
  import SymptomEditModal from '$lib/components/SymptomAdmin/SymptomEditModal.svelte';
  import { upsertEntry, getEntry, deleteEntry, validateEntry } from '$lib/db/entries';
  import type { Symptom } from '$lib/db';
  import { isValidDateKey, formatLong } from '$lib/utils/date';
  import {
    persistDialog, updateDialogPayload, clearDialog
  } from '$lib/stores/openDialog.svelte';
  import { snackbar } from '$lib/stores/snackbar.svelte';
  import { page } from '$app/state';

  type Props = {
    open: boolean;
    date: string;
    symptom: Symptom;
    /** Optional initial values when restoring from openDialog. */
    initial?: { sliderValue: number | null; numberValue: number | null; comment: string; selectKey: string | null };
    onClose: () => void;
  };
  let { open, date, symptom, initial, onClose }: Props = $props();

  let workingDate = $state(untrack(() => date));
  let sliderValue = $state<number | null>(untrack(() => initial?.sliderValue ?? null));
  let numberValue = $state<number | null>(untrack(() => initial?.numberValue ?? null));
  let comment = $state(untrack(() => initial?.comment ?? ''));
  let selectKey = $state<string | null>(untrack(() => initial?.selectKey ?? null));
  let configOpen = $state(false);

  // Load existing entry once on open. If `initial` is provided (restore path), skip — restored values win.
  $effect(() => {
    if (!open) return;
    workingDate = date;
    if (initial) return;
    (async () => {
      const e = await getEntry(date, symptom.id);
      if (e) {
        sliderValue = e.sliderValue;
        numberValue = e.numberValue;
        comment = e.comment;
        selectKey = e.selectKey ?? null;
      } else {
        sliderValue = null;
        numberValue = null;
        comment = '';
        selectKey = null;
      }
    })();
  });

  // Persist dialog on open; update on every change; clear on close paths.
  // The persist effect must run ONCE per open transition (snapshot current values
  // without subscribing to them), otherwise every keystroke would trigger a full
  // IndexedDB put.
  let lastOpenedKey = $state<string | null>(null);

  $effect(() => {
    if (!open) {
      lastOpenedKey = null;
      return;
    }
    const key = `${symptom.id}@${date}`;
    if (lastOpenedKey === key) return;
    lastOpenedKey = key;
    const snapshot = untrack(() => ({
      date: workingDate,
      symptomId: symptom.id,
      sliderValue,
      numberValue,
      comment,
      selectKey
    }));
    void persistDialog({
      kind: 'entry-editor',
      route: page.url.pathname,
      payload: snapshot
    });
  });

  $effect(() => {
    if (!open) return;
    void updateDialogPayload({ date: workingDate, sliderValue, numberValue, comment, selectKey });
  });

  const validation = $derived(validateEntry(symptom, { sliderValue, numberValue, comment, selectKey }));

  async function onSave() {
    if (!validation.ok) return;
    await upsertEntry({
      date: workingDate,
      symptomId: symptom.id,
      sliderValue, numberValue, comment, selectKey
    });
    await clearDialog();
    onClose();
  }

  async function onCancel() {
    await clearDialog();
    onClose();
  }

  async function onDelete() {
    const existing = await getEntry(workingDate, symptom.id);
    if (existing) {
      await deleteEntry(workingDate, symptom.id);
      snackbar.show({
        message: `${symptom.name} gelöscht`,
        actionLabel: 'Rückgängig',
        onAction: async () => {
          await upsertEntry({
            date: existing.date,
            symptomId: existing.symptomId,
            sliderValue: existing.sliderValue,
            numberValue: existing.numberValue,
            comment: existing.comment,
            selectKey: existing.selectKey ?? null
          });
        }
      });
    }
    await clearDialog();
    onClose();
  }

  async function onDateChange(e: Event) {
    const v = (e.target as HTMLInputElement).value;
    if (!v || !isValidDateKey(v) || v === workingDate) return;
    workingDate = v;
  }

  function openDatePicker(e: MouseEvent) {
    const el = e.currentTarget as HTMLInputElement;
    if (typeof el.showPicker === 'function') {
      try { el.showPicker(); } catch { /* needs a user gesture; we have one */ }
    }
  }

  // Stacking SymptomEditModal on top means it also writes to the openDialog
  // store under its own kind. When the user dismisses the inner modal we
  // restore the entry-editor state, so a cold start lands on the entry editor
  // (the dialog the user is *actually* still inside), not on the symptom config.
  function onConfigClose() {
    configOpen = false;
    void persistDialog({
      kind: 'entry-editor',
      route: page.url.pathname,
      payload: {
        date: workingDate,
        symptomId: symptom.id,
        sliderValue, numberValue, comment, selectKey
      }
    });
  }
</script>

<Modal {open} onClose={onCancel}>
  <div class="header">
    <button
      type="button"
      class="badge-tap"
      aria-label="{symptom.name} — Doppeltipp öffnet die Symptom-Konfiguration"
      ondblclick={() => (configOpen = true)}
    >
      <Badge icon={symptom.icon} color={symptom.color} duotone={symptom.duotone ?? true} bg={symptom.bg ?? true} size={36} />
    </button>
    <h3>{symptom.name}</h3>
  </div>

  <section>
    <div class="caption">Datum</div>
    <label class="date-row">
      <span class="date-label">{formatLong(workingDate)}</span>
      <input type="date" value={workingDate} oninput={onDateChange} onclick={openDatePicker} aria-label="Datum ändern" />
    </label>
  </section>

  {#if symptom.inputs.slider.enabled}
    <section>
      <div class="caption">
        Intensität
        {#if symptom.inputs.slider.required}<span class="req">*</span>{/if}
      </div>
      <SliderInput
        value={sliderValue}
        lowLabel={symptom.inputs.slider.lowLabel}
        highLabel={symptom.inputs.slider.highLabel}
        onChange={(v) => (sliderValue = v)}
      />
    </section>
  {/if}

  {#if symptom.inputs.number.enabled}
    <section>
      <div class="caption">
        Anzahl
        {#if symptom.inputs.number.required}<span class="req">*</span>{/if}
      </div>
      <NumberInput
        value={numberValue}
        unit={symptom.inputs.number.unit}
        integer={symptom.inputs.number.integer}
        onChange={(v) => (numberValue = v)}
      />
    </section>
  {/if}

  {#if symptom.inputs.select?.enabled}
    <section>
      <div class="caption">
        Auswahl
        {#if symptom.inputs.select.required}<span class="req">*</span>{/if}
      </div>
      <SelectInput
        value={selectKey}
        options={symptom.inputs.select.options}
        onChange={(k) => (selectKey = k)}
      />
    </section>
  {/if}

  {#if symptom.inputs.comment.enabled}
    <section>
      <div class="caption">
        Kommentar
        {#if symptom.inputs.comment.required}<span class="req">*</span>{/if}
      </div>
      <textarea class="comment" rows={3} placeholder="z.B. Auslöser, Umstände…" bind:value={comment}></textarea>
    </section>
  {/if}

  {#snippet footer()}
    <button type="button" class="discard" onclick={onDelete}>Löschen</button>
    <button type="button" class="primary" onclick={onSave} disabled={!validation.ok}>Speichern</button>
  {/snippet}
</Modal>

{#if configOpen}
  <SymptomEditModal open={true} {symptom} onClose={onConfigClose} />
{/if}

<style>
  /* Reserve right-edge real estate so the title doesn't slip under the
     Modal's own X-close button at top:sp-3, right:sp-3 (≈44px wide overall). */
  .header { display: flex; align-items: center; gap: var(--sp-3); margin-bottom: var(--sp-4); padding-right: 44px; }
  .header h3 { margin: 0; font-size: var(--fs-lg); flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; }
  /* Badge is wrapped in a tap target — double-tap opens the symptom config
     dialog (hidden feature, no visible chrome). touch-action: manipulation
     disables the iOS double-tap zoom on this element so the dblclick fires
     reliably. */
  .badge-tap {
    border: 0;
    background: none;
    padding: 0;
    cursor: pointer;
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
  }
  .caption { font-size: var(--fs-xs); color: var(--c-text-dim); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: var(--sp-2); }
  .req { color: var(--c-danger); margin-left: 4px; }
  section { margin-bottom: var(--sp-4); }
  .comment { width: 100%; padding: var(--sp-3); border: 1px solid var(--c-border); border-radius: var(--r-2); resize: vertical; font: inherit; box-sizing: border-box; }
  .primary { background: var(--c-primary); color: var(--c-primary-contrast); border: 0; padding: var(--sp-3); border-radius: var(--r-2); font-weight: var(--fw-bold); cursor: pointer; }
  .primary[disabled] { opacity: 0.4; cursor: not-allowed; }
  .discard { color: var(--c-danger); background: var(--c-surface-2); border: 1px solid var(--c-danger); padding: var(--sp-3); border-radius: var(--r-2); cursor: pointer; }
  .date-row {
    display: inline-flex; align-items: center; gap: var(--sp-2);
    padding: var(--sp-3); border: 1px solid var(--c-border); border-radius: var(--r-2);
    position: relative; cursor: pointer; width: 100%; box-sizing: border-box;
  }
  .date-row::after { content: '📅'; margin-left: auto; opacity: 0.7; }
  .date-row input[type="date"] { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
  .date-label { font-weight: var(--fw-medium); }
</style>
