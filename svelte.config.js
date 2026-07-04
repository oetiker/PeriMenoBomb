import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

// Base path for deployment under a subpath (e.g. GitHub Pages project site
// `/PeriMenoBomb/`). Set BASE_PATH in CI; empty locally and for root deploys.
// SvelteKit rewrites all internal links, `goto()` calls and `%sveltekit.assets%`
// references to honour this automatically.
const base = process.env.BASE_PATH ?? '';

export default {
  preprocess: vitePreprocess(),
  kit: {
    // `404.html` is the SPA fallback: GitHub Pages serves it for any unmatched
    // path, which is what makes deep links like /day/2026-05-29 work on reload.
    adapter: adapter({ fallback: '404.html' }),
    // relative:false — prerendered pages must use absolute (base-prefixed)
    // asset URLs. The service worker serves the precached index.html as SPA
    // fallback for deep routes like /day/2026-05-29; relative URLs (the
    // default) would then resolve against that route (/day/brand.webp,
    // /day/_app/…) and 404, breaking the splash image and hydration on every
    // deep-link reload in the installed PWA.
    paths: { base, relative: false },
    alias: { $lib: 'src/lib' }
  }
};
