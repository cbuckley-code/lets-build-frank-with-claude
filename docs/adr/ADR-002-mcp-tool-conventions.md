# ADR-002: Tool naming, schemas, and the read-only rule

**Status:** Accepted
**Date:** 2026-08

## Context

MCP clients choose tools by reading their names and descriptions — the tool
surface *is* the UX, for both humans and models. Inconsistent naming or vague
descriptions make agents pick the wrong tool or invent parameters. And because
Frank will later hold credentials into Azure (ADR-009, written in class), we
need a hard rule about what tools are allowed to do.

## Decision

**Naming.** Tools are named `verb_noun`, lower snake_case:
`get_status`, `list_resource_groups`, `get_recent_deployments`. Verbs come from
a closed set: `get`, `list`, `search`, `summarize`. Note what's absent:
`create`, `update`, `delete`, `run` are **not** in the set.

**Descriptions.** One or two sentences, written for a model deciding whether to
call the tool: what it returns, when to use it, and any limits. Every parameter
gets a description too.

**Schemas.** Inputs validated with `zod`; unknown fields rejected. Outputs are
structured JSON with a top-level `summary` string (human/model-readable) plus
typed detail fields. Errors return `isError: true` with a plain-language message
— never a stack trace.

**The read-only rule.** Frank observes; he does not act. No tool may mutate any
external system — not Azure, not GitHub, not the file system beyond temp space.
Any future write capability requires a new ADR with its own identity, scope, and
approval story.

**First tool.** Frank ships with `get_status` (returns version, uptime, and a
greeting) so the pipeline, client wiring, and UI can be proven before any Azure
integration exists.

## Consequences

- Agents integrate against a predictable surface; the class's skill file
  (`.claude/skills/frank-tools/`) teaches these conventions once and they hold everywhere.
- The read-only rule bounds the blast radius of every credential Frank ever holds,
  and it is enforceable in review: a PR adding `delete_*` is visibly out of policy.
- Cost: some genuinely useful write features are off the table until argued in an ADR. Intentional.
