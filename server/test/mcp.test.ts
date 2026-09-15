import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { connectClient, startFrank, type RunningFrank } from './helpers.js';

describe('POST /mcp over Streamable HTTP (ADR-001)', () => {
  let frank: RunningFrank;
  let client: Client;
  beforeAll(async () => {
    frank = await startFrank();
    client = await connectClient(frank.baseUrl);
  });
  afterAll(async () => {
    await client.close();
    await frank.close();
  });

  it('lists get_status with a description', async () => {
    const { tools } = await client.listTools();
    const status = tools.find((t) => t.name === 'get_status');
    expect(status).toBeDefined();
    expect(status!.description).toMatch(/version/i);
  });

  it('get_status returns a summary plus typed fields (ADR-002)', async () => {
    const result = await client.callTool({ name: 'get_status', arguments: {} });
    expect(result.isError).toBeFalsy();

    const structured = result.structuredContent as {
      summary: string;
      version: string;
      uptimeSeconds: number;
      greeting: string;
    };
    expect(typeof structured.summary).toBe('string');
    expect(structured.version).toMatch(/^\d+\.\d+\.\d+/);
    expect(structured.uptimeSeconds).toBeGreaterThanOrEqual(0);
    expect(structured.greeting).toContain('Frank');

    const content = result.content as Array<{ type: string; text?: string }>;
    expect(content[0]).toEqual({ type: 'text', text: structured.summary });
  });

  // The SDK client surfaces protocol errors as isError results, not rejections.
  it('rejects unknown input fields (ADR-002)', async () => {
    const result = await client.callTool({ name: 'get_status', arguments: { verbose: true } });
    expect(result.isError).toBe(true);
    const content = result.content as Array<{ text?: string }>;
    expect(content[0]?.text).toMatch(/verbose|unrecognized/i);
  });

  it('rejects unknown tools', async () => {
    const result = await client.callTool({ name: 'delete_everything', arguments: {} });
    expect(result.isError).toBe(true);
    const content = result.content as Array<{ text?: string }>;
    expect(content[0]?.text).toMatch(/not found/i);
  });

  it('answers 405 to GET and DELETE on /mcp', async () => {
    const get = await fetch(`${frank.baseUrl}/mcp`);
    expect(get.status).toBe(405);
    const del = await fetch(`${frank.baseUrl}/mcp`, { method: 'DELETE' });
    expect(del.status).toBe(405);
  });
});
