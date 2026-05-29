import { sveltekit } from '@sveltejs/kit/vite';
import { paraglideVitePlugin } from '@inlang/paraglide-js';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    paraglideVitePlugin({
      project: './project.inlang',
      outdir: './src/lib/paraglide',
      strategy: ['baseLocale']
    }),
    sveltekit(),
    SvelteKitPWA({
      registerType: 'prompt',
      manifest: {
        name: 'PeriMenoBomb',
        short_name: 'PeriMeno',
        description: 'Tracking von Gefühls- und Körpersymptomen in der Perimenopause',
        theme_color: '#1f2937',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        lang: 'de',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,jpg,webp,woff2}']
      }
    })
  ],
  server: { port: 5191, strictPort: true },
  preview: { port: 5191, strictPort: true }
});
