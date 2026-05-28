<script lang="ts">
  import { untrack } from 'svelte';
  import Modal from '$lib/components/ui/Modal.svelte';
  import Badge from '$lib/components/ui/Badge.svelte';
  import ColorPicker from '$lib/components/ui/ColorPicker.svelte';
  import IconPicker from '$lib/components/ui/IconPicker.svelte';
  import ConfirmModal from '$lib/components/ui/ConfirmModal.svelte';
  import InputConfigSection from './InputConfigSection.svelte';
  import {
    createSymptom,
    updateSymptom,
    archiveSymptom,
    moveSymptom,
    listAllSymptoms
  } from '$lib/db/symptoms';
  import { liveQuery } from '$lib/stores/liveQuery.svelte';
  import { db, type Symptom, type Tag, defaultSymptomInputs, type SymptomInputs } from '$lib/db';
  import { persistDialog, updateDialogPayload, clearDialog } from '$lib/stores/openDialog.svelte';
  import { page } from '$app/state';

  type Props = {
    open: boolean;
    symptom: Symptom;
    isNew?: boolean;
    onClose: () => void;
  };
  let { open, symptom, isNew = false, onClose }: Props = $props();

  let name = $state(untrack(() => symptom.name));
  let color = $state(untrack(() => symptom.color));
  let icon = $state(untrack(() => symptom.icon));
  let tagIds = $state(untrack(() => [...symptom.tagIds]));
  let parentId = $state<string | null>(untrack(() => symptom.parentId));
  let inputs = $state<SymptomInputs>(untrack(() => symptom.inputs ?? defaultSymptomInputs()));
  let daily = $state(untrack(() => symptom.daily ?? false));
  let view = $state<'main' | 'icons'>('main');

  $effect(() => {
    name = symptom.name;
    color = symptom.color;
    icon = symptom.icon;
    tagIds = [...symptom.tagIds];
    parentId = symptom.parentId;
    inputs = symptom.inputs ?? defaultSymptomInputs();
    daily = symptom.daily ?? false;
    view = 'main';
  });

  $effect(() => {
    if (!open) return;
    void persistDialog({
      kind: 'symptom-edit',
      route: page.url.pathname,
      payload: {
        symptomId: isNew ? null : symptom.id,
        isNew,
        isFolder: symptom.isFolder,
        name, color, icon,
        tagIds: $state.snapshot(tagIds),
        parentId,
        inputs: $state.snapshot(inputs),
        daily,
        view
      }
    });
  });

  $effect(() => {
    if (!open) return;
    void updateDialogPayload({
      name, color, icon,
      tagIds: $state.snapshot(tagIds),
      parentId,
      inputs: $state.snapshot(inputs),
      daily,
      view
    });
  });

  const tagsQ = liveQuery(() => db.tags.toArray(), [] as Tag[]);
  const allQ = liveQuery(() => listAllSymptoms(), [] as Symptom[]);
  $effect(() => () => { tagsQ.dispose(); allQ.dispose(); });

  function toggleTag(id: string) {
    tagIds = tagIds.includes(id) ? tagIds.filter((t) => t !== id) : [...tagIds, id];
  }

  async function save() {
    const trimmedName = name.trim();
    if (!trimmedName) return;
    const snapTags = $state.snapshot(tagIds);
    const snapInputs = $state.snapshot(inputs) as SymptomInputs;
    if (isNew) {
      await createSymptom({
        name: trimmedName,
        isFolder: symptom.isFolder,
        parentId,
        color,
        icon,
        tagIds: snapTags,
        inputs: snapInputs,
        daily
      });
    } else {
      await updateSymptom(symptom.id, { name: trimmedName, color, icon, tagIds: snapTags, inputs: snapInputs, daily });
      if (parentId !== symptom.parentId) {
        await moveSymptom(symptom.id, parentId);
      }
    }
    await clearDialog();
    onClose();
  }

  let archiveConfirm = $state(false);
  function startArchive() { archiveConfirm = true; }
  async function doArchive() {
    archiveConfirm = false;
    await archiveSymptom(symptom.id);
    await clearDialog();
    onClose();
  }

  async function onCancel() {
    await clearDialog();
    onClose();
  }

  const title = $derived(
    isNew
      ? (symptom.isFolder ? 'Neuer Ordner' : 'Neues Symptom')
      : (symptom.isFolder ? 'Ordner bearbeiten' : 'Symptom bearbeiten')
  );
</script>

<Modal {open} onClose={onCancel} {title}>
  {#if view === 'icons'}
    <IconPicker value={icon} {color} onChange={(i) => { icon = i; view = 'main'; }} />
    <button type="button" class="link" onclick={() => view = 'main'}>‹ Zurück</button>
  {:else}
    <div class="preview"><Badge {icon} {color} size={36} /><strong>{name || '—'}</strong></div>

    <label class="field">
      <span>Name</span>
      <input type="text" bind:value={name} placeholder={symptom.isFolder ? 'z.B. Körperlich' : 'z.B. Hitzewallungen'} />
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

    {#if !symptom.isFolder}
      <InputConfigSection
        {inputs}
        {daily}
        onInputsChange={(n) => (inputs = n)}
        onDailyChange={(n) => (daily = n)}
      />
    {/if}

    <button type="button" class="primary" onclick={save} disabled={!name.trim()}>
      {isNew ? 'Anlegen' : 'Speichern'}
    </button>
    {#if !isNew}
      <button type="button" class="danger" onclick={startArchive}>Archivieren</button>
    {/if}
  {/if}
</Modal>

{#if !isNew}
  <ConfirmModal
    open={archiveConfirm}
    title={symptom.isFolder ? 'Ordner archivieren?' : 'Symptom archivieren?'}
    message={`„${symptom.name}" wird ausgeblendet. Vorhandene Einträge bleiben erhalten.`}
    confirmLabel="Archivieren"
    danger
    onConfirm={doArchive}
    onCancel={() => (archiveConfirm = false)}
  />
{/if}

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
  .primary[disabled] { opacity: 0.4; cursor: not-allowed; }
  .danger { display: block; margin: var(--sp-3) auto 0; color: var(--c-danger); background: none; border: 0; cursor: pointer; }
  .link { background: none; border: 0; color: var(--c-text-dim); cursor: pointer; }
</style>
