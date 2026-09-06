/**
 * A stand-in for Frank, shaped exactly like the real MCP responses. The pages
 * depend on the FrankClient interface, so no test needs a network.
 */
import type {
  FrankClient,
  FrankStatus,
  ToolCallOutcome,
  ToolInfo,
} from "../src/frank/types.js";

export const SAMPLE_STATUS: FrankStatus = {
  summary: "Frank 0.1.0 is up, 92s since start.",
  version: "0.1.0",
  uptimeSeconds: 92,
  startedAt: "2026-09-05T12:00:00.000Z",
  greeting: "Hello — Frank here.",
};

/** The real tools/list entry for get_status, copied from a live response. */
export const GET_STATUS_TOOL: ToolInfo = {
  name: "get_status",
  title: "Get Frank's status",
  description: "Returns Frank's version, how long this process has been running, and a greeting.",
  annotations: { readOnlyHint: true },
  inputSchema: {
    type: "object",
    properties: {
      name: {
        type: "string",
        minLength: 1,
        maxLength: 100,
        description: "Who Frank should greet. Omit for a generic greeting.",
      },
    },
    additionalProperties: false,
  },
};

export interface FakeOptions {
  status?: FrankStatus;
  tools?: ToolInfo[];
  failStatus?: Error;
  failList?: Error;
  outcome?: ToolCallOutcome;
}

export interface FakeClient extends FrankClient {
  readonly calls: { name: string; args: Record<string, unknown> }[];
}

export function createFakeClient(options: FakeOptions = {}): FakeClient {
  const calls: { name: string; args: Record<string, unknown> }[] = [];

  return {
    calls,
    async getStatus() {
      if (options.failStatus) throw options.failStatus;
      return options.status ?? SAMPLE_STATUS;
    },
    async listTools() {
      if (options.failList) throw options.failList;
      return options.tools ?? [GET_STATUS_TOOL];
    },
    async callTool(name, args) {
      calls.push({ name, args });
      return (
        options.outcome ?? {
          isError: false,
          text: JSON.stringify(SAMPLE_STATUS, null, 2),
          structured: SAMPLE_STATUS,
        }
      );
    },
  };
}
