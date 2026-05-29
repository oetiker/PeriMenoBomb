<script lang="ts">
  import { liveQueryEffect } from '$lib/stores/liveQuery.svelte';
  import { listOccurrenceDates, listEntriesForRange } from '$lib/db/entries';
  import { listAllSymptoms } from '$lib/db/symptoms';
  import { getMeta, setMeta } from '$lib/db/meta';
  import { addDays, formatLong } from '$lib/utils/date';
  import {
    buildHeatmap, valueNumberDomain, cellColor,
    OFFSET_MIN, OFFSET_MAX, MAX_ANCHOR_COLUMNS
  } from '$lib/report/heatmap';
  import type { Entry, Symptom } from '$lib/db';

  const CELL_W = 30;
  const CELL_H = 22;
  const GAP = 3;

  const symptomsQ = liveQueryEffect(
    async () => (await listAllSymptoms()).filter((s) => !s.isFolder && !s.archived),
    [] as Symptom[]
  );
  const symptoms = $derived(
    [...symptomsQ.current].sort((a, b) => a.name.localeCompare(b.name, 'de', { sensitivity: 'base' }))
  );

  let anchorId = $state<string | null>(null);
  let valueId = $state<string | null>(null);
  let loaded = $state(false);
  $effect(() => {
    if (loaded) return;
    loaded = true;
    void Promise.all([getMeta<string>('report.cycle.anchorId'), getMeta<string>('report.cycle.valueId')])
      .then(([a, v]) => { anchorId = a ?? null; valueId = v ?? null; });
  });
  $effect(() => {
    if (symptoms.length === 0) return;
    if (!anchorId || !symptoms.some((s) => s.id === anchorId)) anchorId = symptoms[0].id;
    if (!valueId || !symptoms.some((s) => s.id === valueId)) valueId = symptoms[Math.min(1, symptoms.length - 1)].id;
  });
  function onAnchor(e: Event) { anchorId = (e.target as HTMLSelectElement).value; void setMeta('report.cycle.anchorId', anchorId); }
  function onValue(e: Event) { valueId = (e.target as HTMLSelectElement).value; void setMeta('report.cycle.valueId', valueId); }

  const anchorSym = $derived(symptoms.find((s) => s.id === anchorId) ?? null);
  const valueSym = $derived(symptoms.find((s) => s.id === valueId) ?? null);

  const anchorDatesQ = liveQueryEffect(
    () => (anchorId ? listOccurrenceDates(anchorId) : Promise.resolve([] as string[])),
    [] as string[],
    () => anchorId
  );
  // Cap to the most recent columns (dense-anchor guard, spec §3.3).
  const allAnchors = $derived(anchorDatesQ.current);
  const capped = $derived(allAnchors.length > MAX_ANCHOR_COLUMNS);
  const anchorDates = $derived(capped ? allAnchors.slice(allAnchors.length - MAX_ANCHOR_COLUMNS) : allAnchors);

  // Value-symptom entries across the offset window around the anchor span.
  const rangeQ = liveQueryEffect(
    async () => {
      if (!valueId || anchorDates.length === 0) return [] as Entry[];
      const from = addDays(anchorDates[0], OFFSET_MIN);
      const to = addDays(anchorDates[anchorDates.length - 1], OFFSET_MAX);
      const rows = await listEntriesForRange(from, to);
      return rows.filter((e) => e.symptomId === valueId);
    },
    [] as Entry[],
    () => [valueId, anchorDates.length ? anchorDates[0] + anchorDates[anchorDates.length - 1] : '']
  );
  const entriesByDate = $derived(new Map(rangeQ.current.map((e) => [e.date, e])));
  const numberDomain = $derived(valueSym ? valueNumberDomain(rangeQ.current, valueSym) : null);

  const model = $derived(
    valueSym && anchorDates.length
      ? buildHeatmap(anchorDates, entriesByDate, valueSym, numberDomain, OFFSET_MIN, OFFSET_MAX)
      : null
  );

  const plotW = $derived(model ? model.columns.length * CELL_W : 0);
  const plotH = $derived(model ? model.offsets.length * CELL_H : 0);

  // Static transform for now; Task C5 makes scale/tx/ty interactive.
  const scale = 1, tx = 8, ty = 8;
</script>

<section class="cycle">
  <h1>Zyklus-Heatmap</h1>

  <div class="selectors">
    <label><span class="cap">Anker</span>
      <select onchange={onAnchor} value={anchorId ?? ''} aria-label="Anker wählen">
        {#each symptoms as s (s.id)}<option value={s.id}>{s.name}</option>{/each}
      </select>
    </label>
    <label><span class="cap">Farbe</span>
      <select onchange={onValue} value={valueId ?? ''} aria-label="Farb-Symptom wählen">
        {#each symptoms as s (s.id)}<option value={s.id}>{s.name}</option>{/each}
      </select>
    </label>
  </div>

  {#if !model}
    <p class="empty">Keine Anker-Erfassungen — erfasse {anchorSym?.name ?? 'das Anker-Symptom'} an mindestens einem Tag.</p>
  {:else}
    {#if capped}
      <p class="notice">Sehr viele Anker ({allAnchors.length}) — es werden die letzten {MAX_ANCHOR_COLUMNS} gezeigt. Wähle ggf. einen engeren Zeitraum.</p>
    {/if}

    <div class="chart" style="--gl: 56px; --gt: 40px;">
      <div class="corner"></div>
      <!-- top gutter: column (anchor) date labels -->
      <div class="topgutter" data-topgutter>
        {#each model.columns as col, i (col.anchorDate)}
          <span class="collabel" style="left: {tx + (i * CELL_W + CELL_W / 2) * scale}px;">{formatLong(col.anchorDate)}</span>
        {/each}
      </div>
      <!-- left gutter: day-offset labels -->
      <div class="leftgutter" data-leftgutter>
        {#each model.offsets as off, j (off)}
          <span class="offlabel {off === 0 ? 'zero' : ''}" style="top: {ty + (j * CELL_H + CELL_H / 2) * scale}px;">{off > 0 ? '+' : ''}{off}</span>
        {/each}
      </div>
      <!-- plot viewport -->
      <div class="viewport" data-viewport>
        <div class="plot" style="transform: translate({tx}px, {ty}px) scale({scale}); width: {plotW}px; height: {plotH}px;">
          <!-- day-0 band -->
          <div class="zeroline" style="top: {model.zeroIndex * CELL_H}px; height: {CELL_H - GAP}px; width: {plotW}px;"></div>
          {#each model.columns as col, i (col.anchorDate)}
            {#each col.cells as cell, j (j)}
              <div
                data-cell
                class="cell"
                style="left: {i * CELL_W}px; top: {j * CELL_H}px; width: {CELL_W - GAP}px; height: {CELL_H - GAP}px; background: {cellColor(cell, valueSym?.color ?? '#6b7280')};"
              ></div>
            {/each}
          {/each}
        </div>
      </div>
    </div>

    <div class="legend">
      <span><i style="background: var(--c-surface-3)"></i>kein Eintrag</span>
      <span><i style="background: {cellColor({ kind: 'value', intensity: 0.2 }, valueSym?.color ?? '#6b7280')}"></i>leicht</span>
      <span><i style="background: {cellColor({ kind: 'value', intensity: 1 }, valueSym?.color ?? '#6b7280')}"></i>stark</span>
      <span><i class="zero-swatch"></i>Tag 0 = {anchorSym?.name}</span>
    </div>
  {/if}
</section>

<style>
  .cycle { padding: var(--sp-3); display: flex; flex-direction: column; gap: var(--sp-3); }
  h1 { font-size: var(--fs-lg); margin: 0; }
  .selectors { display: flex; gap: var(--sp-3); }
  .selectors label { flex: 1; display: flex; flex-direction: column; gap: 2px; }
  .cap { font-size: var(--fs-xs); color: var(--c-text-dim); text-transform: uppercase; letter-spacing: 0.05em; }
  .selectors select { padding: var(--sp-2); border: 1px solid var(--c-border); border-radius: var(--r-2); background: var(--c-surface); }
  .notice { font-size: var(--fs-sm); color: var(--c-text-dim); background: var(--c-surface-2); border-radius: var(--r-2); padding: var(--sp-2); }
  .empty { color: var(--c-text-dim); text-align: center; padding: var(--sp-5); }

  .chart {
    display: grid;
    grid-template-columns: var(--gl) 1fr;
    grid-template-rows: var(--gt) 1fr;
    height: 60vh; min-height: 320px;
    border: 1px solid var(--c-border); border-radius: var(--r-2); overflow: hidden;
    background: var(--c-surface);
  }
  .corner { grid-column: 1; grid-row: 1; }
  .topgutter { grid-column: 2; grid-row: 1; position: relative; overflow: hidden; border-bottom: 1px solid var(--c-border); }
  .leftgutter { grid-column: 1; grid-row: 2; position: relative; overflow: hidden; border-right: 1px solid var(--c-border); }
  .viewport { grid-column: 2; grid-row: 2; position: relative; overflow: hidden; touch-action: none; }
  .plot { position: absolute; top: 0; left: 0; transform-origin: 0 0; }

  .collabel { position: absolute; bottom: 2px; transform: translateX(-50%); white-space: nowrap; font-size: 10px; color: var(--c-text-dim); writing-mode: vertical-rl; }
  .offlabel { position: absolute; right: 4px; transform: translateY(-50%); font-size: 10px; color: var(--c-text-muted); }
  .offlabel.zero { color: var(--c-primary); font-weight: var(--fw-bold); }

  .cell { position: absolute; border-radius: 4px; }
  .zeroline { position: absolute; left: 0; box-shadow: inset 0 0 0 2px rgba(31,41,55,0.5); border-radius: 4px; pointer-events: none; }

  .legend { display: flex; flex-wrap: wrap; gap: var(--sp-3); font-size: var(--fs-xs); color: var(--c-text-dim); }
  .legend span { display: inline-flex; align-items: center; gap: 5px; }
  .legend i { width: 14px; height: 14px; border-radius: 4px; display: inline-block; }
  .legend .zero-swatch { box-shadow: inset 0 0 0 2px rgba(31,41,55,0.5); }
</style>
