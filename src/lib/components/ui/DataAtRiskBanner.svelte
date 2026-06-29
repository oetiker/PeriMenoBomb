<script lang="ts">
  // Shown when storage persistence is supported but NOT granted, i.e. the browser
  // may evict this origin's IndexedDB data under storage pressure. Nudges the
  // user to install the PWA (which makes Chrome grant persistence) and to back up.
  import InstallButton from './InstallButton.svelte';
  import { pwaInstall } from '$lib/stores/pwaInstall.svelte';

  // onDismiss optional: the day-view banner is dismissible for the session; the
  // Settings copy is permanent (no dismiss) so the warning is always reachable.
  let { onDismiss }: { onDismiss?: () => void } = $props();
</script>

<div class="risk" role="alert">
  <p class="msg">
    <span class="icon" aria-hidden="true">⚠</span>
    Deine Daten sind nicht vor dem automatischen Löschen durch den Browser geschützt.
    {#if !pwaInstall.isInstalled}
      Installiere die App auf dem Home-Bildschirm und mache regelmäßig ein Backup, damit nichts verloren geht.
    {:else}
      Mache regelmäßig ein Backup, damit nichts verloren geht.
    {/if}
  </p>
  {#if pwaInstall.canInstall}
    <div class="install-row"><InstallButton /></div>
  {/if}
  {#if onDismiss}
    <div class="actions">
      <button type="button" class="secondary" onclick={onDismiss}>Verstanden</button>
    </div>
  {/if}
</div>

<style>
  .risk {
    margin: var(--sp-2) var(--sp-3);
    padding: var(--sp-3);
    background: #fff8e1;
    border: 1px solid var(--c-danger);
    border-radius: var(--r-2);
  }
  .msg { margin: 0 0 var(--sp-2); font-size: var(--fs-sm); color: var(--c-text); }
  .icon { margin-right: var(--sp-1); }
  .install-row { margin-bottom: var(--sp-2); }
  .actions { display: flex; gap: var(--sp-2); }
  .secondary {
    flex: 1;
    padding: var(--sp-2);
    border-radius: var(--r-2);
    border: 1px solid var(--c-border);
    background: var(--c-surface-2);
    color: var(--c-text);
    font-weight: var(--fw-bold);
    cursor: pointer;
  }
</style>
