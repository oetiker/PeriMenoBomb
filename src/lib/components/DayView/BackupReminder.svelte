<script lang="ts">
  let {
    daysSince,
    onBackup,
    onDismiss
  }: {
    daysSince: number | null;
    onBackup: () => void;
    onDismiss: () => void;
  } = $props();
</script>

<div class="reminder" role="alert">
  <p class="msg">
    <span class="icon" aria-hidden="true">⚠</span>
    {#if daysSince === null}
      Du hast noch kein Backup gemacht. Sichere deine Daten, damit nichts verloren geht.
    {:else}
      Dein letztes Backup ist {daysSince}&nbsp;{daysSince === 1 ? 'Tag' : 'Tage'} her.
    {/if}
  </p>
  <div class="actions">
    <button type="button" class="primary" onclick={onBackup}>Jetzt sichern</button>
    <button type="button" class="secondary" onclick={onDismiss}>Später</button>
  </div>
</div>

<style>
  .reminder {
    margin: var(--sp-2) var(--sp-3);
    padding: var(--sp-3);
    background: #fff8e1;
    border: 1px solid var(--c-border);
    border-radius: var(--r-2);
  }
  .msg { margin: 0 0 var(--sp-2); font-size: var(--fs-sm); color: var(--c-text); }
  .icon { margin-right: var(--sp-1); }
  .actions { display: flex; gap: var(--sp-2); }
  .primary, .secondary {
    flex: 1;
    padding: var(--sp-2);
    border-radius: var(--r-2);
    border: 0;
    cursor: pointer;
    font-weight: var(--fw-bold);
  }
  .primary { background: var(--c-primary); color: var(--c-primary-contrast); }
  .secondary { background: var(--c-surface-2); color: var(--c-text); border: 1px solid var(--c-border); }
</style>
