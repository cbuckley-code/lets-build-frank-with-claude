---
description: Scaffold a new ADR from the template, take the next number, and run it past the reviewer before you commit.
argument-hint: <short decision title>
---

Draft a new architecture decision record for: **$ARGUMENTS**

Follow this repository's process exactly:

1. Read `docs/adr/template.md` and the two or three existing ADRs closest to
   this topic, so the new one matches their voice and level of detail.
2. Take the **next unused number** in `docs/adr/`.
3. Write `docs/adr/ADR-NNN-<kebab-title>.md` with **Status: Proposed** and
   today's date, using the template's Context → Decision → Consequences.
   - The Decision must be specific enough that an agent told "implement
     ADR-NNN" needs no follow-up questions.
   - The Consequences must name real costs and the alternatives you rejected,
     with reasons. An ADR with no downsides has not been thought through.
4. If this decision changes anything in an **Accepted** ADR, do not edit that
   file. Say which ADR it supersedes, and mark it in the new ADR's status.
5. Update the tables in **both** `docs/adr/README.md` and `README.md`.
6. Hand the draft to the `adr-reviewer` agent and show me its findings verbatim
   before you suggest committing. Say which findings you accept and which you
   reject, and why.

Leave it uncommitted. Accepting a decision is a human's call.
