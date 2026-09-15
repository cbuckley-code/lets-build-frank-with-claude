// The one place ADR-002's conventions are enforced in code. Every tool goes
// through defineTool, and every tool is registered through registerTools.
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

/** The closed verb set from ADR-002. create/update/delete/run are absent on purpose. */
export const ALLOWED_VERBS = ['get', 'list', 'search', 'summarize'] as const;

export const TOOL_NAME_PATTERN = new RegExp(`^(${ALLOWED_VERBS.join('|')})_[a-z][a-z0-9_]*$`);

/** Every tool result carries a human-readable summary plus typed detail fields. */
export type ToolOutput = { summary: string } & Record<string, unknown>;


export interface FrankTool<Shape extends z.ZodRawShape = z.ZodRawShape> {
  name: string;
  description: string;
  /** The raw shape, kept so tests and the console can inspect parameter descriptions. */
  shape: Shape;
  /** Strict object schema built from the shape: unknown fields are rejected. */
  inputSchema: z.ZodObject<Shape>;
  handler: (input: z.infer<z.ZodObject<Shape>>) => Promise<ToolOutput>;
}

export interface ToolSpec<Shape extends z.ZodRawShape> {
  name: string;
  description: string;
  input: Shape;
  handler: (input: z.infer<z.ZodObject<Shape>>) => Promise<ToolOutput>;
}

export function defineTool<Shape extends z.ZodRawShape>(spec: ToolSpec<Shape>): FrankTool<Shape> {
  if (!TOOL_NAME_PATTERN.test(spec.name)) {
    throw new Error(
      `Tool name "${spec.name}" is out of policy. Names are verb_noun with the verb from ` +
        `${ALLOWED_VERBS.join('/')} (ADR-002).`,
    );
  }
  if (!spec.description.trim()) {
    throw new Error(`Tool "${spec.name}" needs a description (ADR-002).`);
  }
  for (const [param, schema] of Object.entries(spec.input)) {
    if (!describeSchema(schema)) {
      throw new Error(`Parameter "${param}" of tool "${spec.name}" needs a description (ADR-002).`);
    }
  }
  return {
    name: spec.name,
    description: spec.description,
    shape: spec.input,
    inputSchema: z.strictObject(spec.input),
    handler: spec.handler,
  };
}

/** The description a schema was given with .describe(). Zod v4 keeps it in a registry. */
export function describeSchema(schema: z.core.$ZodType): string | undefined {
  return z.globalRegistry.get(schema)?.description;
}

/** Turn a thrown error into a plain-language message. Never a stack trace. */
export function errorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  const firstLine = raw.split('\n')[0]?.trim() ?? '';
  return firstLine || 'The tool failed for an unknown reason.';
}

/** Run a tool handler and shape the outcome as an MCP result. */
export async function runTool(tool: FrankTool, input: unknown): Promise<CallToolResult> {
  try {
    const output = await tool.handler(input as never);
    return {
      content: [{ type: 'text', text: output.summary }],
      structuredContent: output,
    };
  } catch (err) {
    return {
      content: [{ type: 'text', text: errorMessage(err) }],
      isError: true,
    };
  }
}

/**
 * Widen a tool to the erased `FrankTool` the list holds. Each tool keeps its
 * exact input type where it is defined; a mixed list cannot, because a handler
 * taking `{ name, type }` is not assignable to one taking an open record. The
 * SDK validates against `inputSchema` before `runTool` calls any handler, so
 * this loses type information, not safety.
 */
export function erase<Shape extends z.ZodRawShape>(tool: FrankTool<Shape>): FrankTool {
  return tool as unknown as FrankTool;
}

export function registerTools(server: McpServer, tools: readonly FrankTool[]): void {
  for (const tool of tools) {
    server.registerTool(
      tool.name,
      { description: tool.description, inputSchema: tool.inputSchema },
      // The SDK validates against inputSchema before calling us, so `args`
      // has already passed the strict schema.
      (args: unknown) => runTool(tool, args),
    );
  }
}
