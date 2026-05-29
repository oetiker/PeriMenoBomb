<script lang="ts">
  import { liveQueryEffect } from '$lib/stores/liveQuery.svelte';
  import { listOccurrenceDates } from '$lib/db/entries';
  import { listAllSymptoms } from '$lib/db/symptoms';
  import { getMeta, setMeta } from '$lib/db/meta';
  import { computeIntervals, intervalStats } from '$lib/report/intervals';
  import { todayKey, daysBetweenKeys, formatLong } from '$lib/utils/date';
  import Badge from '$lib/components/ui/Badge.svelte';
  import type { Symptom } from '$lib/db';

  // Selectable symptoms: real (non-folder, non-archived), sorted by name.
  const symptomsQ = liveQueryEffect(
    async () => (await listAllSymptoms()).filter((s) => !s.isFolder && !s.archived),
    [] as Symptom[]
  );
  const symptoms = $derived(
    [...symptomsQ.current].sort((a, b) => a.name.localeCompare(b.name, 'de', { sensitivity: 'base' }))
  );

  let selectedId = $state<string | null>(null);

  // Load persisted selection once; fall back to the first available symptom.
  let loaded = $state(false);
  $effect(() => {
    if (loaded) return;
    loaded = true;
    void getMeta<string>('report.since.symptomId').then((id) => { selectedId = id ?? null; });
  });
  $effect(() => {
    if (symptoms.length === 0) return;
    if (selectedId === null || !symptoms.some((s) => s.id === selectedId)) {
      selectedId = symptoms[0].id;
    }
  });

  function onSelect(e: Event) {
    selectedId = (e.target as HTMLSelectElement).value;
    void setMeta('report.since.symptomId', selectedId);
  }

  const selected = $derived(symptoms.find((s) => s.id === selectedId) ?? null);

  const datesQ = liveQueryEffect(
    () => (selectedId ? listOccurrenceDates(selectedId) : Promise.resolve([] as string[])),
    [] as string[],
    () => selectedId
  );

  const intervals = $derived(computeIntervals(datesQ.current));
  const stats = $derived(intervalStats(intervals));
  const last = $derived(datesQ.current.length ? datesQ.current[datesQ.current.length - 1] : null);
  const daysSince = $derived(last ? Math.max(0, daysBetweenKeys(todayKey(), last)) : null);
</script>

<section class="since">
  <h1>Tage seit letztem Symptom</h1>

  <label class="picker">
    <span class="cap">Symptom</span>
    {#if selected}
      <span class="badge"><Badge icon={selected.icon} color={selected.color} duotone={selected.duotone ?? true} bg={selected.bg ?? true} size={20} /></span>
    {/if}
    <select onchange={onSelect} value={selectedId ?? ''} aria-label="Symptom wählen">
      {#each symptoms as s (s.id)}
        <option value={s.id}>{s.name}</option>
      {/each}
    </select>
  </label>

  {#if datesQ.current.length === 0}
    <p class="empty">Noch keine Erfassung für dieses Symptom.</p>
  {:else}
    <div class="counter">
      <div class="big">{daysSince}</div>
      <div class="lbl">{daysSince === 1 ? 'Tag' : 'Tage'} seit {selected?.name}</div>
      <div class="meta">letzte Erfassung: {formatLong(last!)}</div>
    </div>

    {#if intervals.length === 0}
      <p class="hint">Noch kein Abstand — erst ab der zweiten Erfassung.</p>
    {:else}
      <h2 class="sec">Letzte Abstände</h2>
      <ul class="intervals">
        {#each intervals as iv (iv.from + iv.to)}
          <li><span>{formatLong(iv.from)} → {formatLong(iv.to)}</span><b>{iv.days} T</b></li>
        {/each}
      </ul>
      <p class="stats">Ø {stats.avg} Tage · kürzest {stats.min} · längst {stats.max}</p>
    {/if}
  {/if}
</section>

<style>
  .since { padding: var(--sp-3); display: flex; flex-direction: column; gap: var(--sp-3); }
  h1 { font-size: var(--fs-lg); margin: 0; }
  .picker { display: flex; align-items: center; gap: var(--sp-2); }
  .picker .cap { font-size: var(--fs-xs); color: var(--c-text-dim); text-transform: uppercase; letter-spacing: 0.05em; }
  .picker select { flex: 1; padding: var(--sp-2); border: 1px solid var(--c-border); border-radius: var(--r-2); font: inherit; background: var(--c-surface); }
  .counter { text-align: center; padding: var(--sp-3) 0; }
  .counter .big { font-size: 56px; font-weight: var(--fw-bold); line-height: 1; }
  .counter .lbl { color: var(--c-text-dim); margin-top: 4px; }
  .counter .meta { font-size: var(--fs-xs); color: var(--c-text-dim); margin-top: 6px; }
  .sec { font-size: var(--fs-xs); color: var(--c-text-dim); text-transform: uppercase; letter-spacing: 0.05em; margin: var(--sp-2) 0 0; }
  .intervals { list-style: none; padding: 0; margin: 0; }
  .intervals li { display: flex; justify-content: space-between; gap: var(--sp-2); padding: var(--sp-2) 0; border-top: 1px solid var(--c-border); font-size: var(--fs-sm); }
  .intervals b { color: var(--c-text); }
  .stats { font-size: var(--fs-sm); font-weight: var(--fw-bold); text-align: right; margin: var(--sp-2) 0 0; }
  .empty, .hint { color: var(--c-text-dim); text-align: center; padding: var(--sp-4); }
</style>
