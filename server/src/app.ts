/**
 * The Express app. One container serves all three surfaces (ADR-006):
 *
 *   GET  /healthz   health probe
 *   POST /mcp       MCP over Streamable HTTP
 *   GET  /*         the Cloudscape console, static, from `publicDir`
 *
 * Because the console is served from Frank's own origin, it calls `/mcp`
 * relatively and there is no CORS configuration anywhere — that was the point
 * of collapsing to a single container.
 *
 * Ordering matters and is deliberate: the API routes are registered first, the
 * static handler second, and the SPA fallback last. The fallback additionally
 * refuses to answer for anything but GET/HEAD and skips the API paths outright,
 * so a POST to /mcp can never be answered with index.html.
 */
import { existsSync } from "node:fs";
import path from "node:path";
import express, { type Express, type NextFunction, type Request, type Response } from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { Config } from "./config.js";
import { createFrankServer } from "./frank.js";
import { VERSION, uptimeSeconds } from "./runtime.js";
import { fillMissingToolArguments } from "./tool-arguments.js";

/**
 * Paths the single-page-app fallback must never answer for. Frank's own
 * surfaces are here so that a typo'd method or a missing route returns an
 * honest error rather than a page of HTML.
 */
export const API_PATHS: readonly string[] = ["/mcp", "/healthz"];

/** JSON-RPC error body, for failures outside a tool call. */
function jsonRpcError(code: number, message: string) {
  return { jsonrpc: "2.0" as const, error: { code, message }, id: null };
}

export function createApp(config: Config): Express {
  const app = express();

  // ---- Frank's API surface. Registered first, so nothing below can shadow it.

  // No auth and no downstream checks: this answers "is this process alive".
  app.get("/healthz", (_req: Request, res: Response) => {
    res.status(200).json({
      status: "ok",
      version: VERSION,
      uptimeSeconds: uptimeSeconds(),
    });
  });

  // JSON parsing is scoped to this route: static asset requests have no body
  // worth parsing.
  app.post("/mcp", express.json({ limit: "1mb" }), async (req: Request, res: Response) => {
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
        res.status(500).json(jsonRpcError(-32603, "Frank could not handle that request."));
      }
    }
  });

  // Stateless mode has no stream to resume and no session to delete. Answering
  // 405 is also what the official client expects when a server offers no SSE
  // channel, so this is the documented "no notifications" reply, not an error.
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

  // ---- The console. Everything below only ever sees requests the API declined.

  const indexHtml = path.join(config.publicDir, "index.html");
  const consoleIsBuilt = existsSync(indexHtml);

  if (consoleIsBuilt) {
    app.use(
      express.static(config.publicDir, {
        // `/` is handled by the SPA fallback, so index.html is served from one
        // place with one set of headers.
        index: false,
        // Vite fingerprints asset filenames, so they are safe to cache hard.
        maxAge: "1y",
        setHeaders(res, filePath) {
          if (path.basename(filePath) === "index.html") {
            res.setHeader("Cache-Control", "no-cache");
          }
        },
      }),
    );

    app.use((req: Request, res: Response, next: NextFunction) => {
      // A single-page app only ever needs to answer document requests.
      if (req.method !== "GET" && req.method !== "HEAD") {
        return next();
      }
      // Belt and braces: these are already handled above, but the fallback must
      // never be the thing that answers for them.
      if (API_PATHS.includes(req.path)) {
        return next();
      }
      // A missing asset should 404, not silently return the app shell.
      if (req.path.includes(".")) {
        return next();
      }
      res.setHeader("Cache-Control", "no-cache");
      return res.sendFile(indexHtml);
    });
  } else {
    console.warn(
      `[frank] no console build at ${config.publicDir} — serving the API only. ` +
        "Run `npm run build` in ui/ and copy ui/dist there, or use the root Dockerfile.",
    );
  }

  // Anything still unclaimed is genuinely missing. Answer in JSON rather than
  // Express's default HTML page, so nothing in this container ever replies to a
  // failed API call with markup.
  app.use((req: Request, res: Response) => {
    res.status(404).json({ error: `Not found: ${req.method} ${req.path}` });
  });

  return app;
}
