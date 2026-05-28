<script lang="ts">
  import '../app.css';
  import BottomNav from '$lib/components/ui/BottomNav.svelte';
  import Snackbar from '$lib/components/ui/Snackbar.svelte';
  import { snackbar } from '$lib/stores/snackbar.svelte';
  import { onMount } from 'svelte';
  let { children } = $props();

  // Service-Worker-Update-Hinweis: bei neuem SW Toast „Update verfügbar" mit
  // Reload-Action zeigen. Spec § Offline & PWA.
  onMount(async () => {
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
