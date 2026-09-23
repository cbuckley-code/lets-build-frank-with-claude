// vitest/config, not vite: the `test` block below is Vitest's.
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// The console is served from Frank's own container and calls /mcp RELATIVELY
// (ADR-006 supersedes ADR-003's VITE_FRANK_URL + CORS clause), so there is no
// build-time URL here. In `npm run dev` the Vite server is a different origin,
// so proxy /mcp to a locally running Frank. Dev convenience, not configuration.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/mcp': { target: process.env.FRANK_DEV_URL ?? 'http://127.0.0.1:3000', changeOrigin: true },
      '/healthz': { target: process.env.FRANK_DEV_URL ?? 'http://127.0.0.1:3000', changeOrigin: true },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
  },
});
