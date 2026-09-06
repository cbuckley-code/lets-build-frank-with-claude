/**
 * The console's connection to Frank.
 *
 * The endpoint is the relative path `/mcp`. Under ADR-009 the console is served
 * by Frank's own Express app, so there is no configured URL to inject at build
 * time and no CORS to negotiate — wherever the console is loaded from, Frank is
 * at the same origin.
 *
 * Protocol handling is the official SDK's job; the console never assembles a
 * JSON-RPC message itself.
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { FrankClient, FrankStatus, ToolCallOutcome, ToolInfo } from "./types.js";

export const MCP_ENDPOINT = "/mcp";

const CLIENT_INFO = { name: "frank-console", version: "0.1.0" };

/** Pull the first text block out of a tool result. */
function textOf(result: CallToolResult): string {
  const block = result.content?.find((item) => item.type === "text");
  return block && "text" in block ? String(block.text) : "";
}

export function createFrankClient(endpoint: string = MCP_ENDPOINT): FrankClient {
  let connecting: Promise<Client> | null = null;

  async function connect(): Promise<Client> {
    if (!connecting) {
      connecting = (async () => {
        const client = new Client(CLIENT_INFO);
        const url = new URL(endpoint, window.location.origin);
        await client.connect(new StreamableHTTPClientTransport(url));
        return client;
      })();

      // A failed connection must not be cached, or the console can never
      // recover without a page reload.
      connecting.catch(() => {
        connecting = null;
      });
    }

    return connecting;
  }

  async function call(name: string, args: Record<string, unknown>): Promise<ToolCallOutcome> {
    const client = await connect();
    const result = (await client.callTool({ name, arguments: args })) as CallToolResult;

    return {
      isError: result.isError === true,
      text: textOf(result),
      structured: result.structuredContent,
    };
  }

  return {
    async getStatus(): Promise<FrankStatus> {
      const outcome = await call("get_status", {});
      if (outcome.isError) {
        throw new Error(outcome.text || "Frank could not report his status.");
      }
      return outcome.structured as FrankStatus;
    },

    async listTools(): Promise<ToolInfo[]> {
      const client = await connect();
      const { tools } = await client.listTools();
      return tools as ToolInfo[];
    },

    callTool: call,
  };
}
