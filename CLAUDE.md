# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

The classroom for a one-day course. **Frank** is the system built in it: an MCP
server (TypeScript, official SDK, Streamable HTTP over Express) that also serves
a Cloudscape web console, shipped as **one container** to Azure Container Apps
by `.github/workflows/deploy.yml`.

`server/` and `ui/` contain only `.gitkeep`. That is deliberate — they are built
during the class from the ADRs. Do not scaffold them incidentally; when asked to
implement, implement **from the ADR**, not from guesswork.

## The ADRs are the specification

`docs/adr/` is the source of truth. Work is requested by number ("implement
ADR-009"). Read the relevant ADR before writing anything in `server/` or `ui/`.

Rules from ADR-000 that apply every time:

- An **Accepted** ADR is immutable. To change course, write a new ADR that
  supersedes it and names the exact clauses it replaces. The only permitted edit
  to an accepted ADR is its **Status** line.
- A declined decision is recorded as **Rejected**, not deleted. ADR-007 is the
  worked example — read it for reasoning, never implement it.
- Workflow: Claude drafts → Copilot attacks → a human decides → PR. The `/adr`
  command scaffolds from `docs/adr/template.md`, takes the next number, and
  names the `adr-reviewer` agent explicitly.
- **Supersession is partial and precise.** ADR-006 replaces parts of 003/004/005;
  ADR-010 replaces ADR-006's credential model and distribution. Large parts of
  the superseded ADRs remain in force. Read the Status preamble of ADR-006 and
  ADR-010 before citing ADR-003, ADR-004 or ADR-005.

## Cross-file constraints

These cannot be inferred from any single file, and breaking one breaks the deploy.

- **Port 3000 is load-bearing in three places that must agree:** the `PORT`
  default in the server's config, `ENV PORT`/`EXPOSE` in the `Dockerfile`, and
  `--target-port 3000` in `deploy.yml`.
- **One container, two things.** Express serves the built console from
  `<server package root>/public` at `/`, MCP at `POST /mcp`, health at
  `GET /healthz`. There is **no separate UI host, no CORS config and no
  `VITE_FRANK_URL`** — the console calls `/mcp` relatively. ADR-006 supersedes
  ADR-003's cross-origin wiring.
- **The console is optional.** Frank must build, deploy and serve MCP with `ui/`
  empty. The Dockerfile's ui stage builds only when `ui/package.json` exists and
  otherwise leaves an empty `dist`; the server must say so at `/` rather than
  fail. Never make the server require the console's build output.
- **The build context is the repository root**, not `server/` — a `server/`-scoped
  build cannot reach `ui/`.
- **Frank's Azure scope comes from the environment, never from a tool parameter.**
  `deploy.yml` injects `AZURE_SUBSCRIPTION_ID`, `AZURE_RESOURCE_GROUP`,
  `AZURE_CLIENT_ID`, `AZURE_TENANT_ID` and a secret-ref `AZURE_CLIENT_SECRET` so
  `DefaultAzureCredential` picks them up. A caller must not be able to redirect
  him at another scope. There is no managed identity — ADR-010 removed it.
- **Config is environment variables only** (ADR-001). No config files holding
  values.

## MCP tool conventions (ADR-002)

`verb_noun`, lower snake_case, verb from the **closed set** `get` / `list` /
`search` / `summarize`. `create_*`, `update_*`, `delete_*` and `run_*` are out of
policy and need a superseding ADR, not a code review argument.

`zod` input schemas with unknown fields rejected and **every parameter
described**. Output is structured JSON: a top-level `summary` string plus typed
detail fields. Errors return `isError: true` with a plain-language message,
never a stack trace.

One module per tool under `server/src/tools/`, registered in one list, with a
test in `server/test/`. **Frank is read-only** — no tool may mutate Azure,
GitHub, or the filesystem beyond temp space. The `frank-tools` skill carries the
full version of these rules.

## Commands

`server/` and `ui/` are each a self-contained npm package. The Dockerfile and the
workflow invoke exactly these names, so they must exist (ADR-001, ADR-003):

```bash
# in server/ or ui/
npm ci
npm test
npm run build      # server -> dist/ ; ui -> dist/
npm run dev        # local iteration
```

A single test is whatever the chosen runner takes once the package is
scaffolded, e.g. `npm test -- <pattern>` for vitest or node:test.

Build and run the whole thing the way the pipeline does:

```bash
docker build -t frank .        # context is the REPO ROOT
docker run --rm -p 3000:3000 frank
curl localhost:3000/healthz
```

## Deployment

Push to `main` deploys. PRs build and test only.

- On **PRs**, `build-server` and `build-ui` run but **self-skip while the package
  has no `package-lock.json`**, reporting success with a notice. They start doing
  real work the moment a lockfile is committed, with no change to the workflow.
- On **main** those jobs are skipped by design. The Docker build is the single
  build *and* the test gate: `npm test` runs inside both build stages, so a red
  suite fails the image build and nothing deploys. Tests must therefore pass
  offline, with no Azure credentials.
- The container app is `frank-<github-owner>`; the registry and Container Apps
  environment are **discovered** from `rg-frank-class` at deploy time.
- The pipeline **fetches its own Azure credential** from `CREDENTIAL_URL`,
  committed in `deploy.yml` (ADR-010). Students set no secrets and no variables.
  An `AZURE_CREDENTIALS` fork secret overrides the fetch — that is the
  instructor's manual override, not the normal path.
- `az containerapp up --source` is deliberately not used; it crashes on some
  azure-cli builds. Build with `az acr build`, then `create`/`update`.

## Security posture

The classroom credential is deliberately public, Contributor on one throwaway
resource group, expiring in two days. ADR-010 states exactly what that costs and
why it would be indefensible at work — it is a teaching contrast, not a pattern
to copy anywhere else in this repo.

Nothing else may be loose. Never put a credential in the repo, in a prompt, in
this file, or in an ADR. Run the `secret-scanner` agent before committing and
before opening a PR.

## `.claude/` is team config, and it is course material

`.claude/` is committed, inherited by forks, and meant to be read rather than
deleted: `skills/frank-tools/`, `agents/adr-reviewer.md` (opus — judgment),
`agents/tool-conventions.md` and `agents/secret-scanner.md` (haiku — mechanical
breadth), and `commands/adr.md`. All three agents are restricted to
`Read, Grep, Glob`: a reviewer that can edit the repository is not a reviewer.

**Skill and agent selection is model-mediated routing from the `description`,
not dispatch.** When delegation must happen, name the agent explicitly — which
is why `/adr` names `adr-reviewer` by hand. `.claude/README.md` explains the
model and is worth reading before changing anything in there.

## Conventions when changing things here

- Adding or re-statusing an ADR means updating the tables in **both**
  `README.md` and `docs/adr/README.md`.
- Branch protection on `main` is expected but **is not inherited by a fork** —
  set it yourself. Agents propose, a human merges, and pushing to `main` deploys
  to Azure.
