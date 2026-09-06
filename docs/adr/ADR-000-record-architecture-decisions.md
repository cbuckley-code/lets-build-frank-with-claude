# ADR-000: Record architecture decisions as ADRs

**Status:** Accepted
**Date:** 2026-08

## Context

This project is built primarily *by AI agents directed by engineers*. Agents are
strongest when working in-distribution — on patterns their training data covered
deeply. A team's private context (why we chose X, what "done" means here, what
must never be touched) is out-of-distribution by definition, unless it is
written down and placed in the agent's context.

We need a lightweight, durable way to capture decisions so that:

- any agent session (Claude, Copilot, or future tools) can be pointed at a
  decision and told "implement this";
- decisions survive across sessions, people, and models;
- reviewing a one-page decision is easier than reviewing a 40-file diff.

## Decision

We record every significant architecture decision as an ADR in `docs/adr/`,
numbered sequentially, using the template in [`template.md`](template.md):
**Context → Decision → Consequences**, one page maximum.

Workflow:

1. Draft the ADR with Claude (`/adr` command scaffolds it).
2. Have Copilot attack the draft: edge cases, security holes, simpler alternatives.
3. A human decides; the ADR is committed via PR.
4. Implementation prompts reference the ADR by number: *"implement ADR-008."*

An ADR is immutable once **Accepted**. To change course, write a new ADR that
**Supersedes** the old one — wholly, or naming the exact clauses it replaces
while the rest stays in force.

A decision that is considered and **declined** is recorded as **Rejected**, not
deleted. The reasoning is the point: a rejected ADR tells a future reader what
was weighed and what the alternative cost, which is exactly what stops the same
argument being had twice.

One narrow exception: the **Status line** of a superseded ADR may be updated to
record that it was superseded, and by which ADR. That is lifecycle metadata, not
a rewrite of the decision. Body text, date, rationale, and consequences stay
exactly as they were — the point of an ADR is that you can read what was decided
and why, at the time.

## Consequences

- Decisions become executable intent for agents — the in-distribution bridge.
- New joiners (human or agent) read `docs/adr/` and know why things are the way they are.
- Slight ceremony cost per decision; we accept it. Trivial choices don't need ADRs.
