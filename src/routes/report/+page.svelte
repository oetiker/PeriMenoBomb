<script lang="ts">
  import { ChartLine, CalendarClock, ClipboardList } from '@lucide/svelte';
</script>

<section class="report-hub">
  <h1>Verlauf</h1>
  <a class="card" href="/report/cycle">
    <ChartLine size={24} />
    <div><h2>Zyklus-Heatmap</h2><p>Symptom-Intensität relativ zu einem Ereignis</p></div>
  </a>
  <a class="card" href="/report/since">
    <CalendarClock size={24} />
    <div><h2>Tage seit letztem Symptom</h2><p>Zähler + Abstände zwischen Erfassungen</p></div>
  </a>
  <a class="card" href="/report/list">
    <ClipboardList size={24} />
    <div><h2>Ereignis-Liste</h2><p>Alle Einträge, filterbar, als PDF</p></div>
  </a>
</section>

<style>
  .report-hub { padding: var(--sp-3); display: flex; flex-direction: column; gap: var(--sp-3); }
  h1 { font-size: var(--fs-lg); margin: 0 0 var(--sp-2); }
  .card {
    display: flex; align-items: center; gap: var(--sp-3);
    padding: var(--sp-3); border: 1px solid var(--c-border); border-radius: var(--r-2);
    background: var(--c-surface); color: var(--c-text); text-decoration: none;
  }
  .card h2 { font-size: var(--fs-md); margin: 0; }
  .card p { font-size: var(--fs-xs); color: var(--c-text-dim); margin: 2px 0 0; }
</style>
