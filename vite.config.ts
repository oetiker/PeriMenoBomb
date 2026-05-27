import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [sveltekit()],
  server: { port: 5191, strictPort: true },
  preview: { port: 5191, strictPort: true }
});
