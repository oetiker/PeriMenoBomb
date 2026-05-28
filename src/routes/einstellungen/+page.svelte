<script lang="ts">
  import { todayKey } from '$lib/utils/date';
  import { exportAll, importAll, downloadJson, readFileAsText, validateExportPayload, type ExportPayload } from '$lib/utils/transfer';
  import { importTemplate } from '$lib/templates/import';
  import { DEFAULT_TEMPLATE } from '$lib/templates/perimeno-default';
  import { db } from '$lib/db';
  import { setMeta } from '$lib/db/meta';
  import { snackbar } from '$lib/stores/snackbar.svelte';
  import ConfirmModal from '$lib/components/ui/ConfirmModal.svelte';
  import Modal from '$lib/components/ui/Modal.svelte';

  let isStandalone = $state(false);
  $effect(() => {
    if (typeof window !== 'undefined') {
      isStandalone =
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true;
    }
  });

  let importState = $state<{ payload: ExportPayload } | null>(null);
  let templateConfirm = $state<{ existing: number } | null>(null);
  let wipeStep = $state<0 | 1 | 2>(0);

  async function onExport() {
    const p = await exportAll();
    downloadJson(`perimenobomb-export-${todayKey()}.json`, p);
  }

  let fileInput: HTMLInputElement;

  async function onFile(e: Event) {
    const input = e.target as HTMLInputElement;
    const f = input.files?.[0];
    input.value = '';
    if (!f) return;
    const text = await readFileAsText(f);
    let payload: unknown;
    try { payload = JSON.parse(text); }
    catch { snackbar.show({ message: 'Datei ist kein gültiges JSON.' }); return; }
    if (!validateExportPayload(payload)) {
      snackbar.show({ message: 'Datei hat nicht das erwartete Export-Format.' });
      return;
    }
    importState = { payload };
  }

  async function runImport(mode: 'merge' | 'replace') {
    const s = importState;
    importState = null;
    if (!s) return;
    await importAll(s.payload, mode);
    snackbar.show({ message: 'Import abgeschlossen.' });
  }

  async function onImportTemplateClick() {
    const have = await db.symptoms.count();
    if (have > 0) {
      templateConfirm = { existing: have };
      return;
    }
    await runTemplateImport();
  }
  async function runTemplateImport() {
    templateConfirm = null;
    await importTemplate(DEFAULT_TEMPLATE);
    await setMeta('firstRunCompleted', true);
    snackbar.show({ message: 'Vorlage importiert.' });
  }

  async function runWipe() {
    wipeStep = 0;
    await db.transaction('rw', db.symptoms, db.tags, db.entries, db.meta, async () => {
      await Promise.all([db.symptoms.clear(), db.tags.clear(), db.entries.clear(), db.meta.clear()]);
    });
    snackbar.show({ message: 'Alle Daten gelöscht.' });
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
  <button type="button" onclick={onImportTemplateClick}>Standard-Vorlage importieren</button>
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
  <button type="button" class="danger" onclick={() => (wipeStep = 1)}>Alle Daten löschen</button>
</section>

<Modal
  open={importState !== null}
  title="Import-Strategie"
  onClose={() => (importState = null)}
>
  <p class="import-msg">
    Wie sollen die importierten Daten mit den vorhandenen verbunden werden?
  </p>
  <div class="import-actions">
    <button type="button" class="primary" onclick={() => runImport('merge')}>
      Zusammenführen
      <span class="hint">Bestehende ergänzen, Konflikte: importiert gewinnt.</span>
    </button>
    <button type="button" class="primary danger" onclick={() => runImport('replace')}>
      Vollständig ersetzen
      <span class="hint">Alle vorhandenen Daten werden gelöscht.</span>
    </button>
    <button type="button" class="secondary" onclick={() => (importState = null)}>Abbrechen</button>
  </div>
</Modal>

<ConfirmModal
  open={templateConfirm !== null}
  title="Vorlage zusätzlich importieren?"
  message={`Es existieren bereits ${templateConfirm?.existing ?? 0} Symptome. Die Vorlage wird zusätzlich angelegt — bestehende bleiben erhalten.`}
  confirmLabel="Vorlage hinzufügen"
  onConfirm={runTemplateImport}
  onCancel={() => (templateConfirm = null)}
/>

<ConfirmModal
  open={wipeStep === 1}
  title="Alle Daten löschen?"
  message="Symptome, Tags, Einträge und Einstellungen werden entfernt. Das kann nicht rückgängig gemacht werden."
  confirmLabel="Weiter"
  danger
  onConfirm={() => (wipeStep = 2)}
  onCancel={() => (wipeStep = 0)}
/>

<ConfirmModal
  open={wipeStep === 2}
  title="Wirklich endgültig?"
  message="Letzte Bestätigung — danach sind die Daten endgültig weg."
  confirmLabel="Endgültig löschen"
  danger
  onConfirm={runWipe}
  onCancel={() => (wipeStep = 0)}
/>

<style>
  .hd { padding: var(--sp-4); border-bottom: 1px solid var(--c-border); }
  .hd h1 { margin: 0; font-size: var(--fs-lg); }
  section { padding: var(--sp-4); border-bottom: 1px solid var(--c-border); }
  section h2 { font-size: var(--fs-md); margin: 0 0 var(--sp-2); }
  section p { margin: 0 0 var(--sp-3); color: var(--c-text-dim); }
  section > button { padding: var(--sp-3) var(--sp-4); margin-right: var(--sp-2); border: 1px solid var(--c-border); background: var(--c-surface); border-radius: var(--r-2); cursor: pointer; }
  section > button.danger { color: var(--c-danger); border-color: var(--c-danger); }
  .warn { background: #fff8e1; }

  .import-msg { margin: 0 0 var(--sp-4); line-height: 1.4; }
  .import-actions { display: flex; flex-direction: column; gap: var(--sp-2); }
  .import-actions button {
    text-align: left;
    padding: var(--sp-3);
    border-radius: var(--r-2);
    cursor: pointer;
    font-weight: var(--fw-bold);
    display: flex; flex-direction: column; gap: 4px;
  }
  .import-actions .primary { background: var(--c-primary); color: var(--c-primary-contrast); border: 0; }
  .import-actions .primary.danger { background: var(--c-danger); }
  .import-actions .secondary {
    background: var(--c-surface-2);
    color: var(--c-text);
    border: 1px solid var(--c-border);
    font-weight: var(--fw-normal);
    text-align: center;
  }
  .import-actions .hint {
    font-weight: var(--fw-normal);
    font-size: var(--fs-sm);
    opacity: 0.85;
  }
</style>
