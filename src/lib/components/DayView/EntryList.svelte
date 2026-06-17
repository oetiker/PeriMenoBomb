<script lang="ts">
  import EntryCard from './EntryCard.svelte';
  import DailyPromptCard from './DailyPromptCard.svelte';
  import EntryEditor from '$lib/components/EntryEditor/EntryEditor.svelte';
  import { liveQueryEffect } from '$lib/stores/liveQuery.svelte';
  import { db, type Symptom, type Entry } from '$lib/db';
  import { deleteEntry, upsertEntry, listEntriesForDate, streakEndingOn } from '$lib/db/entries';
  import { listDailySymptomsForDate } from '$lib/db/symptoms';
  import { snackbar } from '$lib/stores/snackbar.svelte';
  import { todayKey } from '$lib/utils/date';

  type Props = { date: string };
  let { date }: Props = $props();

  const entriesQ = liveQueryEffect(() => listEntriesForDate(date), [] as Entry[], () => date);
  const symptomsQ = liveQueryEffect(() => db.symptoms.toArray(), [] as Symptom[]);
  const dailyQ = liveQueryEffect(() => listDailySymptomsForDate(date), [] as Symptom[], () => date);
  const symptomMap = $derived(new Map(symptomsQ.current.map((s) => [s.id, s])));

  // Flat position of each symptom in the symptom-list display order: a
  // depth-first walk of the tree, siblings by sortIndex. Used to sort the day's
  // entries so they read in the same order as the symptom list (just flattened).
  const orderIndex = $derived.by(() => {
    const byParent = new Map<string | null, Symptom[]>();
    for (const s of symptomsQ.current) {
      const list = byParent.get(s.parentId) ?? [];
      list.push(s);
      byParent.set(s.parentId, list);
    }
    for (const list of byParent.values()) list.sort((a, b) => a.sortIndex - b.sortIndex);
    const index = new Map<string, number>();
    let i = 0;
    const walk = (parent: string | null) => {
      for (const s of byParent.get(parent) ?? []) {
        index.set(s.id, i++);
        walk(s.id);
      }
    };
    walk(null);
    return index;
  });

  const sortedEntries = $derived(
    [...entriesQ.current].sort(
      (a, b) => (orderIndex.get(a.symptomId) ?? Infinity) - (orderIndex.get(b.symptomId) ?? Infinity)
    )
  );

  // Consecutive-day run ending on the viewed date, per logged symptom. Stays
  // live because streakEndingOn reads the entries table inside the liveQuery.
  const streaksQ = liveQueryEffect(
    async () => {
      const map: Record<string, number> = {};
      for (const e of entriesQ.current) {
        map[e.symptomId] = await streakEndingOn(e.symptomId, date);
      }
      return map;
    },
    {} as Record<string, number>,
    () => [date, entriesQ.current]
  );

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
          values: original.values
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

  {#each sortedEntries as e (e.id)}
    {@const s = symptomMap.get(e.symptomId)}
    {#if s}
      <EntryCard entry={e} symptom={s} streak={streaksQ.current[e.symptomId] ?? 1} onTap={() => openForEntry(e, s)} onSwipe={() => removeWithUndo(e, s)} />
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
