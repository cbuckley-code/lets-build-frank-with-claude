import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { createApp, type AppOptions } from '../src/app.js';
import { loadConfig } from '../src/config.js';

export interface RunningFrank {
  baseUrl: string;
  close: () => Promise<void>;
}

/** Start Frank on an ephemeral port. Tests never touch the network beyond localhost. */
export async function startFrank(overrides: Partial<AppOptions> = {}): Promise<RunningFrank> {
  const config = overrides.config ?? loadConfig({ PORT: '0' });
  const app = createApp({ config, tools: overrides.tools });
  const server: Server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const { port } = server.address() as AddressInfo;
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    close: () => new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve()))),
  };
}

/** An MCP client connected to a running Frank over Streamable HTTP. */
export async function connectClient(baseUrl: string): Promise<Client> {
  const client = new Client({ name: 'frank-test-client', version: '0.0.0' });
  const transport = new StreamableHTTPClientTransport(new URL('/mcp', baseUrl));
  await client.connect(transport);
  return client;
}
