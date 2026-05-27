<script lang="ts">
  import { formatLong, todayKey } from '$lib/utils/date';
  import { currentDate } from '$lib/stores/currentDate.svelte';
  import { ChevronLeft, ChevronRight, Calendar } from '@lucide/svelte';

  function onPickerChange(e: Event) {
    const v = (e.target as HTMLInputElement).value;
    if (v) currentDate.set(v);
  }
  const isToday = $derived(currentDate.value === todayKey());
</script>

<header class="date-header">
  <button class="nav-btn" type="button" aria-label="Vorheriger Tag" onclick={() => currentDate.prev()}>
    <ChevronLeft size={22} />
  </button>
  <div class="center">
    <div class="label">{isToday ? 'Heute' : 'Tag'}</div>
    <div class="date">{formatLong(currentDate.value)}</div>
    <label class="picker">
      <Calendar size={14} /> Datum wählen
      <input type="date" value={currentDate.value} oninput={onPickerChange} />
    </label>
  </div>
  <button class="nav-btn" type="button" aria-label="Nächster Tag" onclick={() => currentDate.next()}>
    <ChevronRight size={22} />
  </button>
</header>

<style>
  .date-header {
    display: grid; grid-template-columns: auto 1fr auto; align-items: center;
    padding: var(--sp-4); border-bottom: 1px solid var(--c-border);
  }
  .nav-btn { background: none; border: 0; color: var(--c-text-dim); padding: var(--sp-2); cursor: pointer; }
  .center { text-align: center; }
  .label { font-size: var(--fs-xs); color: var(--c-text-dim); text-transform: uppercase; letter-spacing: 0.05em; }
  .date { font-size: var(--fs-lg); font-weight: var(--fw-bold); }
  .picker { display: inline-flex; align-items: center; gap: 4px; font-size: var(--fs-xs); color: var(--c-text-dim); position: relative; cursor: pointer; }
  .picker input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
</style>
