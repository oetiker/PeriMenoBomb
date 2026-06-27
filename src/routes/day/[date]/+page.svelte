<script lang="ts">
  import DateHeader from '$lib/components/DayView/DateHeader.svelte';
  import StatusBar from '$lib/components/DayView/StatusBar.svelte';
  import StatusBarConfig from '$lib/components/DayView/StatusBarConfig.svelte';
  import EntryList from '$lib/components/DayView/EntryList.svelte';
  import SymptomSheet from '$lib/components/SymptomSheet/SymptomSheet.svelte';
  import EntryEditor from '$lib/components/EntryEditor/EntryEditor.svelte';
  import Fab from '$lib/components/ui/Fab.svelte';
  import FirstRun from '$lib/components/DayView/FirstRun.svelte';
  import BackupReminder from '$lib/components/DayView/BackupReminder.svelte';
  import { currentDate } from '$lib/stores/currentDate.svelte';
  import { liveQuery, liveQueryEffect } from '$lib/stores/liveQuery.svelte';
  import { db, type Symptom, type Entry } from '$lib/db';
  import { listEntriesForDate } from '$lib/db/entries';
  import { shouldShowFirstRun } from '$lib/db/meta';
  import { performBackup, getReminderDays, getLastBackupAt } from '$lib/db/backup';
  import { isBackupDue, daysSinceBackup } from '$lib/utils/backup';
  import { autoBackupHealth } from '$lib/db/fsBackup';
  import { loadStatusItems, saveStatusItems, type StatusItem } from '$lib/db/statusBar';
  import { pendingRestore } from '$lib/stores/openDialog.svelte';

  let { data } = $props();
  $effect(() => { currentDate.set(data.date); });

  let sheetOpen = $state(false);
  let editing = $state<{ symptom: Symptom } | null>(null);
  let restoreInitial = $state<
    | { values: Record<string, number | string | null>; workingDate: string }
    | null
  >(null);

  const showWelcomeQ = liveQuery(async () => await shouldShowFirstRun(), false);
  $effect(() => () => showWelcomeQ.dispose());

  // Backup reminder: due-ness is recomputed whenever the meta table changes
  // (interval edited, or a backup stamped). `daysSince` feeds the banner text.
  const backupQ = liveQuery(
    async () => {
      const health = await autoBackupHealth();
      // Auto-backup on and healthy → no reminder at all.
      if (health.enabled && health.healthy) return { due: false, broken: false, daysSince: null as number | null };
      // Auto-backup on but broken → show the "interrupted" warning regardless of interval.
      if (health.enabled && !health.healthy) return { due: true, broken: true, daysSince: null as number | null };
      const [days, last] = await Promise.all([getReminderDays(), getLastBackupAt()]);
      const now = Date.now();
      return { due: isBackupDue(days, last, now), broken: false, daysSince: daysSinceBackup(last, now) };
    },
    { due: false, broken: false, daysSince: null as number | null }
  );
  $effect(() => () => backupQ.dispose());
  let backupDismissed = $state(false);
  async function onBackupNow() {
    await performBackup();
  }

  const entriesQ = liveQueryEffect(
    () => listEntriesForDate(currentDate.value),
    [] as Entry[],
    () => currentDate.value
  );
  const symptomsQ = liveQueryEffect(() => db.symptoms.toArray(), [] as Symptom[]);

  const enteredIds = $derived(new Set(entriesQ.current.map((e) => e.symptomId)));

  // Status bar: configured items live in `meta`; the picker only offers leaf,
  // non-archived symptoms (folders can't be logged).
  const statusItemsQ = liveQueryEffect(() => loadStatusItems(), [] as StatusItem[]);
  const selectableSymptoms = $derived(symptomsQ.current.filter((s) => !s.isFolder && !s.archived));
  let statusConfigOpen = $state(false);

  async function onSaveStatus(items: StatusItem[]) {
    await saveStatusItems(items);
  }

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
      values: r.payload.values,
      workingDate: r.payload.date
    };
  });
</script>

{#if showWelcomeQ.current}
  <FirstRun />
{:else}
  {#if backupQ.current.due && !backupDismissed}
    <BackupReminder
      daysSince={backupQ.current.daysSince}
      broken={backupQ.current.broken}
      onBackup={onBackupNow}
      onDismiss={() => (backupDismissed = true)}
    />
  {/if}
  <DateHeader />
  <StatusBar
    date={currentDate.value}
    items={statusItemsQ.current}
    symptoms={selectableSymptoms}
    onConfigure={() => (statusConfigOpen = true)}
  />
  <EntryList date={currentDate.value} />

  <StatusBarConfig
    open={statusConfigOpen}
    items={statusItemsQ.current}
    symptoms={selectableSymptoms}
    onSave={onSaveStatus}
    onClose={() => (statusConfigOpen = false)}
  />

  <Fab onClick={() => sheetOpen = true} />

  <SymptomSheet open={sheetOpen} onClose={() => sheetOpen = false} {onPick} {enteredIds} />

  {#if editing}
    {@const liveSymptom = symptomsQ.current.find((s) => s.id === editing!.symptom.id) ?? editing.symptom}
    <EntryEditor
      open={true}
      date={restoreInitial?.workingDate ?? currentDate.value}
      symptom={liveSymptom}
      initial={restoreInitial ? { values: restoreInitial.values } : undefined}
      onClose={() => { editing = null; restoreInitial = null; }}
    />
  {/if}
{/if}
