// The only file with side effects: load config, build the app, listen.
import { loadConfig } from './config.js';
import { createApp } from './app.js';

const config = loadConfig();
const app = createApp({ config });

const server = app.listen(config.port, () => {
  console.log(`Frank ${config.version} listening on port ${config.port} (MCP at POST /mcp, health at GET /healthz)`);
});

// Container Apps sends SIGTERM on scale-down and redeploy. Finish in-flight
// requests, then exit.
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    console.log(`${signal} received, shutting down`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 5000).unref();
  });
}
