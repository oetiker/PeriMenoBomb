<script lang="ts">
  import { snackbar } from '$lib/stores/snackbar.svelte';
</script>

{#if snackbar.current}
  <div class="bar" role="status">
    <span class="msg">{snackbar.current.message}</span>
    {#if snackbar.current.actionLabel}
      <button type="button" onclick={() => snackbar.invokeAction()}>
        {snackbar.current.actionLabel}
      </button>
    {/if}
  </div>
{/if}

<style>
  .bar {
    position: fixed;
    left: var(--sp-4); right: var(--sp-4);
    bottom: calc(var(--nav-height) + var(--sp-4) + var(--safe-bottom));
    background: #111827; color: #fff;
    border-radius: var(--r-2);
    padding: var(--sp-3) var(--sp-4);
    display: flex; align-items: center; justify-content: space-between;
    box-shadow: var(--shadow-2);
    z-index: 60;
  }
  button {
    background: transparent; color: #fff;
    border: 0; padding: var(--sp-2) var(--sp-3);
    font-weight: var(--fw-bold);
    cursor: pointer;
  }
</style>
