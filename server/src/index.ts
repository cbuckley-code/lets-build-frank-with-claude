// Frank's entry point. `node dist/index.js` from the server package root — the
// Dockerfile's CMD and ADR-001's layout both depend on that staying true.
import { createApp } from './app.js';
import { loadConfig } from './config.js';

const config = loadConfig();
const app = createApp({ config });

// 0.0.0.0, not localhost: inside a container, binding the loopback interface
// makes Frank unreachable from Container Apps' ingress.
app.listen(config.port, '0.0.0.0', () => {
  console.log(`frank ${config.version} listening on ${config.port} (MCP at POST /mcp)`);
});
