<script lang="ts">
  let {
    daysSince,
    broken = false,
    onBackup,
    onResume,
    onDismiss
  }: {
    daysSince: number | null;
    broken?: boolean;
    onBackup: () => void;
    onResume?: () => void;
    onDismiss: () => void;
  } = $props();
</script>

<div class="reminder" role="alert">
  <p class="msg">
    {#if broken}
      <span class="icon" aria-hidden="true">⚠</span>
      Auto-Backup pausiert – der Ordnerzugriff ist abgelaufen, weil die App im
      Hintergrund war. Tippe auf „Fortsetzen", um ihn ohne erneute Ordnerwahl
      wiederherzustellen.
    {:else if daysSince === null}
      <span class="icon" aria-hidden="true">⚠</span>
      Du hast noch kein Backup gemacht. Sichere deine Daten, damit nichts verloren geht.
    {:else}
      <span class="icon" aria-hidden="true">⚠</span>
      Dein letztes Backup ist {daysSince}&nbsp;{daysSince === 1 ? 'Tag' : 'Tage'} her.
    {/if}
  </p>
  <div class="actions">
    {#if broken}
      {#if onResume}
        <button type="button" class="primary" onclick={onResume}>Fortsetzen</button>
      {/if}
    {:else}
      <button type="button" class="primary" onclick={onBackup}>Jetzt sichern</button>
    {/if}
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
