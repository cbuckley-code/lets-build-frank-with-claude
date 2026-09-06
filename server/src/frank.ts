/**
 * Frank himself: an MCP server built on the official SDK (ADR-001). There is no
 * hand-rolled protocol code anywhere in this repo — the SDK owns the wire.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { VERSION } from "./runtime.js";
import { TOOLS } from "./tools/index.js";

export function createFrankServer(): McpServer {
  const server = new McpServer(
    { name: "frank", version: VERSION },
    {
      capabilities: { tools: {} },
      instructions:
        "Frank is a read-only assistant. Every tool observes and reports; none of " +
        "them changes anything. Tool names are verb_noun, where the verb is one of " +
        "get, list, search or summarize.",
    },
  );

  for (const tool of TOOLS) {
    tool.register(server);
  }

  return server;
}
