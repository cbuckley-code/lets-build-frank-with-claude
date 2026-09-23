// Talking to Frank from the browser.
//
// This uses the official MCP client rather than hand-rolled fetch. Streamable
// HTTP is a protocol, not a REST endpoint — it has an initialization handshake,
// content negotiation and SSE framing — and reimplementing that in the console
// would be exactly the "no hand-rolled protocol code" ADR-001 rejects.
//
// The URL is RELATIVE (ADR-006 supersedes ADR-003's VITE_FRANK_URL + CORS
// clause): the console is served by Frank, so same origin, no CORS, and no
// build-time configuration. There is no credential here — the UI can only reach
// what Frank exposes, and Frank is read-only (ADR-002).
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

/** The JSON Schema Frank publishes for a tool's input. */
export interface ToolSchema {
  type?: string;
  properties?: Record<string, SchemaProperty>;
  required?: string[];
  additionalProperties?: boolean;
}

export interface SchemaProperty {
  type?: string | string[];
  description?: string;
  enum?: unknown[];
}

export interface ToolSummary {
  name: string;
  description: string;
  inputSchema: ToolSchema;
}

export interface ToolResult {
  /** Frank's plain-language text — the error message when isError (ADR-002). */
  text: string;
  /** The typed fields: `summary` plus tool-specific detail. */
  payload?: Record<string, unknown>;
  isError: boolean;
}

export interface FrankClient {
  listTools(): Promise<ToolSummary[]>;
  callTool(name: string, args: Record<string, unknown>): Promise<ToolResult>;
}

export async function connect(): Promise<FrankClient> {
  const client = new Client({ name: 'frank-console', version: '0.1.0' });
  await client.connect(new StreamableHTTPClientTransport(new URL('/mcp', window.location.origin)));

  return {
    async listTools() {
      const { tools } = await client.listTools();
      return tools.map((tool) => ({
        name: tool.name,
        description: tool.description ?? '',
        inputSchema: (tool.inputSchema ?? { type: 'object' }) as ToolSchema,
      }));
    },

    async callTool(name, args) {
      const result = await client.callTool({ name, arguments: args });
      const content = (result.content ?? []) as Array<{ type: string; text?: string }>;
      return {
        text: content.find((c) => c.type === 'text')?.text ?? '',
        payload: result.structuredContent as Record<string, unknown> | undefined,
        isError: Boolean(result.isError),
      };
    },
  };
}
