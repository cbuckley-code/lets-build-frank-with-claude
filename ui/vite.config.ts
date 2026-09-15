// vitest/config, not vite: the `test` block below is Vitest's.
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// The console is served from Frank's own container and calls /mcp relatively
// (ADR-006), so there is no build-time URL. In `npm run dev` the Vite server is
// a different origin, so proxy /mcp to a locally running Frank — dev only.
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
    setupFiles: ['./test/setup.ts'],
  },
});
