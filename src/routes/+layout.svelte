<script lang="ts">
  import '../app.css';
  import BottomNav from '$lib/components/ui/BottomNav.svelte';
  import Snackbar from '$lib/components/ui/Snackbar.svelte';
  import { snackbar } from '$lib/stores/snackbar.svelte';
  import { loadOpenDialog, pendingRestore } from '$lib/stores/openDialog.svelte';
  import { loadSettings } from '$lib/stores/settings.svelte';
  import { requestPersistentStorage } from '$lib/db/persist';
  import { registerAutoBackupTriggers } from '$lib/db/autoBackupTriggers';
  import { runAutoBackup } from '$lib/db/fsBackup';
  // Imported for its side effect: registers the beforeinstallprompt/appinstalled
  // listeners at app start so the PWA install offer is never missed.
  import '$lib/stores/pwaInstall.svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { onMount } from 'svelte';
  let { children } = $props();

  // Service-Worker-Update-Hinweis: bei neuem SW Toast „Update verfügbar" mit
  // Reload-Action zeigen. Spec § Offline & PWA.
  onMount(async () => {
    // The splash covers exactly the hydration window: hide it as soon as the
    // app is mounted and interactive. No artificial delay, no animation.
    document.body.classList.add('app-ready');

    // Ask the browser to keep our IndexedDB data from being evicted under
    // storage pressure. Best-effort and fire-and-forget: silently granted for
    // installed PWAs on Chrome, a no-op where unsupported.
    void requestPersistentStorage();

    // Auto-backup: register change-triggers and write today's file on launch
    // (no-op when unsupported / disabled / no folder).
    registerAutoBackupTriggers();
    void runAutoBackup();

    // Restore persisted user settings (e.g. slider granularity).
    await loadSettings();

    const { registerSW } = await import('virtual:pwa-register');
    const updateSW = registerSW({
      onNeedRefresh() {
        snackbar.show({
          message: 'Update verfügbar.',
          actionLabel: 'Neu laden',
          onAction: () => void updateSW(true),
          durationMs: Infinity
        });
      }
    });

    // Open-Dialog-Restore: nach Cold-Start zur gespeicherten Route navigieren
    // und pendingRestore setzen, damit die Zielseite den Dialog wieder öffnet.
    const open = await loadOpenDialog();
    if (open) {
      if (open.route !== page.url.pathname) {
        await goto(open.route, { replaceState: true });
      }
      pendingRestore.set(open);
    }
  });
</script>

<main class="page">{@render children()}</main>
<Snackbar />
<BottomNav />

<style>
  .page {
    padding-top: var(--safe-top);
    padding-bottom: calc(var(--nav-height) + var(--safe-bottom));
    min-height: 100vh;
  }
</style>
