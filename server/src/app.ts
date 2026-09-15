// Frank's HTTP surface (ADR-001, ADR-006):
//   GET  /healthz  -> 200 for container probes
//   POST /mcp      -> MCP over Streamable HTTP
//   /              -> the built Cloudscape console, when it exists
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import express, { type Express, type Request, type Response } from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { Config } from './config.js';
import { createTools, registerTools, type FrankTool } from './tools/index.js';

export interface AppOptions {
  config: Config;
  /** Override the tool list. Tests use this to inject a failing tool. */
  tools?: readonly FrankTool[];
}

const METHOD_NOT_ALLOWED = {
  jsonrpc: '2.0',
  error: { code: -32000, message: 'Method not allowed. Frank speaks MCP over POST /mcp.' },
  id: null,
};

export function createApp({ config, tools = createTools(config) }: AppOptions): Express {
  const app = express();
  app.disable('x-powered-by');

  app.get('/healthz', (_req, res) => {
    res.status(200).json({ status: 'ok', version: config.version, uptimeSeconds: Math.floor(process.uptime()) });
  });

  // Stateless Streamable HTTP: a fresh server and transport per request. Frank
  // runs at most one replica and scales to zero, so there is no session to keep.
  app.post('/mcp', express.json({ limit: '1mb' }), async (req: Request, res: Response) => {
    const server = new McpServer({ name: 'frank', version: config.version });
    registerTools(server, tools);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on('close', () => {
      void transport.close();
      void server.close();
    });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (err) {
      console.error('MCP request failed:', err instanceof Error ? err.message : err);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: { code: -32603, message: 'Frank could not handle that request.' },
          id: null,
        });
      }
    }
  });

  app.get('/mcp', (_req, res) => {
    res.status(405).json(METHOD_NOT_ALLOWED);
  });
  app.delete('/mcp', (_req, res) => {
    res.status(405).json(METHOD_NOT_ALLOWED);
  });

  // The console is a static Vite build served from <package root>/public.
  // During `npm run dev` it usually does not exist yet; say so instead of 404.
  const indexHtml = join(config.publicDir, 'index.html');
  if (existsSync(indexHtml)) {
    app.use(express.static(config.publicDir));
    // Client-side routes fall back to the SPA shell. Express 5 wildcard syntax.
    app.get('/{*splat}', (req, res, next) => {
      if (req.method !== 'GET' || !req.accepts('html')) return next();
      res.sendFile(indexHtml);
    });
  } else {
    app.get('/', (_req, res) => {
      res
        .status(404)
        .type('text/plain')
        .send('The console has not been built yet (ADR-003). Frank is listening at POST /mcp and GET /healthz.');
    });
  }

  return app;
}
