<script lang="ts">
  import EntryCard from './EntryCard.svelte';
  import EntryEditor from '$lib/components/EntryEditor/EntryEditor.svelte';
  import { liveQueryEffect } from '$lib/stores/liveQuery.svelte';
  import { db, type Symptom, type Entry } from '$lib/db';
  import { deleteEntry, upsertEntry, listEntriesForDate } from '$lib/db/entries';
  import { snackbar } from '$lib/stores/snackbar.svelte';

  type Props = { date: string };
  let { date }: Props = $props();

  // liveQueryEffect re-subscribes when `date` changes — important for date-picker navigation.
  const entriesQ = liveQueryEffect(() => listEntriesForDate(date), [] as Entry[], () => date);
  const symptomsQ = liveQueryEffect(() => db.symptoms.toArray(), [] as Symptom[]);
  const symptomMap = $derived(new Map(symptomsQ.current.map((s) => [s.id, s])));

  let editing = $state<{ entry: Entry; symptom: Symptom } | null>(null);

  async function removeWithUndo(e: Entry, s: Symptom) {
    const original = { ...e };
    await deleteEntry(e.date, e.symptomId);
    snackbar.show({
      message: `${s.name} entfernt`,
      actionLabel: 'Rückgängig',
      onAction: () => upsertEntry({
        date: original.date,
        symptomId: original.symptomId,
        sliderValue: original.sliderValue,
        numberValue: original.numberValue,
        comment: original.comment
      })
    });
  }
</script>

<section>
  <h2 class="section-title">Heute erfasst ({entriesQ.current.length})</h2>

  {#if entriesQ.current.length === 0}
    <p class="empty">Tippe das + unten, um Symptome zu erfassen.</p>
  {/if}

  {#each entriesQ.current as e (e.id)}
    {@const s = symptomMap.get(e.symptomId)}
    {#if s}
      <EntryCard entry={e} symptom={s} onTap={() => editing = { entry: e, symptom: s }} onSwipe={() => removeWithUndo(e, s)} />
    {/if}
  {/each}
</section>

{#if editing}
  <EntryEditor open={true} date={editing.entry.date} symptom={editing.symptom} onClose={() => editing = null} />
{/if}

<style>
  .section-title { font-size: var(--fs-xs); color: var(--c-text-dim); text-transform: uppercase; letter-spacing: 0.05em; margin: var(--sp-3) var(--sp-4) var(--sp-2); }
  .empty { color: var(--c-text-dim); text-align: center; padding: var(--sp-5); }
</style>
