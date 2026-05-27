<script lang="ts">
  import Modal from '$lib/components/ui/Modal.svelte';
  import Badge from '$lib/components/ui/Badge.svelte';
  import { upsertEntry, deleteEntry, getEntry } from '$lib/db/entries';
  import { snackbar } from '$lib/stores/snackbar.svelte';
  import type { Symptom, Intensity } from '$lib/db';

  type Props = { open: boolean; date: string; symptom: Symptom; onClose: () => void };
  let { open, date, symptom, onClose }: Props = $props();

  let intensity = $state<Intensity>(null);
  let comment = $state('');

  $effect(() => {
    if (!open) return;
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
    await upsertEntry({ date, symptomId: symptom.id, intensity: v });
  }

  async function onCommentBlur(e: FocusEvent) {
    const v = (e.target as HTMLTextAreaElement).value;
    comment = v;
    await upsertEntry({ date, symptomId: symptom.id, comment: v });
  }

  async function remove() {
    await deleteEntry(date, symptom.id);
    snackbar.show({
      message: `${symptom.name} entfernt`,
      actionLabel: 'Rückgängig',
      onAction: async () => {
        await upsertEntry({ date, symptomId: symptom.id, intensity, comment });
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
  .comment { width: 100%; padding: var(--sp-3); border: 1px solid var(--c-border); border-radius: var(--r-2); resize: vertical; font: inherit; }
  section { margin-bottom: var(--sp-4); }
  .primary { width: 100%; background: var(--c-primary); color: var(--c-primary-contrast); border: 0; padding: var(--sp-3); border-radius: var(--r-2); font-weight: var(--fw-bold); cursor: pointer; }
  .danger { display: block; margin: var(--sp-3) auto 0; color: var(--c-danger); background: none; border: 0; cursor: pointer; }
</style>
