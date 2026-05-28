import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [sveltekit()],
  test: {
    environment: 'jsdom',
    setupFiles: ['src/lib/test/setup.ts'],
    include: ['src/**/*.test.ts', 'src/**/*.test.svelte.ts'],
    globals: true
  },
  resolve: {
    conditions: ['browser']
  }
});
