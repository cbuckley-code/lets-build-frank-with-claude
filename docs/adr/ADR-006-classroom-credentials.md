# ADR-006: Classroom deploys use short-lived client secrets and one container

**Status:** Proposed — **partially supersedes ADR-003, ADR-004 and ADR-005**;
its credential model and distribution are themselves **superseded by ADR-010**
(the single-container build and the statement of what the classroom trade-off
costs remain in force)
**Date:** 2026-09

**Supersession, precisely.** Replaces ADR-004's **Static Web Apps hosting and
cross-origin UI wiring**; ADR-004 otherwise **remains in force** — in particular
its system-assigned managed identity with no role assignments, scale-to-zero
(min 0 / max 1), the `GET /healthz` probe, one resource group per student, and
single region. Replaces ADR-005's **Azure authentication, secret, and
deployment-target decisions**; its PR build-and-test behaviour remains in force
except where stated below.

Replaces one clause of **ADR-003**: *"the UI calls Frank's Streamable HTTP
endpoint directly (`VITE_FRANK_URL` at build time). Frank's CORS allowlist
admits the UI's origin."* Under this ADR the console is served by Frank at `/`
and calls `/mcp` **relatively** — there is no `VITE_FRANK_URL` and no CORS
configuration at all, because there is no cross-origin request. The rest of
ADR-003 remains in force, including React + Vite + Cloudscape, both pages, the
schema-driven forms, and *"the UI holds no secrets"*.

ADR-004 stays the authoritative source for its surviving decisions. They are
deliberately not restated here — duplicated rules drift.

## Context

ADR-005 chose GitHub OIDC federation so that "no deployable password exists
anywhere." That is the right production answer and we are giving it up, for a
reason that only appeared when we tried to run the class.

**A federated identity credential must name an exact subject** —
`repo:<owner>/<repo>:ref:refs/heads/main` or
`repo:<owner>/<repo>:environment:production`. Creating one requires knowing the
student's GitHub account **before** the credential exists. In an open-enrolment
class the instructor does not know who is in the room until they are in it.

Three findings from a full trial run make ADR-005 unworkable as written:

1. **The subject in ADR-005 is wrong anyway.** `deploy.yml`'s deploy jobs set
   `environment: production`, which changes the OIDC subject claim to
   `repo:OWNER/REPO:environment:production`. A credential federated to
   `ref:refs/heads/main`, exactly as ADR-005 instructs, never matches — every
   student would hit `AADSTS700213`.
2. **Students may lack the rights.** Creating an Entra app registration is
   commonly blocked for non-admins, and creating a role assignment requires
   **Owner** or **User Access Administrator** — *Contributor cannot assign
   roles*.
3. **Providers are not registered** on a fresh subscription, and registration
   takes tens of minutes.

We considered and **rejected** wildcard (flexible) federated credentials —
`repo:*/lets-build-frank-with-claude:environment:production`. Any person on the
internet could create a repository of that name and assume the identity.

## Decision

**Seats.** The instructor pre-provisions **N numbered seats** in their own
subscription before class. Per seat `NN`: resource group `rg-frank-seatNN`
(this narrows ADR-004's `rg-frank-<alias>` naming to a numbered scheme, since
attendees are unknown in advance), an Entra app registration and service
principal, a **client secret with 2-day expiry**, an **Azure Container
Registry**, and a **Container Apps environment** — the last two because
creating them in class costs ~75s each of dead time.

**Credentials.** The student adds **one** GitHub secret, `AZURE_CREDENTIALS`
(SDK-auth JSON), plus repository variables `AZURE_RESOURCE_GROUP`,
`CONTAINER_APP_NAME`, `ACR_NAME`, and `CONTAINERAPPS_ENV`. `scripts/setup-seat.sh`
sets all of them from the seat card in one command.

**One deploy target.** Azure Static Web Apps is dropped. Frank's Express app
serves the built Cloudscape console from the same container: console at `/`,
MCP at `POST /mcp`, health at `GET /healthz`. This removes
`AZURE_STATIC_WEB_APPS_API_TOKEN` — the only real password in the pipeline — all
CORS configuration, and the circular `VITE_FRANK_URL` bootstrap.

**Build shape.** A **root-level multi-stage Dockerfile**. Deploy with
`az acr build` followed by `az containerapp create`/`update` — **not**
`az containerapp up --source .`, which crashes on some azure-cli builds
(`OS.linux.value` on a `None`). `azure/login@v2` uses `creds:`; drop
`environment: production`, `id-token: write`, `FRANK_URL`, and `SWA_NAME`.

**Providers to pre-register** (subscription scope, instructor, well before
class): `Microsoft.App`, `Microsoft.OperationalInsights`,
`Microsoft.ContainerRegistry`. **`Microsoft.Web` is no longer required** — it was
only needed for Static Web Apps.

**Privileged handoff for ADR-009.** ADR-009 grants the Container App's managed
identity the `Reader` role. A student **cannot** do this: it is a role
assignment, their seat credential is Contributor-only, and the identity does not
exist until their first deploy creates the app. Therefore the instructor runs a
script **after** apps exist that assigns `Reader` on each seat's resource group
to that seat's app identity. Until that runs, Frank's Azure-read tools are
expected to fail closed with a plain-language error. **Without this handoff,
ADR-009 is unimplementable and the closing demo does not work.**

## Consequences

- **The class deploys.** No Entra rights, no role-assignment rights, no provider
  registration, and no advance knowledge of GitHub usernames required of students.
- **A deployable password now exists**, in N people's GitHub secrets, for two
  days. That is a real regression from ADR-005 and must be said out loud. It is
  bounded by one resource group of blast radius per secret, 2-day expiry, and
  same-day revocation.
- **Teardown.** Deleting the app registration stops *new* token issuance, but
  already-issued Azure access tokens stay valid for a short window — so deleting
  the **resource group** (and with it the role assignment) is the decisive
  containment step. Do both, same day.
- **The OIDC lesson survives as a projector demo** against the instructor's own
  repo. Students see the password-free path and learn why a classroom cannot use
  it — better than N simultaneous permission failures.
- Rejected: per-student OIDC (needs usernames in advance), wildcard FIC
  (anonymous door), AKS (a different course — cluster ops, ingress, DNS/TLS, and
  a shared blast radius, with no gain: the image build dominates either way).
