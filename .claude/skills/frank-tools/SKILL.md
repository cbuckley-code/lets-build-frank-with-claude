---
name: frank-tools
description: Use when adding, naming, reviewing, or changing an MCP tool for Frank. Covers the verb_noun naming rule and its closed verb set, zod input schemas, the summary-plus-typed-fields output shape, error handling, and the read-only policy from ADR-002.
---

# Frank's tool conventions (ADR-002)

Apply these whenever a tool is added or changed. They are policy, not style.

## Naming
`verb_noun`, lower snake_case. The verb comes from a **closed set**:
`get`, `list`, `search`, `summarize`.

`create_*`, `update_*`, `delete_*`, and `run_*` are **out of policy**. If one is
genuinely needed, stop and say so — it requires a new ADR that supersedes
ADR-002, not a tool.

## Descriptions
One or two sentences, written for a *model deciding whether to call the tool*:
what it returns, when to use it, and its limits. Every parameter gets a
description too.

## Schemas
- Inputs validated with `zod`. Unknown fields rejected.
- Output is structured JSON: a top-level `summary` string a human or model can
  read, plus typed detail fields.
- Errors return `isError: true` with a plain-language message. Never a stack
  trace.

## Read-only
No tool may mutate any external system — not Azure, not GitHub, not the
filesystem beyond temp space.

## Where things live
One module per tool under `server/src/tools/`, registered in
`server/src/tools/index.ts`. Add a test in `server/test/` — including a
conventions test if you are adding a new verb.
