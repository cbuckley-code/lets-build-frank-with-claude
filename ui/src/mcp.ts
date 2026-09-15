// Talking to Frank over Streamable HTTP.
//
// The console calls `/mcp` RELATIVELY (ADR-006): it is served from the same
// container as Frank, so there is no build-time URL and no CORS. There is also
// no credential here — the UI can only reach what Frank exposes, and Frank is
// read-only (ADR-002).

/** The JSON Schema shape Frank publishes for each tool's input. */
export interface ToolSchema {
  type: 'object';
  properties?: Record<string, SchemaProperty>;
  required?: string[];
  additionalProperties?: boolean;
}

export interface SchemaProperty {
  type?: string | string[];
  description?: string;
  enum?: string[];
  default?: unknown;
}

export interface Tool {
  name: string;
  description: string;
  inputSchema: ToolSchema;
}

export interface ToolResult {
  /** The plain-language text Frank returns — the error message when isError. */
  text: string;
  /** The typed fields: `summary` plus tool-specific detail (ADR-002). */
  structured?: Record<string, unknown>;
  isError: boolean;
}

let nextId = 1;

/**
 * One JSON-RPC round trip. Frank is stateless, so every call is independent
 * and there is no session to keep.
 */
async function rpc(method: string, params?: unknown): Promise<Record<string, unknown>> {
  const response = await fetch('/mcp', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      // Frank answers over SSE; without this header the SDK refuses the request.
      accept: 'application/json, text/event-stream',
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: nextId++, method, params }),
  });

  if (!response.ok) {
    throw new Error(`Frank answered ${response.status} ${response.statusText}.`);
  }

  const body = await response.text();
  const message = parseMessage(body);

  if (message.error) {
    const err = message.error as { message?: string };
    throw new Error(err.message || 'Frank returned an error with no message.');
  }
  return (message.result ?? {}) as Record<string, unknown>;
}

/**
 * Frank replies with a single SSE event, or with plain JSON. Accept both
 * rather than assuming, so a proxy that unwraps SSE does not break the console.
 */
export function parseMessage(body: string): Record<string, unknown> {
  const trimmed = body.trim();
  if (!trimmed) throw new Error('Frank sent an empty response.');

  for (const line of trimmed.split('\n')) {
    if (line.startsWith('data:')) {
      return JSON.parse(line.slice(5).trim());
    }
  }
  return JSON.parse(trimmed);
}

export async function listTools(): Promise<Tool[]> {
  const result = await rpc('tools/list');
  return (result.tools ?? []) as Tool[];
}

export async function callTool(name: string, args: Record<string, unknown>): Promise<ToolResult> {
  const result = await rpc('tools/call', { name, arguments: args });
  const content = (result.content ?? []) as Array<{ type: string; text?: string }>;
  const text = content.find((c) => c.type === 'text')?.text ?? '';
  return {
    text,
    structured: result.structuredContent as Record<string, unknown> | undefined,
    isError: Boolean(result.isError),
  };
}

/** `get_status` takes no parameters, so Overview can call it directly. */
export async function getStatus(): Promise<ToolResult> {
  return callTool('get_status', {});
}
