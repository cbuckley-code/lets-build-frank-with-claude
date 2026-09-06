# What ships in `.claude/`

These are **working examples you inherit by forking**, not scaffolding to
delete. Read them, use them, then change one and see what happens.

```
.claude/
├── skills/frank-tools/SKILL.md   loaded when the model judges it relevant
├── agents/adr-reviewer.md        opus   — judgment work
├── agents/tool-conventions.md    haiku  — mechanical breadth
├── agents/secret-scanner.md      haiku  — mechanical breadth
└── commands/adr.md               /adr   — runs when you ask
```

## The mental model

| | When it loads | Who decides |
|---|---|---|
| `CLAUDE.md` + rules | **always** | you, by writing it |
| **skills** | **when relevant** | the model, from the `description` |
| **commands** | **when you ask** | you, by typing `/name` |
| **agents** | **when relevant** | the model, from the `description` |

The row that surprises people is the middle two: **you do not invoke a skill or
an agent. The model chooses it, by reading its `description`.**

Which makes the description the most important line in the file. A vague one
("helpful information about tools") never gets selected. A precise one — naming
the *situation*, not the *capability* — does. Compare:

> ❌ `description: Information about ADRs.`
> ✅ `description: Reviews an architecture decision record for defects before it is accepted. Use when an ADR has been drafted, changed, or is being considered for acceptance.`

The second names when to reach for it. That is a routing instruction to a
probabilistic model — strong influence, not a guarantee. Selection is
model-mediated, so treat it as steering, not dispatch.

## Different agents, different models — on purpose

This is the part most teams never set up, and it is where the money is.

- **`adr-reviewer` runs on `opus`.** Deciding whether a decision is
  implementable, and catching a contradiction between an ADR and a workflow
  file, is reasoning. Pay for it.
- **`tool-conventions` and `secret-scanner` run on `haiku`.** Reading many files
  and comparing them to a written checklist is mechanical. Breadth and low cost
  beat cleverness.

Paying Opus rates to grep for `create_` is waste. Running a security judgement
call on the cheapest model is a different kind of waste. **Pick the model for
the shape of the work.**

The second lever, which matters more than model choice for cost: **effort**
(`low` → `max`). Lowering effort on a capable model is often a better trade than
dropping to a weaker one.

## Also note the tool restrictions

Every agent here is limited to `Read, Grep, Glob`. A reviewer that can edit your
repository is not a reviewer. Least privilege applies to your agents too.

## Try this

1. Run `/adr <some decision>`. The command names the reviewer explicitly, so
   delegation happens every time — watch `adr-reviewer` run and return its
   findings.
2. Now ask *"is ADR-006 ready to accept?"* without naming the reviewer. It may
   or may not delegate. **That is the lesson, not a bug.**
3. Open `agents/adr-reviewer.md` and read its `description` again with that in
   mind.

**A description is a routing hint to a probabilistic model, not a dispatch
rule.** When you need delegation to happen reliably, name the agent — in a
command, or in `CLAUDE.md`. When you want the model to choose, write a
description that names the *situation*, and accept that it is a strong
influence rather than a guarantee.

(ADR-007 is the repo's example of a **Rejected** decision — authentication was
considered and declined. Read it for the reasoning, not as a live proposal.)
