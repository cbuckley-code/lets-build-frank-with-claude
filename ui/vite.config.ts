import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  build: {
    // The build output is copied into the container as server/public (ADR-006).
    outDir: "dist",
    sourcemap: true,
  },
  server: {
    // In production the console and Frank share an origin, so the UI calls
    // `/mcp` relatively. The dev server proxies those calls to a locally
    // running Frank so the same relative path works here too — there is no
    // build-time URL to inject (ADR-006).
    proxy: {
      "/mcp": "http://127.0.0.1:3000",
      "/healthz": "http://127.0.0.1:3000",
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./test/setup.ts"],
    include: ["test/**/*.test.{ts,tsx}"],
    css: false,
  },
});
