<script lang="ts">
  import { liveQuery } from '$lib/stores/liveQuery.svelte';
  import { listTags, createTag, renameTag, deleteTag, countSymptomsUsingTag } from '$lib/db/tags';
  import type { Tag } from '$lib/db';
  import { Plus, Pencil, Trash2 } from '@lucide/svelte';

  const tagsQ = liveQuery(() => listTags(), [] as Tag[]);
  $effect(() => () => tagsQ.dispose());

  async function add() {
    const name = prompt('Tag-Name?');
    if (name) await createTag(name);
  }
  async function rename(t: Tag) {
    const n = prompt('Neuer Name?', t.name);
    if (n) await renameTag(t.id, n);
  }
  async function remove(t: Tag) {
    const n = await countSymptomsUsingTag(t.id);
    if (n > 0 && !confirm(`Tag "${t.name}" wird von ${n} Symptomen entfernt. Trotzdem löschen?`)) return;
    if (n === 0 && !confirm(`Tag "${t.name}" löschen?`)) return;
    await deleteTag(t.id);
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
      <button type="button" onclick={() => rename(t)} aria-label="Umbenennen"><Pencil size={16} /></button>
      <button type="button" onclick={() => remove(t)} aria-label="Löschen"><Trash2 size={16} /></button>
    </li>
  {/each}
  {#if tagsQ.current.length === 0}<li class="empty">Keine Tags vorhanden.</li>{/if}
</ul>

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
