<script lang="ts">
  import { untrack } from 'svelte';
  import Modal from '$lib/components/ui/Modal.svelte';
  import Badge from '$lib/components/ui/Badge.svelte';
  import { upsertEntry, deleteEntry, getEntry } from '$lib/db/entries';
  import { db, type Symptom, type Intensity } from '$lib/db';
  import { snackbar } from '$lib/stores/snackbar.svelte';
  import { isValidDateKey, formatLong } from '$lib/utils/date';

  type Props = { open: boolean; date: string; symptom: Symptom; onClose: () => void };
  let { open, date, symptom, onClose }: Props = $props();

  // workingDate tracks the entry's current date. Moves the entry between dates
  // when the user picks a new value.
  let workingDate = $state(untrack(() => date));
  let intensity = $state<Intensity>(null);
  let comment = $state('');

  $effect(() => {
    if (!open) return;
    workingDate = date;
    (async () => {
      const e = await getEntry(date, symptom.id);
      intensity = e?.intensity ?? null;
      comment = e?.comment ?? '';
    })();
  });

  const LEVELS: { value: Intensity; label: string }[] = [
    { value: null, label: '— ohne' },
    { value: 'leicht', label: 'Leicht' },
    { value: 'mittel', label: 'Mittel' },
    { value: 'stark', label: 'Stark' }
  ];

  async function pick(v: Intensity) {
    intensity = v;
    await upsertEntry({ date: workingDate, symptomId: symptom.id, intensity: v });
  }

  async function onCommentBlur(e: FocusEvent) {
    const v = (e.target as HTMLTextAreaElement).value;
    comment = v;
    await upsertEntry({ date: workingDate, symptomId: symptom.id, comment: v });
  }

  async function onDateChange(e: Event) {
    const v = (e.target as HTMLInputElement).value;
    if (!v || !isValidDateKey(v) || v === workingDate) return;
    const oldDate = workingDate;
    await db.transaction('rw', db.entries, async () => {
      const existing = await getEntry(oldDate, symptom.id);
      const carry = existing ?? { intensity, comment };
      await deleteEntry(oldDate, symptom.id);
      await upsertEntry({
        date: v,
        symptomId: symptom.id,
        intensity: carry.intensity,
        comment: carry.comment
      });
    });
    workingDate = v;
    snackbar.show({
      message: `Eintrag nach ${formatLong(v)} verschoben`,
      actionLabel: 'Rückgängig',
      onAction: async () => {
        await db.transaction('rw', db.entries, async () => {
          await deleteEntry(v, symptom.id);
          await upsertEntry({ date: oldDate, symptomId: symptom.id, intensity, comment });
        });
        workingDate = oldDate;
      }
    });
  }

  function openDatePicker(e: MouseEvent) {
    const el = e.currentTarget as HTMLInputElement;
    if (typeof el.showPicker === 'function') {
      try { el.showPicker(); } catch { /* needs a user gesture; we have one */ }
    }
  }

  async function remove() {
    await deleteEntry(workingDate, symptom.id);
    const carry = { date: workingDate, intensity, comment };
    snackbar.show({
      message: `${symptom.name} entfernt`,
      actionLabel: 'Rückgängig',
      onAction: async () => {
        await upsertEntry({
          date: carry.date,
          symptomId: symptom.id,
          intensity: carry.intensity,
          comment: carry.comment
        });
      }
    });
    onClose();
  }
</script>

<Modal {open} {onClose}>
  <div class="header">
    <Badge icon={symptom.icon} color={symptom.color} size={36} />
    <h3>{symptom.name}</h3>
  </div>

  <section>
    <div class="caption">Datum</div>
    <label class="date-row">
      <span class="date-label">{formatLong(workingDate)}</span>
      <input
        type="date"
        value={workingDate}
        oninput={onDateChange}
        onclick={openDatePicker}
        aria-label="Datum ändern"
      />
    </label>
  </section>

  <section>
    <div class="caption">Intensität</div>
    <div class="row">
      {#each LEVELS as lvl}
        <button
          type="button"
          class="ibtn {intensity === lvl.value ? 'active' : ''}"
          onclick={() => pick(lvl.value)}
        >{lvl.label}</button>
      {/each}
    </div>
  </section>

  <section>
    <div class="caption">Kommentar (optional)</div>
    <textarea
      class="comment"
      placeholder="z.B. Auslöser, Umstände…"
      bind:value={comment}
      onblur={onCommentBlur}
      rows={3}
    ></textarea>
  </section>

  <button type="button" class="primary" onclick={onClose}>Fertig</button>
  <button type="button" class="danger" onclick={remove}>🗑 Eintrag entfernen</button>
</Modal>

<style>
  .header { display: flex; align-items: center; gap: var(--sp-3); margin-bottom: var(--sp-4); }
  .header h3 { margin: 0; font-size: var(--fs-lg); }
  .caption { font-size: var(--fs-xs); color: var(--c-text-dim); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: var(--sp-2); }
  .row { display: flex; gap: var(--sp-2); margin-bottom: var(--sp-4); }
  .ibtn { flex: 1; padding: var(--sp-3); border-radius: var(--r-2); border: 1px solid var(--c-border); background: var(--c-surface); cursor: pointer; }
  .ibtn.active { background: var(--c-primary); color: var(--c-primary-contrast); border-color: var(--c-primary); }
  .comment { width: 100%; padding: var(--sp-3); border: 1px solid var(--c-border); border-radius: var(--r-2); resize: vertical; font: inherit; box-sizing: border-box; }
  section { margin-bottom: var(--sp-4); }
  .primary { width: 100%; background: var(--c-primary); color: var(--c-primary-contrast); border: 0; padding: var(--sp-3); border-radius: var(--r-2); font-weight: var(--fw-bold); cursor: pointer; }
  .danger { display: block; margin: var(--sp-3) auto 0; color: var(--c-danger); background: none; border: 0; cursor: pointer; }

  .date-row {
    display: inline-flex; align-items: center; gap: var(--sp-2);
    padding: var(--sp-3); border: 1px solid var(--c-border); border-radius: var(--r-2);
    position: relative; cursor: pointer; width: 100%; box-sizing: border-box;
  }
  .date-row::after {
    content: '📅'; margin-left: auto; opacity: 0.7;
  }
  .date-row input[type="date"] {
    position: absolute; inset: 0; opacity: 0; cursor: pointer;
  }
  .date-label { font-weight: var(--fw-medium); }
</style>
