# ADR-003: The console — React + Vite + Cloudscape

**Status:** Accepted — **partially superseded by ADR-006** (the build-time
`VITE_FRANK_URL` + CORS wiring only; the stack, pages, schema-driven forms and
"the UI holds no secrets" all remain in force)

## Context

Frank needs a human-facing web console: a place to see his status, browse his
tools, invoke them with a form, and read the results — without opening an AI
client. The course specifies the **Cloudscape Design System** (AWS's open-source
React component library) so the class practices building on a real, opinionated
design system rather than hand-rolled CSS.

## Decision

- **Stack:** React 18 + TypeScript, built with **Vite**, in `ui/` as a
  self-contained npm package (`npm run dev`, `npm run build`, `npm test`).
- **Components:** `@cloudscape-design/components` and
  `@cloudscape-design/global-styles` only. App shell, tables, forms, flashbar
  notifications — all Cloudscape; no second component library, no custom CSS
  beyond layout glue.
- **Pages (v1):**
  - *Overview* — Frank's `get_status` output and connection health.
  - *Tools* — the tool list from MCP discovery; selecting a tool renders a form
    from its input schema and shows the JSON result.
- **Talking to Frank:** the UI calls Frank's Streamable HTTP endpoint directly
  (`VITE_FRANK_URL` at build time). Frank's CORS allowlist admits the UI's
  origin. The UI holds **no secrets** — it can only reach what Frank exposes,
  and Frank is read-only per ADR-002.
- **Hosting:** static build output deployed per ADR-004.

## Consequences

- React + Vite is deeply in-distribution for agents; Cloudscape is
  well-documented and its patterns (table + header + actions) are consistent
  enough that agents scaffold correct pages quickly.
- Rendering forms from tool schemas means new tools appear in the UI with zero
  UI work — a concrete payoff of ADR-002's schema discipline.
- Cloudscape's look is unmistakably AWS-flavored while we deploy to Azure. That
  mild dissonance is a deliberate teaching point: design system ≠ cloud.
