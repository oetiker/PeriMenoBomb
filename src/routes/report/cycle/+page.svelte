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
  import { tickPositions, clampTranslate, zoomAt, type Tick } from '$lib/report/heatmap-view';
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

  const MIN_SCALE = 0.5, MAX_SCALE = 4, MARGIN = 40;
  let scale = $state(1);
  let tx = $state(8);
  let ty = $state(8);

  // Viewport size (measured); ticks/cull depend on it.
  let vpW = $state(0);
  let vpH = $state(0);
  let viewportEl = $state<HTMLElement | undefined>();
  $effect(() => {
    if (!viewportEl) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0].contentRect;
      vpW = r.width; vpH = r.height;
    });
    ro.observe(viewportEl);
    return () => ro.disconnect();
  });

  // Re-center vertically on the day-0 row the first time we have a model + size.
  let centered = $state(false);
  $effect(() => {
    if (centered || !model || vpH === 0) return;
    centered = true;
    ty = vpH * 0.4 - (model.zeroIndex * CELL_H + CELL_H / 2) * scale;
    ty = clampTranslate(ty, scale, plotH, vpH, MARGIN);
  });

  const colTicks = $derived<Tick[]>(model ? tickPositions(model.columns.length, CELL_W, scale, tx, vpW, 44) : []);
  const rowTicks = $derived<Tick[]>(model ? tickPositions(model.offsets.length, CELL_H, scale, ty, vpH, 16) : []);

  function applyZoom(factor: number, fx: number, fy: number) {
    const z = zoomAt({ scale, tx, ty }, factor, fx, fy, MIN_SCALE, MAX_SCALE);
    scale = z.scale;
    tx = clampTranslate(z.tx, scale, plotW, vpW, MARGIN);
    ty = clampTranslate(z.ty, scale, plotH, vpH, MARGIN);
  }
  function zoomBtn(factor: number) { applyZoom(factor, vpW / 2, vpH / 2); }
  function resetView() {
    scale = 1; tx = 8;
    ty = model ? clampTranslate(vpH * 0.4 - (model.zeroIndex * CELL_H + CELL_H / 2), 1, plotH, vpH, MARGIN) : 8;
    centered = false;
  }

  function onWheel(e: WheelEvent) {
    e.preventDefault();
    const r = viewportEl!.getBoundingClientRect();
    applyZoom(e.deltaY < 0 ? 1.1 : 0.9, e.clientX - r.left, e.clientY - r.top);
  }

  const pts = new Map<number, { x: number; y: number }>();
  let pinchDist = 0;
  function onPointerDown(e: PointerEvent) { (e.target as HTMLElement).setPointerCapture(e.pointerId); pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); }
  function onPointerMove(e: PointerEvent) {
    if (!pts.has(e.pointerId)) return;
    const prev = pts.get(e.pointerId)!;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 1) {
      tx = clampTranslate(tx + (e.clientX - prev.x), scale, plotW, vpW, MARGIN);
      ty = clampTranslate(ty + (e.clientY - prev.y), scale, plotH, vpH, MARGIN);
    } else if (pts.size === 2) {
      const [a, b] = [...pts.values()];
      const nd = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinchDist) {
        const r = viewportEl!.getBoundingClientRect();
        applyZoom(nd / pinchDist, (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top);
      }
      pinchDist = nd;
    }
  }
  function onPointerUp(e: PointerEvent) { pts.delete(e.pointerId); if (pts.size < 2) pinchDist = 0; }
</script>

<section class="cycle">
  <h1>Zyklus-Heatmap</h1>

  <div class="zoombar">
    <button type="button" onclick={() => zoomBtn(0.83)} aria-label="kleiner">−</button>
    <button type="button" onclick={() => zoomBtn(1.2)} aria-label="größer">+</button>
    <button type="button" onclick={resetView} aria-label="zurücksetzen">⟳</button>
  </div>

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
        {#each colTicks as t (t.index)}
          <span class="collabel" style="left: {t.pos}px;">{formatLong(model.columns[t.index].anchorDate)}</span>
        {/each}
      </div>
      <!-- left gutter: day-offset labels -->
      <div class="leftgutter" data-leftgutter>
        {#each rowTicks as t (t.index)}
          <span class="offlabel {model.offsets[t.index] === 0 ? 'zero' : ''}" style="top: {t.pos}px;">{model.offsets[t.index] > 0 ? '+' : ''}{model.offsets[t.index]}</span>
        {/each}
      </div>
      <!-- plot viewport -->
      <div
        class="viewport" data-viewport
        role="application"
        aria-label="Heatmap-Bereich (verschieben und zoomen)"
        bind:this={viewportEl}
        onwheel={onWheel}
        onpointerdown={onPointerDown}
        onpointermove={onPointerMove}
        onpointerup={onPointerUp}
        onpointercancel={onPointerUp}
      >
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
  .zoombar { display: flex; gap: var(--sp-2); }
  .zoombar button { width: 36px; height: 36px; border: 1px solid var(--c-border); background: var(--c-surface); border-radius: var(--r-2); font-size: 18px; cursor: pointer; }
</style>
