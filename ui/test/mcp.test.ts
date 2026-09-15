// The MCP client, with fetch stubbed. Nothing here touches the network —
// `npm test` runs inside `docker build` with no Frank to talk to (CLAUDE.md).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { callTool, listTools, parseMessage } from '../src/mcp';

function respond(payload: unknown, { sse = true, ok = true, status = 200 } = {}) {
  const body = sse ? `event: message\ndata: ${JSON.stringify(payload)}\n\n` : JSON.stringify(payload);
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok, status, statusText: 'OK', text: async () => body })),
  );
}

afterEach(() => vi.unstubAllGlobals());

describe('parseMessage', () => {
  it("reads Frank's SSE framing", () => {
    expect(parseMessage('event: message\ndata: {"result":{"ok":true}}\n\n')).toEqual({
      result: { ok: true },
    });
  });

  it('also accepts plain JSON, in case a proxy unwraps the stream', () => {
    expect(parseMessage('{"result":{"ok":true}}')).toEqual({ result: { ok: true } });
  });

  it('refuses an empty body rather than throwing a parse error', () => {
    expect(() => parseMessage('   ')).toThrow(/empty response/i);
  });
});

describe('listTools', () => {
  it('returns the tools Frank advertises', async () => {
    respond({
      result: {
        tools: [{ name: 'get_status', description: 'Frank status.', inputSchema: { type: 'object' } }],
      },
    });
    const tools = await listTools();
    expect(tools.map((t) => t.name)).toEqual(['get_status']);
  });

  it('calls /mcp relatively, with no origin and no credential (ADR-006)', async () => {
    respond({ result: { tools: [] } });
    await listTools();
    const [url, init] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe('/mcp');
    expect(init.headers.accept).toContain('text/event-stream');
    expect(JSON.stringify(init.headers)).not.toMatch(/authorization/i);
  });
});

describe('callTool', () => {
  it('returns the summary text and the typed fields (ADR-002)', async () => {
    respond({
      result: {
        content: [{ type: 'text', text: 'The resource group holds 3 resources.' }],
        structuredContent: { summary: 'The resource group holds 3 resources.', count: 3 },
      },
    });
    const result = await callTool('list_resources', {});
    expect(result.isError).toBe(false);
    expect(result.text).toMatch(/3 resources/);
    expect(result.structured).toMatchObject({ count: 3 });
  });

  it('surfaces a tool error as plain language, not a throw', async () => {
    respond({
      result: { content: [{ type: 'text', text: 'No resource named "nope".' }], isError: true },
    });
    const result = await callTool('get_resource', { name: 'nope', type: 'X' });
    expect(result.isError).toBe(true);
    expect(result.text).toMatch(/No resource named/);
  });

  it("throws on a JSON-RPC error, using Frank's message", async () => {
    respond({ error: { code: -32602, message: 'Unrecognized key: "resourceGroup"' } });
    await expect(callTool('list_resources', {})).rejects.toThrow(/Unrecognized key/);
  });

  it('reports an HTTP failure rather than trying to parse it', async () => {
    respond({}, { ok: false, status: 502 });
    await expect(callTool('get_status', {})).rejects.toThrow(/502/);
  });
});
