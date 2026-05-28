<script lang="ts">
  import { liveQuery } from '$lib/stores/liveQuery.svelte';
  import { listTags, createTag, renameTag, deleteTag, countSymptomsUsingTag } from '$lib/db/tags';
  import type { Tag } from '$lib/db';
  import { Plus, Pencil, Trash2 } from '@lucide/svelte';
  import PromptModal from '$lib/components/ui/PromptModal.svelte';
  import ConfirmModal from '$lib/components/ui/ConfirmModal.svelte';

  const tagsQ = liveQuery(() => listTags(), [] as Tag[]);
  $effect(() => () => tagsQ.dispose());

  let promptState = $state<
    | { kind: 'add' }
    | { kind: 'rename'; tag: Tag }
    | null
  >(null);
  let confirmState = $state<{ tag: Tag; message: string } | null>(null);

  function add() {
    promptState = { kind: 'add' };
  }
  function startRename(t: Tag) {
    promptState = { kind: 'rename', tag: t };
  }
  async function onPromptSubmit(value: string) {
    const s = promptState;
    promptState = null;
    if (!s) return;
    if (s.kind === 'add') {
      await createTag(value);
    } else {
      await renameTag(s.tag.id, value);
    }
  }

  async function startRemove(t: Tag) {
    const n = await countSymptomsUsingTag(t.id);
    const message =
      n > 0
        ? `Tag „${t.name}" wird von ${n} Symptom${n === 1 ? '' : 'en'} entfernt. Trotzdem löschen?`
        : `Tag „${t.name}" wirklich löschen?`;
    confirmState = { tag: t, message };
  }
  async function onConfirmRemove() {
    const s = confirmState;
    confirmState = null;
    if (s) await deleteTag(s.tag.id);
  }
</script>

<header class="bar">
  <h1>Tags</h1>
  <button type="button" onclick={add}><Plus size={16} /> Neuer Tag</button>
</header>

<ul class="list">
  {#each tagsQ.current as t (t.id)}
    <li class="row">
      <span class="name">{t.name}</span>
      <button type="button" onclick={() => startRename(t)} aria-label="Umbenennen"><Pencil size={16} /></button>
      <button type="button" onclick={() => startRemove(t)} aria-label="Löschen"><Trash2 size={16} /></button>
    </li>
  {/each}
  {#if tagsQ.current.length === 0}<li class="empty">Keine Tags vorhanden.</li>{/if}
</ul>

<PromptModal
  open={promptState !== null}
  title={promptState?.kind === 'rename' ? 'Tag umbenennen' : 'Neuer Tag'}
  label="Name"
  placeholder="z.B. körperlich"
  initialValue={promptState?.kind === 'rename' ? promptState.tag.name : ''}
  onSubmit={onPromptSubmit}
  onCancel={() => (promptState = null)}
/>

<ConfirmModal
  open={confirmState !== null}
  title="Tag löschen?"
  message={confirmState?.message ?? ''}
  confirmLabel="Löschen"
  danger
  onConfirm={onConfirmRemove}
  onCancel={() => (confirmState = null)}
/>

<style>
  .bar { display: flex; align-items: center; justify-content: space-between; padding: var(--sp-4); border-bottom: 1px solid var(--c-border); }
  .bar h1 { margin: 0; font-size: var(--fs-lg); }
  .bar button { display: inline-flex; align-items: center; gap: 4px; padding: var(--sp-2) var(--sp-3); border: 1px solid var(--c-border); border-radius: var(--r-2); background: var(--c-surface); cursor: pointer; }
  .list { list-style: none; margin: 0; padding: 0; }
  .row { display: flex; align-items: center; gap: var(--sp-3); padding: var(--sp-3) var(--sp-4); border-bottom: 1px solid var(--c-border); }
  .name { flex: 1; }
  .row button { background: none; border: 0; color: var(--c-text-dim); cursor: pointer; padding: var(--sp-2); }
  .empty { padding: var(--sp-5); text-align: center; color: var(--c-text-dim); }
</style>
