# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

The classroom repo for a one-day course. **Frank** is an MCP server (TypeScript,
official `@modelcontextprotocol/sdk`, Streamable HTTP over Express) that also
serves a Cloudscape web console, shipped as one container to Azure Container
Apps by GitHub Actions.

`ui/` is **empty on purpose** (just `.gitkeep`) and `server/` starts that way
on `main`; both are built from the ADRs in `docs/adr/`. Read the ADRs before writing code and cite them
by number in commits and PRs. The `instructor/` directory mentioned in the
README lives on the `instructor` branch, not `main`.

## Commands

The Dockerfile and `deploy.yml` call these scripts, so each package **must**
define them:

```bash
# server/  (Frank)                      # ui/  (console)
cd server && npm ci                     cd ui && npm ci
npm run dev                             npm run dev
npm test                                npm test
npm run build   # -> server/dist        npm run build   # -> ui/dist
```

Both packages need a committed `package-lock.json`; CI uses `npm ci` and the
PR jobs are skipped until the lockfile exists. `npm test` runs inside
`docker build` on every deploy, so tests must pass offline with no Azure
credentials.

Build and run the whole thing locally the way the pipeline does:

```bash
docker build -t frank .            # context is the repo ROOT, not server/
docker run -p 3000:3000 frank      # console at /, MCP at POST /mcp, GET /healthz
```

## Contracts that must line up

These values are fixed across `Dockerfile`, `deploy.yml`, and the server's
config. Changing one without the others breaks the deploy.

- **Port 3000.** `PORT` env var, default 3000. The pipeline deploys with
  `--target-port 3000`.
- **Routes.** Console at `/`, MCP at `POST /mcp`, health at `GET /healthz`.
- **Entry point.** `node dist/index.js` from the server package root.
- **Static console.** The image copies `ui/dist` to `<server package root>/public`;
  the server's config resolves that path and serves it. The UI calls `/mcp`
  **relatively**. There is no `VITE_FRANK_URL` and no CORS (ADR-006).
- **Runtime env vars** injected by the deploy: `AZURE_SUBSCRIPTION_ID`,
  `AZURE_RESOURCE_GROUP`, `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`,
  `AZURE_CLIENT_SECRET`. Use `DefaultAzureCredential`; it picks these up.
  The resource group is deliberately **not** a tool parameter (ADR-010).
- All config comes from environment variables. No config files with values.

## MCP tool conventions (ADR-002, enforced in review)

- Names are `verb_noun` snake_case with the verb from the **closed set**
  `get`, `list`, `search`, `summarize`. `create_`/`update_`/`delete_`/`run_`
  are out of policy and need a superseding ADR, not a tool.
- One module per tool in `server/src/tools/`, built with `defineTool` from
  `define.ts` (which enforces the name, description, and strict schema at load
  time) and listed in `createTools` in `server/src/tools/index.ts`. Tests go in
  `server/test/`; `conventions.test.ts` checks every tool in that list.
- Input: `zod` schema, unknown fields rejected, every parameter described.
  Output: JSON with a top-level `summary` string plus typed fields.
  Errors: `isError: true` with a plain-language message, never a stack trace.
- **Read-only rule.** No tool mutates any external system. Frank observes.
- First tool is `get_status` (version, uptime, greeting).

The `frank-tools` skill and the `tool-conventions` agent encode this. Run the
agent before opening a PR that touches `server/src/tools/`.

## Console (ADR-003)

React 18 + TypeScript + Vite in `ui/`. Only `@cloudscape-design/components`
and `@cloudscape-design/global-styles`; no second component library, no custom
CSS beyond layout glue. Two pages: *Overview* (`get_status` + connection
health) and *Tools* (tool list from MCP discovery; forms rendered from each
tool's input schema; JSON result shown). The UI holds no secrets.

## ADRs

- `docs/adr/README.md` has the index. Supersession is partial and precise:
  ADR-006 replaces the hosting/CORS parts of 003/004/005; ADR-010 replaces
  ADR-006's credential model. Read the **Status** line of each ADR to see which
  clauses still hold. ADR-007 is Rejected; do not implement it.
- Accepted ADRs are immutable. To change course, write a new ADR that
  supersedes the old one; only the old ADR's Status line may be edited.
- `/adr <title>` scaffolds a new ADR from `docs/adr/template.md`, takes the
  next number, updates both README tables, and hands the draft to the
  `adr-reviewer` agent. Leave it uncommitted; accepting is a human's call.
- ADR-009 (Frank reads his own resource group) is written in class. ADR-008
  is an optional stretch.

## Pipeline (`.github/workflows/deploy.yml`)

- **Pull requests:** build and test `server/` and `ui/` separately. No Azure.
- **Push to `main`:** deploys. There is no separate test job; the test gate is
  `npm test` inside the Dockerfile's build stages. Image is built with
  `az acr build` and deployed with `az containerapp create`/`update`
  (never `az containerapp up --source`, which crashes on some azure-cli builds).
- The container app is named `frank-<github owner>`; registry and environment
  are discovered from `AZURE_RESOURCE_GROUP` at deploy time.
- The only secret is `AZURE_CREDENTIALS`. It is deliberately public for the
  class (ADR-010) but must **never** be committed, pasted into prompts, or
  written into this file or an ADR. Run the `secret-scanner` agent before
  committing.

## `.claude/` is team config

Agents (`adr-reviewer` on opus, `tool-conventions` and `secret-scanner` on
haiku, all read-only), the `frank-tools` skill, and the `/adr` command are
committed and inherited by forks. Delegation to an agent is model-mediated
unless you name the agent explicitly; when review must happen, name it.
