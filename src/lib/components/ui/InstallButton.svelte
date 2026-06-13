<script lang="ts">
  import { pwaInstall } from '$lib/stores/pwaInstall.svelte';
  import { Download, Check } from '@lucide/svelte';
</script>

{#if pwaInstall.isInstalled}
  <p class="installed"><Check size={16} /> App ist installiert</p>
{:else if pwaInstall.canInstall}
  <button type="button" class="install" onclick={() => pwaInstall.promptInstall()}>
    <Download size={18} /> App installieren
  </button>
{/if}

<style>
  .install {
    display: inline-flex; align-items: center; justify-content: center; gap: var(--sp-2);
    width: 100%; padding: var(--sp-3); border: 0; border-radius: var(--r-2);
    background: var(--c-primary); color: var(--c-primary-contrast);
    font-weight: var(--fw-bold); cursor: pointer;
  }
  .installed {
    display: inline-flex; align-items: center; gap: var(--sp-2);
    color: var(--c-text-dim); font-size: var(--fs-sm); margin: 0;
  }
</style>
