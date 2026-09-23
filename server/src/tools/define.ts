// The one place ADR-002's conventions are enforced in code.
//
// ADR-002 says the rules are "enforceable in review". Review is people, and
// people are tired at 4pm. Everything here that CAN be checked mechanically is
// checked at module load, so a tool that breaks policy fails to import — and
// since the Docker build runs `npm test`, it never reaches Azure.
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

/** The closed verb set from ADR-002. create/update/delete/run are absent on purpose. */
export const ALLOWED_VERBS = ['get', 'list', 'search', 'summarize'] as const;

export const TOOL_NAME_PATTERN = new RegExp(`^(${ALLOWED_VERBS.join('|')})_[a-z][a-z0-9_]*$`);

/**
 * Every tool result carries a human- and model-readable `summary` plus typed
 * detail fields (ADR-002). The summary is what an MCP client shows when it will
 * not render structured content.
 */
export type ToolOutput = { summary: string } & Record<string, unknown>;

/**
 * An error whose message is safe to show a caller.
 *
 * Anything else that escapes a handler is reported generically. The first line
 * of an arbitrary dependency error is neither reliably plain language nor
 * reliably free of identifiers, so it is logged and not returned.
 */
export class ToolError extends Error {
  override readonly name = 'ToolError';
}

export interface FrankTool<Shape extends z.ZodRawShape = z.ZodRawShape> {
  name: string;
  description: string;
  /** The raw shape, kept so tests and the console can inspect parameter descriptions. */
  shape: Shape;
  /** Strict object schema: unknown fields are REJECTED, not stripped (ADR-002). */
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
  // A one-word description passes any "is it non-empty" check while telling a
  // model nothing. This is a floor, not a substitute for review.
  if (spec.description.trim().length < 20) {
    throw new Error(
      `Tool "${spec.name}" needs a description saying what it returns and when to use it (ADR-002).`,
    );
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
    // strictObject, not object: zod STRIPS unknown keys by default, which would
    // silently violate ADR-002's "unknown fields rejected".
    inputSchema: z.strictObject(spec.input),
    handler: spec.handler,
  };
}

/** The description a schema was given with .describe(). Zod v4 keeps it in a registry. */
export function describeSchema(schema: z.core.$ZodType): string | undefined {
  return z.globalRegistry.get(schema)?.description;
}

/**
 * Widen a tool to the erased `FrankTool` the registry holds. Each tool keeps its
 * exact input type where it is defined; a mixed list cannot, because a handler
 * taking `{ name, type }` is not assignable to one taking an open record. The
 * SDK validates against `inputSchema` before `runTool` calls any handler, so
 * this loses type information, not safety.
 */
export function erase<Shape extends z.ZodRawShape>(tool: FrankTool<Shape>): FrankTool {
  return tool as unknown as FrankTool;
}

/**
 * Run a handler and shape the outcome as an MCP result.
 *
 * Conversion happens here, at the tool-result boundary, so a handler cannot
 * return a bare throw to the transport and become a JSON-RPC internal error
 * instead of the `isError: true` ADR-002 requires.
 */
export async function runTool(tool: FrankTool, input: unknown): Promise<CallToolResult> {
  try {
    const output = await tool.handler(input as never);
    return {
      content: [{ type: 'text', text: output.summary }],
      structuredContent: output,
    };
  } catch (err) {
    return {
      content: [{ type: 'text', text: safeMessage(tool.name, err) }],
      isError: true,
    };
  }
}

/** Never a stack trace, and never an unvetted dependency message (ADR-002). */
export function safeMessage(toolName: string, err: unknown): string {
  if (err instanceof ToolError && err.message.trim()) return err.message;
  // Logged for the operator; not returned, because it may carry identifiers.
  console.error(`tool ${toolName} failed:`, err instanceof Error ? err.message : err);
  return `Frank could not complete ${toolName}. Ask your instructor if it keeps happening.`;
}

export function registerTools(server: McpServer, tools: readonly FrankTool[]): void {
  for (const tool of tools) {
    server.registerTool(
      tool.name,
      { description: tool.description, inputSchema: tool.inputSchema },
      // The SDK validates against inputSchema before calling us, so `args` has
      // already passed the strict schema.
      (args: unknown) => runTool(tool, args),
    );
  }
}
