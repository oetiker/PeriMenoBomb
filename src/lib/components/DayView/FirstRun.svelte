<script lang="ts">
  import { importTemplate } from '$lib/templates/import';
  import { DEFAULT_TEMPLATE } from '$lib/templates/perimeno-default';
  import { setMeta } from '$lib/db/meta';
  import { goto } from '$app/navigation';

  async function useTemplate() {
    await importTemplate(DEFAULT_TEMPLATE);
    await setMeta('firstRunCompleted', true);
    location.reload();
  }
  async function buildOwn() {
    await setMeta('firstRunCompleted', true);
    await goto('/symptome');
  }
</script>

<section class="welcome">
  <h1>Willkommen 👋</h1>
  <p>PeriMenoBomb hilft dir, auffällige Symptome im Alltag zu erfassen — kurz, lokal, ohne Account.</p>
  <p>Wie magst du starten?</p>
  <button type="button" class="primary" onclick={useTemplate}>Mit Standard-Vorlage starten</button>
  <button type="button" class="secondary" onclick={buildOwn}>Eigene Liste aufbauen</button>
  <p class="hint">
    <strong>Wichtig (iOS):</strong> Bitte füge diese App zum Home-Bildschirm hinzu — sonst löscht Safari deine Daten nach ~7 Tagen.
  </p>
</section>

<style>
  .welcome { padding: var(--sp-5) var(--sp-4); text-align: center; }
  h1 { margin-bottom: var(--sp-3); }
  .primary, .secondary { width: 100%; padding: var(--sp-3); border-radius: var(--r-2); border: 0; margin-bottom: var(--sp-2); cursor: pointer; font-weight: var(--fw-bold); }
  .primary { background: var(--c-primary); color: var(--c-primary-contrast); }
  .secondary { background: var(--c-surface-2); color: var(--c-text); border: 1px solid var(--c-border); }
  .hint { margin-top: var(--sp-4); padding: var(--sp-3); background: #fff8e1; border-radius: var(--r-2); font-size: var(--fs-sm); color: var(--c-text); }
</style>
