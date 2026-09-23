// Frank over real HTTP, driven by the real MCP client. Nothing here reaches the
// network beyond localhost, so `npm test` passes inside `docker build` with no
// Azure (CLAUDE.md, ADR-006).
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { defineTool, erase, ToolError } from '../src/tools/define.js';

let running: { server: Server; baseUrl: string } | undefined;

async function startFrank(tools?: ReturnType<typeof erase>[]) {
  const config = loadConfig({ PORT: '0' });
  const app = createApp({ config, tools });
  const server: Server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const { port } = server.address() as AddressInfo;
  running = { server, baseUrl: `http://127.0.0.1:${port}` };
  return running.baseUrl;
}

async function connect(baseUrl: string) {
  const client = new Client({ name: 'frank-test-client', version: '0.0.0' });
  await client.connect(new StreamableHTTPClientTransport(new URL('/mcp', baseUrl)));
  return client;
}

afterEach(async () => {
  if (running) {
    await new Promise<void>((resolve) => running!.server.close(() => resolve()));
    running = undefined;
  }
});

describe('Frank over Streamable HTTP (ADR-001)', () => {
  it('serves GET /healthz for the container probe', async () => {
    const baseUrl = await startFrank();
    const response = await fetch(`${baseUrl}/healthz`);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ status: 'ok', name: 'frank' });
  });

  it('answers a real MCP handshake and advertises get_status', async () => {
    const client = await connect(await startFrank());
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name)).toContain('get_status');
    await client.close();
  });

  it('calls get_status and returns structured content', async () => {
    const client = await connect(await startFrank());
    const result = await client.callTool({ name: 'get_status', arguments: {} });
    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toMatchObject({ name: 'frank' });
    await client.close();
  });

  it('rejects an unknown argument rather than ignoring it (ADR-002)', async () => {
    const client = await connect(await startFrank());
    const result = await client.callTool({
      name: 'get_status',
      arguments: { resourceGroup: 'someone-elses-rg' },
    });
    expect(result.isError).toBe(true);
    await client.close();
  });

  it('answers 405 on GET /mcp instead of hanging a browser', async () => {
    const baseUrl = await startFrank();
    expect((await fetch(`${baseUrl}/mcp`)).status).toBe(405);
  });

  it('says so at / when the console has not been built (ADR-003)', async () => {
    const baseUrl = await startFrank();
    const response = await fetch(`${baseUrl}/`);
    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toMatch(/console has not been built yet/i);
  });
});

describe('tool failures (ADR-002)', () => {
  const failing = erase(
    defineTool({
      name: 'get_broken',
      description: 'Always fails, so the error path can be tested end to end.',
      input: {},
      handler: async () => {
        throw new ToolError('Frank could not read that. Try again in a moment.');
      },
    }),
  );

  const leaky = erase(
    defineTool({
      name: 'get_leaky',
      description: 'Throws a raw dependency error, to prove it is not passed through.',
      input: {},
      handler: async () => {
        throw new Error('ENOTFOUND sub-1234-secret.vault.azure.net\n  at Object.<anonymous>');
      },
    }),
  );

  it('returns isError with the plain-language message, not a transport error', async () => {
    const client = await connect(await startFrank([failing]));
    const result = await client.callTool({ name: 'get_broken', arguments: {} });
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result.content)).toMatch(/could not read that/i);
    await client.close();
  });

  it('does not leak an unvetted dependency message or a stack trace', async () => {
    const client = await connect(await startFrank([leaky]));
    const result = await client.callTool({ name: 'get_leaky', arguments: {} });
    const text = JSON.stringify(result.content);
    expect(result.isError).toBe(true);
    expect(text).not.toMatch(/vault\.azure\.net/);
    expect(text).not.toMatch(/at Object/);
    await client.close();
  });
});
