<script lang="ts">
  import { icons } from '@lucide/svelte';
  type Props = {
    icon: string;
    color: string;
    size?: 20 | 28 | 36;
    archived?: boolean;
    title?: string;
  };
  let { icon, color, size = 28, archived = false, title }: Props = $props();

  function toPascal(name: string): string {
    return name.split('-').map((p) => p[0].toUpperCase() + p.slice(1)).join('');
  }

  const IconComp = $derived((icons as Record<string, any>)[toPascal(icon)] ?? icons.Circle);
  const iconSize = $derived(Math.round(size * 0.6));
</script>

<span
  class="badge"
  style="background:{color}; width:{size}px; height:{size}px; opacity:{archived ? 0.5 : 1};"
  aria-label={title}
>
  <IconComp size={iconSize} color="#fff" strokeWidth={2.25} />
</span>

<style>
  .badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    flex-shrink: 0;
  }
</style>
