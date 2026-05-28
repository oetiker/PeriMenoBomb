<script lang="ts">
  import DateHeader from '$lib/components/DayView/DateHeader.svelte';
  import EntryList from '$lib/components/DayView/EntryList.svelte';
  import SymptomSheet from '$lib/components/SymptomSheet/SymptomSheet.svelte';
  import EntryEditor from '$lib/components/EntryEditor/EntryEditor.svelte';
  import Fab from '$lib/components/ui/Fab.svelte';
  import FirstRun from '$lib/components/DayView/FirstRun.svelte';
  import { currentDate } from '$lib/stores/currentDate.svelte';
  import { liveQuery, liveQueryEffect } from '$lib/stores/liveQuery.svelte';
  import { db, type Symptom, type Entry } from '$lib/db';
  import { listEntriesForDate } from '$lib/db/entries';
  import { getOrDefault } from '$lib/db/meta';
  import { pendingRestore } from '$lib/stores/openDialog.svelte';

  let { data } = $props();
  $effect(() => { currentDate.set(data.date); });

  let sheetOpen = $state(false);
  let editing = $state<{ symptom: Symptom } | null>(null);
  let restoreInitial = $state<
    | { sliderValue: number | null; numberValue: number | null; comment: string; workingDate: string }
    | null
  >(null);

  const firstRunQ = liveQuery(async () => await getOrDefault('firstRunCompleted', false), false);
  $effect(() => () => firstRunQ.dispose());

  const entriesQ = liveQueryEffect(
    () => listEntriesForDate(currentDate.value),
    [] as Entry[],
    () => currentDate.value
  );
  const symptomsQ = liveQueryEffect(() => db.symptoms.toArray(), [] as Symptom[]);

  const enteredIds = $derived(new Set(entriesQ.current.map((e) => e.symptomId)));

  function onPick(symptomId: string) {
    const sym = symptomsQ.current.find((s) => s.id === symptomId);
    if (sym) editing = { symptom: sym };
  }

  // Cold-Start-Restore: sobald die Symptome geladen sind, prüfen wir, ob ein
  // entry-editor-Restore wartet. Erst dann konsumieren, damit der symptomId-
  // Lookup gelingt; sonst würden wir den Restore-Eintrag zu früh verbrauchen.
  $effect.pre(() => {
    if (symptomsQ.current.length === 0) return;
    const r = pendingRestore.consume('entry-editor');
    if (!r) return;
    const sym = symptomsQ.current.find((s) => s.id === r.payload.symptomId);
    if (!sym) return; // Symptom inzwischen archiviert/gelöscht — stillschweigend überspringen
    editing = { symptom: sym };
    restoreInitial = {
      sliderValue: r.payload.sliderValue,
      numberValue: r.payload.numberValue,
      comment: r.payload.comment,
      workingDate: r.payload.date
    };
  });
</script>

{#if !firstRunQ.current}
  <FirstRun />
{:else}
  <DateHeader />
  <EntryList date={currentDate.value} />

  <Fab onClick={() => sheetOpen = true} />

  <SymptomSheet open={sheetOpen} onClose={() => sheetOpen = false} {onPick} {enteredIds} />

  {#if editing}
    <EntryEditor
      open={true}
      date={restoreInitial?.workingDate ?? currentDate.value}
      symptom={editing.symptom}
      initial={restoreInitial
        ? { sliderValue: restoreInitial.sliderValue, numberValue: restoreInitial.numberValue, comment: restoreInitial.comment }
        : undefined}
      onClose={() => { editing = null; restoreInitial = null; }}
    />
  {/if}
{/if}
