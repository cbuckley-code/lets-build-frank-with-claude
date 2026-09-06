/**
 * The Express app: Streamable HTTP at POST /mcp, health probe at GET /healthz
 * (ADR-001, ADR-004).
 *
 * Each POST gets a fresh server and transport, with no session id — the
 * stateless shape. It suits ADR-004's scale-to-zero Container App, where a
 * replica may disappear between two calls, and it lets one deployed Frank serve
 * a whole classroom of clients concurrently without shared state.
 */
import cors from "cors";
import express, { type Express, type Request, type Response } from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { Config } from "./config.js";
import { createFrankServer } from "./frank.js";
import { VERSION, uptimeSeconds } from "./runtime.js";
import { fillMissingToolArguments } from "./tool-arguments.js";

/** JSON-RPC error body, for failures that happen outside a tool call. */
function jsonRpcError(code: number, message: string) {
  return { jsonrpc: "2.0" as const, error: { code, message }, id: null };
}

export function createApp(config: Config): Express {
  const app = express();

  app.use(
    cors({
      // The console's origin arrives via CORS_ALLOWED_ORIGINS (ADR-003).
      // Empty list means no cross-origin browser access at all.
      origin: config.allowedOrigins.length > 0 ? config.allowedOrigins : false,
      methods: ["GET", "POST", "OPTIONS"],
      allowedHeaders: [
        "Content-Type",
        "Accept",
        "Authorization",
        "Mcp-Session-Id",
        "Mcp-Protocol-Version",
        "Last-Event-ID",
      ],
      exposedHeaders: ["Mcp-Session-Id"],
    }),
  );

  app.use(express.json({ limit: "1mb" }));

  // Container Apps health probe (ADR-004). No auth, no dependencies: it answers
  // "is this process alive", not "is everything downstream healthy".
  app.get("/healthz", (_req: Request, res: Response) => {
    res.status(200).json({
      status: "ok",
      version: VERSION,
      uptimeSeconds: uptimeSeconds(),
    });
  });

  app.post("/mcp", async (req: Request, res: Response) => {
    const server = createFrankServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // stateless
      // Plain JSON responses rather than SSE: simpler to curl in class, and
      // Frank sends no server-initiated notifications yet.
      enableJsonResponse: true,
    });

    res.on("close", () => {
      void transport.close();
      void server.close();
    });

    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, fillMissingToolArguments(req.body));
    } catch (error) {
      console.error("[frank] failed to handle an MCP request", error);
      if (!res.headersSent) {
        res
          .status(500)
          .json(jsonRpcError(-32603, "Frank could not handle that request."));
      }
    }
  });

  // Stateless mode has no stream to resume and no session to delete, so be
  // explicit rather than letting these 404.
  const methodNotAllowed = (_req: Request, res: Response): void => {
    res
      .status(405)
      .json(
        jsonRpcError(
          -32000,
          "Frank's MCP endpoint accepts POST only. GET /healthz reports health.",
        ),
      );
  };

  app.get("/mcp", methodNotAllowed);
  app.delete("/mcp", methodNotAllowed);

  return app;
}
