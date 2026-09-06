/**
 * Process entrypoint. Everything interesting lives in app.ts, which tests drive
 * directly without going through this file.
 */
import { createApp } from "./app.js";
import { loadConfig } from "./config.js";
import { VERSION } from "./runtime.js";

const config = loadConfig();
const app = createApp(config);

const httpServer = app.listen(config.port, config.host, () => {
  console.log(
    `[frank] ${VERSION} listening on ${config.host}:${config.port} — MCP at POST /mcp, health at GET /healthz`,
  );
  console.log(`[frank] serving the console from ${config.publicDir}`);
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    console.log(`[frank] ${signal} received, shutting down`);
    httpServer.close(() => process.exit(0));
  });
}
