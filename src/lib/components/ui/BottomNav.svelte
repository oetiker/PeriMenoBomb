<script lang="ts">
  import { page } from '$app/state';
  import { base } from '$app/paths';
  import { CalendarDays, ChartLine, Settings, MoreHorizontal } from '@lucide/svelte';
  type Item = { href: string; label: string; Icon: any; match: (p: string) => boolean };
  const items: Item[] = [
    { href: '/', label: 'Tag', Icon: CalendarDays, match: (p) => p === '/' || p.startsWith('/day') },
    { href: '/report', label: 'Verlauf', Icon: ChartLine, match: (p) => p.startsWith('/report') },
    { href: '/symptoms', label: 'Symptome', Icon: Settings, match: (p) => p.startsWith('/symptoms') },
    // /tags is a sub-section reached from the "Mehr" area, so it lights up this tab too.
    { href: '/settings', label: 'Mehr', Icon: MoreHorizontal, match: (p) => p.startsWith('/settings') || p.startsWith('/tags') }
  ];

  // page.url.pathname includes the base path on deploy (e.g. /PeriMenoBomb/day/…).
  // Strip it so the base-less match() predicates above keep working.
  const path = $derived(page.url.pathname.slice(base.length) || '/');
</script>

<nav class="bottom-nav" aria-label="Hauptnavigation">
  {#each items as it}
    <a
      href={base + it.href}
      data-sveltekit-replacestate
      data-sveltekit-noscroll
      class="item {it.match(path) ? 'active' : ''}"
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
