# Frank — the MCP server

Implements **ADR-001** (TypeScript, official MCP SDK, Streamable HTTP over
Express) and **ADR-002** (tool naming, schemas, and the read-only rule).

Under **ADR-009** this one container also serves the Cloudscape console, so
there is no CORS configuration anywhere — the console is same-origin and calls
`/mcp` relatively.

## Running it

```bash
npm ci
npm run dev      # tsx watch, reloads on change
npm test         # vitest
npm run build    # tsc -> dist/
npm start        # node dist/index.js
```

Frank listens on `PORT` (default **3000** — the port `deploy.yml` targets).

| Endpoint | Method | Purpose |
|---|---|---|
| `/mcp` | `POST` | MCP over Streamable HTTP |
| `/healthz` | `GET` | Container Apps health probe; returns 200 |
| `/*` | `GET` | The Cloudscape console, static, from `public/` |

`public/` is build output, not source: the root `Dockerfile` builds `ui/` and
copies `ui/dist` there. Without it Frank serves the API alone and says so at
startup — a server-only checkout still works. To try the whole thing locally:

```bash
cd ui && npm run build && cp -R dist ../server/public
cd ../server && npm run build && npm start   # console + MCP on :3000
```

The middleware order is load-bearing: API routes are registered first, then the
static handler, then an SPA fallback that answers only GET/HEAD and skips
`/mcp` and `/healthz` outright. `test/static-console.test.ts` exists to prove a
`POST /mcp` can never come back as a page of HTML.

## Configuration

All configuration is environment variables (ADR-001). No secrets belong here.

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | `3000` | HTTP port. Must stay 3000 in Azure — `deploy.yml` uses `--target-port 3000`. |
| `HOST` | `0.0.0.0` | Bind address. Containers must bind all interfaces. |
| `PUBLIC_DIR` | `<package>/public` | Where the built console lives. Mainly a test seam. |

## Tests

The runner is **vitest**, chosen so `server/` and the Vite-based `ui/` (ADR-003)
share one test runner and the class learns one tool.

```bash
npm test                              # everything
npx vitest run test/mcp-http.test.ts  # one file
npx vitest run -t "health probe"      # filter by test name  <- the filter flag is -t
npm run test:watch                    # watch mode
```

`test/mcp-http.test.ts` starts the real Express app on an ephemeral port and
drives it with the official MCP **client**, so the transport contract in ADR-001
is tested the way Claude Desktop and the console will actually use it.

## Adding a tool

One module per tool in `src/tools/`, then add it to the array in
`src/tools/index.ts`.

```ts
export const listThingsTool = defineTool({
  name: "list_things",          // verb_noun; verb from get|list|search|summarize
  title: "List things",
  description: "What it returns, when to use it, and any limits.",
  inputSchema: z.object({ ... }).strict(),      // unknown fields rejected
  outputSchema: z.object({ summary: z.string(), ... }).strict(),
  handler: (input) => ok({ summary: "...", ... }),
});
```

`defineTool` enforces ADR-002 at construction: an out-of-policy name (`create_*`,
`update_*`, `delete_*`, `run_*`, or anything not `verb_noun`) or a missing
description throws at process start, and `test/tool-conventions.test.ts` catches
it in CI. It also wraps every handler so a thrown error becomes
`isError: true` with a plain-language message — the stack stays in the
container's logs.

## Layout

```
src/
  index.ts           entrypoint: config + listen
  app.ts             Express app: POST /mcp, GET /healthz, console + SPA fallback
  frank.ts           builds the McpServer and registers the tools
  config.ts          environment variables -> Config
  runtime.ts         version (from package.json), Node version, and uptime
  result.ts          ADR-002's output contract: ok() / failure()
  tool-arguments.ts  normalises tools/call requests that omit `arguments`
  tools/
    define.ts            defineTool — where ADR-002 is enforced in code
    get-status.ts        the first tool
    get-node-version.ts  the Node runtime this process is running on
    index.ts             the registry
```
