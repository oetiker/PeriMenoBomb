<script lang="ts">
  import { page } from '$app/state';
  import { CalendarDays, LineChart, Settings, MoreHorizontal } from '@lucide/svelte';
  type Item = { href: string; label: string; Icon: any; match: (p: string) => boolean };
  const items: Item[] = [
    { href: '/', label: 'Tag', Icon: CalendarDays, match: (p) => p === '/' || p.startsWith('/tag') },
    { href: '/verlauf', label: 'Verlauf', Icon: LineChart, match: (p) => p.startsWith('/verlauf') },
    { href: '/symptome', label: 'Symptome', Icon: Settings, match: (p) => p.startsWith('/symptome') },
    { href: '/einstellungen', label: 'Mehr', Icon: MoreHorizontal, match: (p) => p.startsWith('/einstellungen') || p.startsWith('/tags') }
  ];
</script>

<nav class="bottom-nav" aria-label="Hauptnavigation">
  {#each items as it}
    <a
      href={it.href}
      data-sveltekit-replacestate
      data-sveltekit-noscroll
      class="item {it.match(page.url.pathname) ? 'active' : ''}"
    >
      <it.Icon size={20} />
      <span>{it.label}</span>
    </a>
  {/each}
</nav>

<style>
  .bottom-nav {
    position: fixed; left: 0; right: 0; bottom: 0;
    height: calc(var(--nav-height) + var(--safe-bottom));
    padding-bottom: var(--safe-bottom);
    background: var(--c-surface);
    border-top: 1px solid var(--c-border);
    display: flex;
    z-index: 30;
  }
  .item {
    flex: 1;
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px;
    color: var(--c-text-dim);
    font-size: var(--fs-xs);
  }
  .item.active { color: var(--c-text); font-weight: var(--fw-bold); }
</style>
