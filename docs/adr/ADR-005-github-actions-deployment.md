# ADR-005: Deployment — GitHub Actions with OIDC to Azure

**Status:** Accepted — **partially superseded by ADR-006** (Azure authentication, secrets,
and deployment target; the PR build-and-test behaviour remains in force)
**Date:** 2026-08

## Context

Every push to `main` should ship Frank and the console to Azure with no manual
steps — and the pipeline must be safe to run from dozens of student forks.
The classic approach (a service-principal password stored as a secret) means a
long-lived credential sitting in every fork. GitHub's OIDC federation lets a
workflow exchange a short-lived token for Azure access with **no stored
password at all**.

## Decision

One workflow, [`.github/workflows/deploy.yml`](../../.github/workflows/deploy.yml):

- **Pull requests** → build and test `server/` and `ui/`. No deploy, no Azure login.
- **Push to `main`** (and manual `workflow_dispatch`) → build, test, then deploy:
  Frank to Container Apps, the console to Static Web Apps, per ADR-004.
- **Auth:** `azure/login` with **OIDC federated credentials**. Each student
  creates an Entra app registration federated to *their fork's* `main` branch,
  and its principal is granted **Contributor on `rg-frank-<alias>` only** —
  never subscription scope.
- **Secrets in the fork** (identifiers, not passwords):
  `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID` — plus
  `AZURE_STATIC_WEB_APPS_API_TOKEN` for the SWA deploy step.
- **Workflow permissions:** `id-token: write, contents: read`. Nothing more.
- Repository variables (not secrets) hold non-sensitive names:
  `AZURE_RESOURCE_GROUP`, `CONTAINER_APP_NAME`, `SWA_NAME`, `FRANK_URL`.

## Consequences

- No deployable password exists anywhere — nothing to leak from a fork, nothing
  to rotate after class. The classroom threat model gets dramatically simpler.
- The RG-scoped grant enforces ADR-004's blast radius in IAM, not just in prose.
- Students see the modern pattern (OIDC federation) instead of the legacy one
  they'd have to unlearn.
- Cost: one-time Entra setup per student — scripted and done together in class.
