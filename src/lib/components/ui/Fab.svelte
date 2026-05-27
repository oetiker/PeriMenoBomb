<script lang="ts">
  import { Plus } from '@lucide/svelte';
  type Props = { onClick: () => void; label?: string };
  let { onClick, label = 'Symptom hinzufügen' }: Props = $props();
</script>

<button type="button" class="fab" onclick={onClick} aria-label={label}>
  <Plus size={26} />
</button>

<style>
  .fab {
    position: fixed; right: var(--sp-4);
    bottom: calc(var(--nav-height) + var(--sp-4) + var(--safe-bottom));
    width: 56px; height: 56px; border-radius: 50%;
    background: var(--c-primary); color: var(--c-primary-contrast);
    border: 0; box-shadow: var(--shadow-2);
    cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    z-index: 20;
  }
</style>
