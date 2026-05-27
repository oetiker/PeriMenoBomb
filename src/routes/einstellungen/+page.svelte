<script lang="ts">
  import { todayKey } from '$lib/utils/date';
  import { exportAll, importAll, downloadJson, readFileAsText, validateExportPayload } from '$lib/utils/transfer';
  import { importTemplate } from '$lib/templates/import';
  import { DEFAULT_TEMPLATE } from '$lib/templates/perimeno-default';
  import { db } from '$lib/db';
  import { setMeta } from '$lib/db/meta';

  let isStandalone = $state(false);
  $effect(() => {
    if (typeof window !== 'undefined') {
      isStandalone =
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true;
    }
  });

  async function onExport() {
    const p = await exportAll();
    downloadJson(`perimenobomb-export-${todayKey()}.json`, p);
  }

  let fileInput: HTMLInputElement;

  async function onFile(e: Event) {
    const f = (e.target as HTMLInputElement).files?.[0];
    if (!f) return;
    const text = await readFileAsText(f);
    let payload: unknown;
    try { payload = JSON.parse(text); } catch { alert('Datei ist kein gültiges JSON.'); return; }
    if (!validateExportPayload(payload)) { alert('Datei hat nicht das erwartete Export-Format.'); return; }
    const mode = confirm('OK = Daten zusammenführen (Konflikte: importiert gewinnt).\nAbbrechen = vorhandene Daten ersetzen.') ? 'merge' : 'replace';
    await importAll(payload as any, mode);
    alert('Import abgeschlossen.');
  }

  async function onImportTemplate() {
    const have = await db.symptoms.count();
    if (have > 0 && !confirm(`Es existieren bereits ${have} Symptome. Vorlage zusätzlich importieren?`)) return;
    await importTemplate(DEFAULT_TEMPLATE);
    await setMeta('firstRunCompleted', true);
    alert('Vorlage importiert.');
  }

  async function onWipe() {
    if (!confirm('Alle Daten endgültig löschen?')) return;
    if (!confirm('Wirklich endgültig? Das kann nicht rückgängig gemacht werden.')) return;
    await db.transaction('rw', db.symptoms, db.tags, db.entries, db.meta, async () => {
      await Promise.all([db.symptoms.clear(), db.tags.clear(), db.entries.clear(), db.meta.clear()]);
    });
    alert('Alle Daten gelöscht.');
  }
</script>

<header class="hd"><h1>Einstellungen</h1></header>

{#if !isStandalone}
  <section class="warn">
    <h2>iOS / Safari Hinweis</h2>
    <p>
      Damit deine Daten nicht nach ~7 Tagen automatisch gelöscht werden, füge diese App
      zum <strong>Home-Bildschirm</strong> hinzu (Safari → Teilen-Menü → „Zum Home-Bildschirm").
    </p>
  </section>
{/if}

<section>
  <h2>Standard-Vorlage</h2>
  <p>Eine kuratierte Liste typischer Perimenopause-Symptome importieren.</p>
  <button type="button" onclick={onImportTemplate}>Standard-Vorlage importieren</button>
</section>

<section>
  <h2>Backup &amp; Übertragung</h2>
  <p>Alle Daten als JSON-Datei herunterladen (oder zurückspielen).</p>
  <button type="button" onclick={onExport}>Daten exportieren (JSON)</button>
  <button type="button" onclick={() => fileInput.click()}>Daten importieren…</button>
  <input bind:this={fileInput} type="file" accept="application/json,.json" hidden onchange={onFile} />
</section>

<section>
  <h2>Tags</h2>
  <p><a href="/tags">Tag-Verwaltung öffnen</a></p>
</section>

<section>
  <h2>Daten löschen</h2>
  <button type="button" class="danger" onclick={onWipe}>Alle Daten löschen</button>
</section>

<style>
  .hd { padding: var(--sp-4); border-bottom: 1px solid var(--c-border); }
  .hd h1 { margin: 0; font-size: var(--fs-lg); }
  section { padding: var(--sp-4); border-bottom: 1px solid var(--c-border); }
  section h2 { font-size: var(--fs-md); margin: 0 0 var(--sp-2); }
  section p { margin: 0 0 var(--sp-3); color: var(--c-text-dim); }
  button { padding: var(--sp-3) var(--sp-4); margin-right: var(--sp-2); border: 1px solid var(--c-border); background: var(--c-surface); border-radius: var(--r-2); cursor: pointer; }
  .danger { color: var(--c-danger); border-color: var(--c-danger); }
  .warn { background: #fff8e1; }
</style>
