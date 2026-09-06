# Frank's console

React 18 + TypeScript + Vite, built with the **Cloudscape Design System**
(ADR-003). Served by Frank himself from one container (ADR-006).

## Running it

```bash
npm ci
npm run dev      # Vite on :5173, proxying /mcp to a local Frank on :3000
npm test         # vitest + jsdom
npm run build    # tsc --noEmit && vite build -> dist/
```

`npm run dev` needs Frank running (`cd ../server && npm run dev`). The dev
server proxies `/mcp` and `/healthz` to `127.0.0.1:3000`, so the *same relative
path* works in development and in production.

## How it talks to Frank

The endpoint is the literal string `/mcp` — a relative path. Under ADR-006 the
console is served from Frank's own origin, so there is:

- no `VITE_FRANK_URL` and no `FRANK_URL`,
- no build-time URL injection, and
- no CORS to configure.

Protocol handling is the official `@modelcontextprotocol/sdk` client. The
console never assembles a JSON-RPC message itself.

## Pages

| Page | What it shows |
|---|---|
| Overview | `get_status` output — version, uptime, greeting — and connection health |
| Tools | The tool list from MCP discovery; selecting one renders a form from its input schema and shows the JSON result |

## Why the Tools page needs no work when a tool is added

`src/frank/schema.ts` turns a tool's advertised JSON Schema into form fields and
turns filled-in fields back into arguments. Nothing in the UI knows what
`get_status` is. A new tool with a well-described zod schema (ADR-002) appears
with a working form and no UI change — which is the payoff ADR-003 is after.

Type mapping: `string` → text input, `number`/`integer` → number input,
`boolean` → checkbox, `enum` → select, anything else → a JSON textarea. Untouched
optional fields are omitted rather than sent as empty strings, because Frank's
schemas are strict.

## Tests

```bash
npm test                            # everything
npx vitest run -t "renders a form"  # filter by test name  <- the filter flag is -t
npx vitest run test/schema.test.ts  # single file
```

`test/fake-client.ts` stands in for Frank, shaped like real MCP responses. The
pages depend on the `FrankClient` interface rather than on the SDK, so no test
touches the network.

## Styling

Cloudscape components and `@cloudscape-design/global-styles` only — no second
component library. `src/app.css` is the entire custom stylesheet: four rules so
a `<pre>` of JSON wraps and scrolls, which no Cloudscape component does.

## Layout

```
src/
  main.tsx           mounts App with the real MCP client
  App.tsx            AppLayout + SideNavigation + the two pages
  app.css            layout glue, and nothing else
  frank/
    client.ts        the MCP client, pointed at the relative /mcp
    schema.ts        JSON Schema <-> form fields (pure, heavily tested)
    format.ts        uptime, timestamps, error messages
    types.ts         FrankClient and the shapes it returns
  pages/
    Overview.tsx     status and connection health
    Tools.tsx        discovery, selection, result
    ToolForm.tsx     the schema-driven form
```
