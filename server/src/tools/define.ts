/**
 * How a Frank tool is declared — and where ADR-002's rules are enforced in code
 * rather than in review comments.
 *
 * `defineTool` refuses to build a tool whose name is out of policy, so an
 * out-of-policy tool fails at process start, not in production.
 */
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { failure, plainMessage, type FrankPayload } from "../result.js";

/**
 * The closed verb set from ADR-002. `create`, `update`, `delete` and `run` are
 * absent on purpose: Frank observes, he does not act. Adding a verb here means
 * writing a new ADR first.
 */
export const ALLOWED_VERBS = ["get", "list", "search", "summarize"] as const;

/** `verb_noun`, lower snake_case, verb drawn from ALLOWED_VERBS. */
export const TOOL_NAME_PATTERN = new RegExp(
  `^(?:${ALLOWED_VERBS.join("|")})(?:_[a-z0-9]+)+$`,
);

/** A tool that has passed policy checks and knows how to register itself. */
export interface FrankTool {
  readonly name: string;
  readonly title: string;
  readonly description: string;
  register(server: McpServer): void;
}

export interface ToolSpec<
  Input extends z.ZodTypeAny,
  Output extends z.ZodType<FrankPayload>,
> {
  /** `verb_noun` from the closed verb set. */
  name: string;
  /** Short human label for the console's tool list. */
  title: string;
  /**
   * One or two sentences written for a model deciding whether to call this
   * tool: what it returns, when to use it, and any limits.
   */
  description: string;
  /** Strict zod object — unknown fields are rejected, per ADR-002. */
  inputSchema: Input;
  /** Structured output: a `summary` string plus typed detail fields. */
  outputSchema: Output;
  /** The tool's work. Receives already-validated input. */
  handler: (input: z.infer<Input>) => CallToolResult | Promise<CallToolResult>;
}

/**
 * Declare a tool, enforcing ADR-002 at construction time and wrapping the
 * handler so no failure can ever escape as a stack trace.
 */
export function defineTool<
  Input extends z.ZodTypeAny,
  Output extends z.ZodType<FrankPayload>,
>(spec: ToolSpec<Input, Output>): FrankTool {
  if (!TOOL_NAME_PATTERN.test(spec.name)) {
    throw new Error(
      `Tool "${spec.name}" is out of policy (ADR-002): names must be verb_noun ` +
        `in lower snake_case, with the verb one of ${ALLOWED_VERBS.join(", ")}.`,
    );
  }

  if (spec.description.trim().length === 0) {
    throw new Error(
      `Tool "${spec.name}" needs a description — MCP clients choose tools by reading them (ADR-002).`,
    );
  }

  const safeHandler = async (input: z.infer<Input>): Promise<CallToolResult> => {
    try {
      return await spec.handler(input);
    } catch (error) {
      // The stack stays in the container's logs; the caller gets a sentence.
      console.error(`[frank] tool ${spec.name} failed`, error);
      return failure(
        `Frank could not complete ${spec.name}: ${plainMessage(error)}`,
      );
    }
  };

  return {
    name: spec.name,
    title: spec.title,
    description: spec.description,
    register(server: McpServer): void {
      // Widen the schemas to their base type before handing them over. The
      // SDK's callback type is conditional on the schema type, and TypeScript
      // cannot reduce that conditional while `Input` is still a type variable.
      // Input types are checked at the defineTool call site, where they are
      // concrete; here they are validated at runtime by the SDK.
      const inputSchema: z.ZodTypeAny = spec.inputSchema;
      const outputSchema: z.ZodTypeAny = spec.outputSchema;

      server.registerTool(
        spec.name,
        {
          title: spec.title,
          description: spec.description,
          inputSchema,
          outputSchema,
          annotations: {
            // ADR-002's read-only rule, declared to clients.
            readOnlyHint: true,
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: false,
          },
        },
        (args) => safeHandler(args as z.infer<Input>),
      );
    },
  };
}
