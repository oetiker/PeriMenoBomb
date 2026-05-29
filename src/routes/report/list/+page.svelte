<script lang="ts">
  import { liveQueryEffect } from '$lib/stores/liveQuery.svelte';
  import { db, type Entry, type Symptom, type Tag } from '$lib/db';
  import { listTags } from '$lib/db/tags';
  import { getMeta, setMeta } from '$lib/db/meta';
  import { filterEntries, groupEntriesByDay, type EntryFilter } from '$lib/report/filter';
  import { formatLong, todayKey } from '$lib/utils/date';
  import ReportEntryRow from '$lib/components/report/ReportEntryRow.svelte';
  import { snackbar } from '$lib/stores/snackbar.svelte';

  const FILTER_KEY = 'report.list.filter';

  const entriesQ = liveQueryEffect(() => db.entries.toArray(), [] as Entry[]);
  const symptomsQ = liveQueryEffect(() => db.symptoms.toArray(), [] as Symptom[]);
  const tagsQ = liveQueryEffect(() => listTags(), [] as Tag[]);

  const symptomMap = $derived(new Map(symptomsQ.current.map((s) => [s.id, s])));
  const tagMap = $derived(new Map(tagsQ.current.map((t) => [t.id, t])));
  const selectableSymptoms = $derived(
    symptomsQ.current.filter((s) => !s.isFolder && !s.archived)
      .sort((a, b) => a.name.localeCompare(b.name, 'de', { sensitivity: 'base' }))
  );

  let filter = $state<EntryFilter>({ symptomIds: [], tagIds: [], from: null, to: null });
  let loaded = $state(false);
  $effect(() => {
    if (loaded) return;
    loaded = true;
    void getMeta<EntryFilter>(FILTER_KEY).then((f) => { if (f) filter = { symptomIds: [], tagIds: [], from: null, to: null, ...f }; });
  });
  function persist() { void setMeta(FILTER_KEY, filter); }

  function toggle(list: 'symptomIds' | 'tagIds', id: string) {
    const set = new Set(filter[list] ?? []);
    set.has(id) ? set.delete(id) : set.add(id);
    filter = { ...filter, [list]: [...set] };
    persist();
  }
  function setFrom(e: Event) { filter = { ...filter, from: (e.target as HTMLInputElement).value || null }; persist(); }
  function setTo(e: Event) { filter = { ...filter, to: (e.target as HTMLInputElement).value || null }; persist(); }

  const filtered = $derived(filterEntries(entriesQ.current, symptomMap, filter));
  const groups = $derived(groupEntriesByDay(filtered));

  function tagNamesFor(s: Symptom): string[] {
    return s.tagIds.map((id) => tagMap.get(id)?.name).filter((x): x is string => !!x);
  }

  let exporting = $state(false);
  async function exportPdf() {
    if (exporting) return;
    exporting = true;
    try {
      const { buildEntriesPdfBlob } = await import('$lib/report/pdf');
      const { deliverFile } = await import('$lib/report/deliver');
      const rangeLabel = `${filter.from ? formatLong(filter.from) : 'Anfang'} – ${filter.to ? formatLong(filter.to) : 'heute'}`;
      const symNames = (filter.symptomIds ?? []).map((id) => symptomMap.get(id)?.name).filter(Boolean);
      const tagNames = (filter.tagIds ?? []).map((id) => tagMap.get(id)?.name).filter(Boolean);
      const filterParts = [...symNames, ...tagNames];
      const filterLabel = filterParts.length ? filterParts.join(', ') : 'kein Filter';
      const blob = await buildEntriesPdfBlob(groups, symptomMap, tagMap, {
        title: 'PeriMenoBomb — Verlauf',
        rangeLabel,
        filterLabel,
        generatedLabel: formatLong(todayKey())
      });
      await deliverFile(blob, `verlauf-${todayKey()}.pdf`);
    } catch (err) {
      console.error('PDF export failed', err);
      snackbar.show({ message: 'PDF-Export fehlgeschlagen' });
    } finally {
      exporting = false;
    }
  }
</script>

<section class="list">
  <div class="head">
    <h1>Ereignis-Liste</h1>
    <button type="button" class="export" onclick={exportPdf} disabled={exporting || groups.length === 0}>
      {exporting ? '…' : 'PDF'}
    </button>
  </div>

  <details class="filters">
    <summary>Filter{#if (filter.symptomIds?.length || filter.tagIds?.length || filter.from || filter.to)} (aktiv){/if}</summary>
    <div class="range">
      <label>von <input type="date" value={filter.from ?? ''} oninput={setFrom} /></label>
      <label>bis <input type="date" value={filter.to ?? ''} oninput={setTo} /></label>
    </div>
    {#if tagsQ.current.length}
      <div class="chips" aria-label="Nach Tag filtern">
        {#each tagsQ.current as t (t.id)}
          <button type="button" class="chip {filter.tagIds?.includes(t.id) ? 'on' : ''}" onclick={() => toggle('tagIds', t.id)}>{t.name}</button>
        {/each}
      </div>
    {/if}
    <div class="chips" aria-label="Nach Symptom filtern">
      {#each selectableSymptoms as s (s.id)}
        <button type="button" class="chip {filter.symptomIds?.includes(s.id) ? 'on' : ''}" onclick={() => toggle('symptomIds', s.id)}>{s.name}</button>
      {/each}
    </div>
  </details>

  {#if groups.length === 0}
    <p class="empty">Keine Einträge für diesen Filter.</p>
  {:else}
    {#each groups as g (g.date)}
      <h2 class="day">{formatLong(g.date)}</h2>
      {#each g.entries as e (e.id)}
        {@const s = symptomMap.get(e.symptomId)}
        {#if s}<ReportEntryRow entry={e} symptom={s} tagNames={tagNamesFor(s)} />{/if}
      {/each}
    {/each}
  {/if}
</section>

<style>
  .list { padding: var(--sp-3); }
  .head { display: flex; align-items: center; justify-content: space-between; }
  h1 { font-size: var(--fs-lg); margin: 0; }
  .export { background: var(--c-primary); color: var(--c-primary-contrast); border: 0; padding: var(--sp-2) var(--sp-3); border-radius: var(--r-2); font-weight: var(--fw-bold); cursor: pointer; }
  .export[disabled] { opacity: 0.4; cursor: not-allowed; }
  .filters { margin: var(--sp-3) 0; }
  .filters summary { font-size: var(--fs-sm); color: var(--c-text-dim); cursor: pointer; }
  .range { display: flex; gap: var(--sp-3); margin: var(--sp-2) 0; font-size: var(--fs-sm); }
  .range input { font: inherit; padding: 4px; border: 1px solid var(--c-border); border-radius: var(--r-1); }
  .chips { display: flex; flex-wrap: wrap; gap: var(--sp-2); margin: var(--sp-2) 0; }
  .chip { font-size: var(--fs-xs); padding: 4px var(--sp-2); border: 1px solid var(--c-border); border-radius: 999px; background: var(--c-surface); color: var(--c-text-dim); cursor: pointer; }
  .chip.on { background: var(--c-primary); color: var(--c-primary-contrast); border-color: var(--c-primary); }
  .day { font-size: var(--fs-xs); color: var(--c-text-dim); text-transform: uppercase; letter-spacing: 0.05em; margin: var(--sp-3) 0 var(--sp-2); }
  .empty { color: var(--c-text-dim); text-align: center; padding: var(--sp-5); }
</style>
