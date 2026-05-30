<script lang="ts">
  import { liveQueryEffect } from '$lib/stores/liveQuery.svelte';
  import { listOccurrenceDates } from '$lib/db/entries';
  import { listAllSymptoms } from '$lib/db/symptoms';
  import { db, type Entry, type Symptom } from '$lib/db';
  import { getMeta, setMeta } from '$lib/db/meta';
  import { addDays, todayKey, daysBetweenKeys } from '$lib/utils/date';
  import { classifyCell, valueDomain, cellColor } from '$lib/report/heatmap';
  import { zoomAt } from '$lib/report/heatmap-view';

  const CELL_W = 30;
  const CELL_H = 22;
  const GAP = 3;
  const EMPTY = 'var(--c-surface-3)';

  // Compact column date label: YYYY-MM-DD → DD.MM.YY
  const sd = (key: string) => { const p = key.split('-'); return `${p[2]}.${p[1]}.${p[0].slice(2)}`; };

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

  // Anchor occurrences = columns (index 0..N-1), ascending in time.
  const anchorDatesQ = liveQueryEffect(
    () => (anchorId ? listOccurrenceDates(anchorId) : Promise.resolve([] as string[])),
    [] as string[],
    () => anchorId
  );
  const anchorDates = $derived(anchorDatesQ.current);
  const N = $derived(anchorDates.length);

  // ALL value-symptom entries (whole history), keyed by date — supports lookups
  // at any offset for the infinite grid. Stable number domain over all of them.
  const valueEntriesQ = liveQueryEffect(
    () => (valueId ? db.entries.where('symptomId').equals(valueId).toArray() : Promise.resolve([] as Entry[])),
    [] as Entry[],
    () => valueId
  );
  const entriesByDate = $derived(new Map(valueEntriesQ.current.map((e) => [e.date, e])));
  const numberDomain = $derived(valueSym ? valueDomain(valueEntriesQ.current, valueSym) : null);

  const hasData = $derived(!!valueSym && N > 0);

  // ---- view transform (free pan/zoom, NO clamping = infinite surface) ----
  const MIN_SCALE = 0.5, MAX_SCALE = 4;
  let scale = $state(1);
  let tx = $state(8);
  let ty = $state(200);

  // Default a sane viewport so the first paint (and tests, which have no layout)
  // render a window; ResizeObserver corrects it to the real size.
  let vpW = $state(360);
  let vpH = $state(480);
  let viewportEl = $state<HTMLElement | undefined>();
  $effect(() => {
    if (!viewportEl) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0].contentRect;
      if (r.width > 0) vpW = r.width;
      if (r.height > 0) vpH = r.height;
    });
    ro.observe(viewportEl);
    return () => ro.disconnect();
  });

  function resetView() { scale = 1; tx = 8; ty = vpH * 0.4; }
  let fitted = $state(false);
  $effect(() => {
    if (fitted || vpH === 0) return;
    fitted = true;
    resetView();
  });

  // Visible index ranges in content space (with a 1-cell bleed).
  const colRange = $derived.by(() => ({
    start: Math.floor(-tx / scale / CELL_W) - 1,
    end: Math.ceil((vpW - tx) / scale / CELL_W) + 1
  }));
  const rowRange = $derived.by(() => ({
    start: Math.floor(-ty / scale / CELL_H) - 1,
    end: Math.ceil((vpH - ty) / scale / CELL_H) + 1
  }));

  interface VCell { key: string; x: number; y: number; bg: string }

  // Each column spans from the PREVIOUS Start-Mens (above) to the NEXT Start-Mens
  // (below); the last column runs to today. Those neighbour events bound the
  // column's data and are drawn with a grey frame. Day 0 is the column's own start.
  const colBounds = $derived.by(() => {
    const today = todayKey();
    return anchorDates.map((s, i) => ({
      top: i > 0 ? daysBetweenKeys(anchorDates[i - 1], s) : null,                          // negative offset of prev start
      bot: i < N - 1 ? daysBetweenKeys(anchorDates[i + 1], s) : daysBetweenKeys(today, s),  // positive offset of next start / today
      botIsEvent: i < N - 1
    }));
  });

  const visibleCells = $derived.by<VCell[]>(() => {
    const out: VCell[] = [];
    if (!hasData) return out;
    for (let ci = colRange.start; ci <= colRange.end; ci++) {
      const anchor = ci >= 0 && ci < N ? anchorDates[ci] : null;
      const b = anchor ? colBounds[ci] : null;
      for (let o = rowRange.start; o <= rowRange.end; o++) {
        let bg = EMPTY;
        if (anchor && b) {
          const withinTop = b.top === null || o > b.top;       // above prev start → other cycle
          const withinBot = b.botIsEvent ? o < b.bot : o <= b.bot; // at/after next start → other cycle (today inclusive)
          if (withinTop && withinBot) {
            const cell = classifyCell(valueSym!, entriesByDate.get(addDays(anchor, o)), numberDomain);
            bg = cellColor(cell, valueSym!.color);
          }
        }
        out.push({ key: `${ci}:${o}`, x: ci * CELL_W, y: o * CELL_H, bg });
      }
    }
    return out;
  });

  // Boundary markers (grey frame): the neighbouring Start-Mens that bound a column.
  const boundMarks = $derived.by<{ key: string; x: number; y: number }[]>(() => {
    if (!hasData) return [];
    const out: { key: string; x: number; y: number }[] = [];
    for (let ci = Math.max(0, colRange.start); ci <= Math.min(N - 1, colRange.end); ci++) {
      const b = colBounds[ci];
      if (b.top !== null && b.top >= rowRange.start && b.top <= rowRange.end) {
        out.push({ key: `${ci}t`, x: ci * CELL_W, y: b.top * CELL_H });
      }
      if (b.botIsEvent && b.bot >= rowRange.start && b.bot <= rowRange.end) {
        out.push({ key: `${ci}b`, x: ci * CELL_W, y: b.bot * CELL_H });
      }
    }
    return out;
  });

  // Day-0 markers (dark): this column's own Start-Mens.
  const zeroMarks = $derived.by<{ key: number; x: number }[]>(() => {
    if (!hasData || rowRange.start > 0 || rowRange.end < 0) return [];
    const out: { key: number; x: number }[] = [];
    for (let ci = Math.max(0, colRange.start); ci <= Math.min(N - 1, colRange.end); ci++) {
      out.push({ key: ci, x: ci * CELL_W });
    }
    return out;
  });

  // Gutter ticks (only real columns get date labels). Tight min-spacing.
  const colTicks = $derived.by<{ ci: number; pos: number }[]>(() => {
    const out: { ci: number; pos: number }[] = [];
    let last = -Infinity;
    for (let ci = Math.max(0, colRange.start); ci <= Math.min(N - 1, colRange.end); ci++) {
      const pos = tx + (ci * CELL_W + CELL_W / 2) * scale;
      if (pos < -10 || pos > vpW + 10) continue;
      if (pos - last < 22) continue;
      out.push({ ci, pos });
      last = pos;
    }
    return out;
  });
  const rowTicks = $derived.by<{ o: number; pos: number }[]>(() => {
    const out: { o: number; pos: number }[] = [];
    let last = -Infinity;
    for (let o = rowRange.start; o <= rowRange.end; o++) {
      const pos = ty + (o * CELL_H + CELL_H / 2) * scale;
      if (pos < 0 || pos > vpH) continue;
      if (pos - last < 16) continue;
      out.push({ o, pos });
      last = pos;
    }
    return out;
  });

  function applyZoom(factor: number, fx: number, fy: number) {
    const z = zoomAt({ scale, tx, ty }, factor, fx, fy, MIN_SCALE, MAX_SCALE);
    scale = z.scale; tx = z.tx; ty = z.ty;
  }
  function zoomBtn(factor: number) { applyZoom(factor, vpW / 2, vpH / 2); }

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
      tx += e.clientX - prev.x;   // free pan, no clamp
      ty += e.clientY - prev.y;
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
    <label><span class="cap">Fokus</span>
      <select onchange={onValue} value={valueId ?? ''} aria-label="Fokus-Symptom wählen">
        {#each symptoms as s (s.id)}<option value={s.id}>{s.name}</option>{/each}
      </select>
    </label>
  </div>

  {#if !hasData}
    <p class="empty">Keine Anker-Erfassungen — erfasse {anchorSym?.name ?? 'das Anker-Symptom'} an mindestens einem Tag.</p>
  {:else}
    <div class="chart" style="--gl: 26px; --gt: 48px;">
      <div class="corner"></div>
      <div class="topgutter" data-topgutter>
        {#each colTicks as t (t.ci)}
          <span class="collabel" style="left: {t.pos}px;">{sd(anchorDates[t.ci])}</span>
        {/each}
      </div>
      <div class="leftgutter" data-leftgutter>
        {#each rowTicks as t (t.o)}
          <span class="offlabel {t.o === 0 ? 'zero' : ''}" style="top: {t.pos}px;">{t.o > 0 ? '+' : ''}{t.o}</span>
        {/each}
      </div>
      <div
        class="viewport" data-viewport
        role="group"
        aria-label="Heatmap-Bereich (verschieben und zoomen)"
        bind:this={viewportEl}
        onwheel={onWheel}
        onpointerdown={onPointerDown}
        onpointermove={onPointerMove}
        onpointerup={onPointerUp}
        onpointercancel={onPointerUp}
      >
        <div class="plot" style="transform: translate({tx}px, {ty}px) scale({scale});">
          {#each visibleCells as c (c.key)}
            <div data-cell class="cell" style="left: {c.x}px; top: {c.y}px; width: {CELL_W - GAP}px; height: {CELL_H - GAP}px; background: {c.bg};"></div>
          {/each}
          {#each boundMarks as m (m.key)}
            <div class="boundmark" style="left: {m.x}px; top: {m.y}px; width: {CELL_W - GAP}px; height: {CELL_H - GAP}px;"></div>
          {/each}
          {#each zeroMarks as z (z.key)}
            <div class="zeromark" style="left: {z.x}px; top: 0px; width: {CELL_W - GAP}px; height: {CELL_H - GAP}px;"></div>
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
  .cycle {
    padding: var(--sp-3); display: flex; flex-direction: column; gap: var(--sp-3);
    min-height: calc(100dvh - var(--nav-height) - var(--safe-bottom) - var(--safe-top));
  }
  h1 { font-size: var(--fs-lg); margin: 0; }
  .selectors { display: flex; gap: var(--sp-3); }
  .selectors label { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  .cap { font-size: var(--fs-xs); color: var(--c-text-dim); text-transform: uppercase; letter-spacing: 0.05em; }
  .selectors select { width: 100%; box-sizing: border-box; padding: var(--sp-2); border: 1px solid var(--c-border); border-radius: var(--r-2); background: var(--c-surface); }
  .empty { color: var(--c-text-dim); text-align: center; padding: var(--sp-5); }

  .chart {
    display: grid;
    grid-template-columns: var(--gl) 1fr;
    grid-template-rows: var(--gt) 1fr;
    flex: 1; min-height: 340px;
    border: 1px solid var(--c-border); border-radius: var(--r-2); overflow: hidden;
    background: var(--c-surface);
  }
  .corner { grid-column: 1; grid-row: 1; }
  .topgutter { grid-column: 2; grid-row: 1; position: relative; overflow: hidden; border-bottom: 1px solid var(--c-border); }
  .leftgutter { grid-column: 1; grid-row: 2; position: relative; overflow: hidden; border-right: 1px solid var(--c-border); }
  .viewport { grid-column: 2; grid-row: 2; position: relative; overflow: hidden; touch-action: none; cursor: grab; }
  .viewport:active { cursor: grabbing; }
  .plot { position: absolute; top: 0; left: 0; transform-origin: 0 0; }

  /* 45° date labels anchored at the column tick (bottom-left), rising up-right. */
  .collabel {
    position: absolute; bottom: 4px;
    transform-origin: left bottom; transform: rotate(-45deg);
    white-space: nowrap; font-size: 10px; color: var(--c-text-dim);
  }
  .offlabel { position: absolute; right: 4px; transform: translateY(-50%); font-size: 10px; color: var(--c-text-muted); }
  .offlabel.zero { color: var(--c-primary); font-weight: var(--fw-bold); }

  .cell { position: absolute; border-radius: 4px; }
  .boundmark { position: absolute; box-shadow: inset 0 0 0 2px rgba(107,114,128,0.75); border-radius: 4px; pointer-events: none; }
  .zeromark { position: absolute; box-shadow: inset 0 0 0 2px rgba(31,41,55,0.85); border-radius: 4px; pointer-events: none; }

  .legend { display: flex; flex-wrap: wrap; gap: var(--sp-3); font-size: var(--fs-xs); color: var(--c-text-dim); }
  .legend span { display: inline-flex; align-items: center; gap: 5px; }
  .legend i { width: 14px; height: 14px; border-radius: 4px; display: inline-block; }
  .legend .zero-swatch { box-shadow: inset 0 0 0 2px rgba(31,41,55,0.8); }
  .zoombar { display: flex; gap: var(--sp-2); }
  .zoombar button { width: 36px; height: 36px; border: 1px solid var(--c-border); background: var(--c-surface); border-radius: var(--r-2); font-size: 18px; cursor: pointer; }
</style>
