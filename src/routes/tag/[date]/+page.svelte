<script lang="ts">
  import DateHeader from '$lib/components/DayView/DateHeader.svelte';
  import EntryList from '$lib/components/DayView/EntryList.svelte';
  import SymptomSheet from '$lib/components/SymptomSheet/SymptomSheet.svelte';
  import EntryEditor from '$lib/components/EntryEditor/EntryEditor.svelte';
  import Fab from '$lib/components/ui/Fab.svelte';
  import { currentDate } from '$lib/stores/currentDate.svelte';
  import { liveQueryEffect } from '$lib/stores/liveQuery.svelte';
  import { db, type Symptom, type Entry } from '$lib/db';
  import { listEntriesForDate, upsertEntry } from '$lib/db/entries';

  let { data } = $props();
  $effect(() => { currentDate.set(data.date); });

  let sheetOpen = $state(false);
  let editing = $state<{ symptom: Symptom } | null>(null);

  const entriesQ = liveQueryEffect(() => listEntriesForDate(currentDate.value), [] as Entry[]);
  const symptomsQ = liveQueryEffect(() => db.symptoms.toArray(), [] as Symptom[]);

  const enteredIds = $derived(new Set(entriesQ.current.map((e) => e.symptomId)));

  async function onPick(symptomId: string) {
    await upsertEntry({ date: currentDate.value, symptomId });
    const sym = symptomsQ.current.find((s) => s.id === symptomId);
    if (sym) editing = { symptom: sym };
  }
</script>

<DateHeader />
<EntryList date={currentDate.value} />

<Fab onClick={() => sheetOpen = true} />

<SymptomSheet open={sheetOpen} onClose={() => sheetOpen = false} {onPick} {enteredIds} />

{#if editing}
  <EntryEditor open={true} date={currentDate.value} symptom={editing.symptom} onClose={() => editing = null} />
{/if}
