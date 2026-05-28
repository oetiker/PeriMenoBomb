<script lang="ts">
  import EntryCard from './EntryCard.svelte';
  import DailyPromptCard from './DailyPromptCard.svelte';
  import EntryEditor from '$lib/components/EntryEditor/EntryEditor.svelte';
  import { liveQueryEffect } from '$lib/stores/liveQuery.svelte';
  import { db, type Symptom, type Entry } from '$lib/db';
  import { deleteEntry, upsertEntry, listEntriesForDate } from '$lib/db/entries';
  import { listDailySymptomsForDate } from '$lib/db/symptoms';
  import { snackbar } from '$lib/stores/snackbar.svelte';
  import { todayKey } from '$lib/utils/date';

  type Props = { date: string };
  let { date }: Props = $props();

  const entriesQ = liveQueryEffect(() => listEntriesForDate(date), [] as Entry[], () => date);
  const symptomsQ = liveQueryEffect(() => db.symptoms.toArray(), [] as Symptom[]);
  const dailyQ = liveQueryEffect(() => listDailySymptomsForDate(date), [] as Symptom[], () => date);
  const symptomMap = $derived(new Map(symptomsQ.current.map((s) => [s.id, s])));

  let editing = $state<{ entry: Entry | null; symptom: Symptom; date: string } | null>(null);

  function openForDailyPrompt(s: Symptom) {
    editing = { entry: null, symptom: s, date };
  }
  function openForEntry(e: Entry, s: Symptom) {
    editing = { entry: e, symptom: s, date: e.date };
  }

  async function removeWithUndo(e: Entry, s: Symptom) {
    const original = { ...e };
    await deleteEntry(e.date, e.symptomId);
    snackbar.show({
      message: `${s.name} entfernt`,
      actionLabel: 'Rückgängig',
      onAction: async () => {
        await upsertEntry({
          date: original.date,
          symptomId: original.symptomId,
          sliderValue: original.sliderValue,
          numberValue: original.numberValue,
          comment: original.comment
        });
      }
    });
  }

  const erfasstTitle = $derived(date === todayKey() ? 'Heute erfasst' : 'Erfasst');
</script>

{#if dailyQ.current.length > 0}
  <section>
    <h2 class="section-title">Noch offen</h2>
    {#each dailyQ.current as s (s.id)}
      <DailyPromptCard symptom={s} onTap={() => openForDailyPrompt(s)} />
    {/each}
  </section>
{/if}

<section>
  <h2 class="section-title">{erfasstTitle} ({entriesQ.current.length})</h2>

  {#if entriesQ.current.length === 0 && dailyQ.current.length === 0}
    <p class="empty">Tippe das + unten, um Symptome zu erfassen.</p>
  {/if}

  {#each entriesQ.current as e (e.id)}
    {@const s = symptomMap.get(e.symptomId)}
    {#if s}
      <EntryCard entry={e} symptom={s} onTap={() => openForEntry(e, s)} onSwipe={() => removeWithUndo(e, s)} />
    {/if}
  {/each}
</section>

{#if editing}
  <EntryEditor open={true} date={editing.date} symptom={editing.symptom} onClose={() => editing = null} />
{/if}

<style>
  /* Cards align with section-title left/right edges. The section's horizontal
     margin sets the column gutter; cards inherit it via their parent <section>. */
  section { margin: 0 var(--sp-4); }
  .section-title { font-size: var(--fs-xs); color: var(--c-text-dim); text-transform: uppercase; letter-spacing: 0.05em; margin: var(--sp-3) 0 var(--sp-2); }
  .empty { color: var(--c-text-dim); text-align: center; padding: var(--sp-5); }
</style>
