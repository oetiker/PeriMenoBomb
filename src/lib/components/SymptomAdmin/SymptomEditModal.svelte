<script lang="ts">
  import Modal from '$lib/components/ui/Modal.svelte';
  import Badge from '$lib/components/ui/Badge.svelte';
  import ColorPicker from '$lib/components/ui/ColorPicker.svelte';
  import IconPicker from '$lib/components/ui/IconPicker.svelte';
  import ConfirmModal from '$lib/components/ui/ConfirmModal.svelte';
  import { updateSymptom, archiveSymptom, moveSymptom, listAllSymptoms } from '$lib/db/symptoms';
  import { liveQuery } from '$lib/stores/liveQuery.svelte';
  import { db, type Symptom, type Tag } from '$lib/db';

  type Props = { open: boolean; symptom: Symptom; onClose: () => void };
  let { open, symptom, onClose }: Props = $props();

  let name = $state(symptom.name);
  let color = $state(symptom.color);
  let icon = $state(symptom.icon);
  let tagIds = $state([...symptom.tagIds]);
  let parentId = $state<string | null>(symptom.parentId);
  let view = $state<'main' | 'icons'>('main');

  $effect(() => {
    name = symptom.name; color = symptom.color; icon = symptom.icon;
    tagIds = [...symptom.tagIds]; parentId = symptom.parentId;
    view = 'main';
  });

  const tagsQ = liveQuery(() => db.tags.toArray(), [] as Tag[]);
  const allQ = liveQuery(() => listAllSymptoms(), [] as Symptom[]);
  $effect(() => () => { tagsQ.dispose(); allQ.dispose(); });

  function toggleTag(id: string) {
    tagIds = tagIds.includes(id) ? tagIds.filter((t) => t !== id) : [...tagIds, id];
  }

  async function save() {
    await updateSymptom(symptom.id, { name, color, icon, tagIds: $state.snapshot(tagIds) });
    if (parentId !== symptom.parentId) {
      await moveSymptom(symptom.id, parentId);
    }
    onClose();
  }

  let archiveConfirm = $state(false);

  function startArchive() {
    archiveConfirm = true;
  }
  async function doArchive() {
    archiveConfirm = false;
    await archiveSymptom(symptom.id);
    onClose();
  }
</script>

<Modal {open} onClose={onClose} title={symptom.isFolder ? 'Ordner bearbeiten' : 'Symptom bearbeiten'}>
  {#if view === 'icons'}
    <IconPicker value={icon} {color} onChange={(i) => { icon = i; view = 'main'; }} />
    <button type="button" class="link" onclick={() => view = 'main'}>‹ Zurück</button>
  {:else}
    <div class="preview"><Badge {icon} {color} size={36} /><strong>{name || '—'}</strong></div>

    <label class="field">
      <span>Name</span>
      <input type="text" bind:value={name} />
    </label>

    <div class="field">
      <span>Icon</span>
      <button type="button" class="icon-btn" onclick={() => view = 'icons'}>
        <Badge {icon} {color} size={28} /> <span class="iname">{icon}</span> ›
      </button>
    </div>

    <div class="field">
      <span>Farbe</span>
      <ColorPicker value={color} onChange={(c) => color = c} />
    </div>

    {#if !symptom.isFolder}
      <div class="field">
        <span>Tags</span>
        <div class="chips">
          {#each tagsQ.current as t}
            <button type="button" class="chip {tagIds.includes(t.id) ? 'on' : ''}" onclick={() => toggleTag(t.id)}>{t.name}</button>
          {/each}
          {#if tagsQ.current.length === 0}<span class="muted">Keine Tags angelegt.</span>{/if}
        </div>
      </div>
    {/if}

    <div class="field">
      <span>Eltern-Ordner</span>
      <select bind:value={parentId}>
        <option value={null}>(Wurzel)</option>
        {#each allQ.current.filter((s) => s.isFolder && s.id !== symptom.id) as f}
          <option value={f.id}>{f.name}</option>
        {/each}
      </select>
    </div>

    <button type="button" class="primary" onclick={save}>Speichern</button>
    <button type="button" class="danger" onclick={startArchive}>Archivieren</button>
  {/if}
</Modal>

<ConfirmModal
  open={archiveConfirm}
  title={symptom.isFolder ? 'Ordner archivieren?' : 'Symptom archivieren?'}
  message={`„${symptom.name}" wird ausgeblendet. Vorhandene Einträge bleiben erhalten.`}
  confirmLabel="Archivieren"
  danger
  onConfirm={doArchive}
  onCancel={() => (archiveConfirm = false)}
/>

<style>
  .preview { display: flex; align-items: center; gap: var(--sp-3); margin-bottom: var(--sp-4); }
  .field { display: flex; flex-direction: column; gap: var(--sp-2); margin-bottom: var(--sp-4); }
  .field > span { font-size: var(--fs-xs); color: var(--c-text-dim); text-transform: uppercase; letter-spacing: 0.05em; }
  input, select { padding: var(--sp-3); border: 1px solid var(--c-border); border-radius: var(--r-2); }
  .icon-btn { display: flex; align-items: center; gap: var(--sp-3); padding: var(--sp-3); border: 1px solid var(--c-border); border-radius: var(--r-2); background: var(--c-surface); cursor: pointer; }
  .iname { font-family: ui-monospace, monospace; flex: 1; text-align: left; }
  .chips { display: flex; flex-wrap: wrap; gap: var(--sp-2); }
  .chip { padding: var(--sp-2) var(--sp-3); border-radius: var(--r-pill); border: 1px solid var(--c-border); background: var(--c-surface); cursor: pointer; }
  .chip.on { background: var(--c-primary); color: var(--c-primary-contrast); border-color: var(--c-primary); }
  .muted { color: var(--c-text-dim); font-size: var(--fs-sm); }
  .primary { width: 100%; background: var(--c-primary); color: var(--c-primary-contrast); border: 0; padding: var(--sp-3); border-radius: var(--r-2); font-weight: var(--fw-bold); cursor: pointer; }
  .danger { display: block; margin: var(--sp-3) auto 0; color: var(--c-danger); background: none; border: 0; cursor: pointer; }
  .link { background: none; border: 0; color: var(--c-text-dim); cursor: pointer; }
</style>
