# Architecture Decision Records

The decisions Frank is built from. Read them before writing code — and point
your agents at them by number (*"implement ADR-003"*).

| ADR | Decision | Status |
|---|---|---|
| [ADR-000](ADR-000-record-architecture-decisions.md) | Record architecture decisions as ADRs | Accepted |
| [ADR-001](ADR-001-mcp-server-stack.md) | Frank's stack: TypeScript + official MCP SDK, Streamable HTTP | Accepted |
| [ADR-002](ADR-002-mcp-tool-conventions.md) | Tool naming, schemas, and the read-only rule | Accepted |
| [ADR-003](ADR-003-cloudscape-ui.md) | The console: React + Vite + Cloudscape | Accepted |
| [ADR-004](ADR-004-azure-hosting.md) | Hosting: Container Apps (Frank) + Static Web Apps (UI) | Accepted — partly superseded by 008 |
| [ADR-005](ADR-005-github-actions-deployment.md) | Deployment: GitHub Actions with OIDC to Azure | Accepted — partly superseded by 008 |
| [ADR-008](ADR-008-classroom-credentials.md) | Classroom credentials + one container (partly supersedes 004, 005) | Proposed |
| ADR-006 | Connect Frank to the GitHub pipeline | *written in class* |
| ADR-007 | Grant Frank read access to his Azure environment | *written in class* |

New ADR? Copy [`template.md`](template.md), take the next number, and follow the
workflow in ADR-000: **Claude drafts → Copilot attacks → a human decides.**
