# ADR-010: One deliberately open classroom credential, fetched by the pipeline

**Status:** Accepted — **supersedes ADR-006's credential model and distribution**
(ADR-006's single-container build, and its statement of what the classroom
trade-off costs, remain in force)
**Date:** 2026-09

## Context

ADR-006 gave every student their own resource group, app registration, client
secret, registry and Container Apps environment, delivered on a printed card and
applied by a setup script. A pilot run proved it works end to end — and proved it
does not scale. Per seat: five Azure objects and about two and a half minutes of
provisioning. For thirty students, a hundred and twenty objects, each one a thing
that can be wrong on the morning.

Two attempts to fix it by being cleverer both failed:

- **A wildcard federated credential gated by GitHub org membership** — depends on
  `claimsMatchingExpression`, documented only through the Microsoft Graph *beta*
  API, and one app registration supports only about twenty federated credentials.
- **Pre-provisioned per-student repositories with exact OIDC federation** —
  correct, genuinely secretless, and an even larger object explosion.

Each attempt was more elaborate than the last **because each tried harder to keep
a secret**. The right question was whether the secret was worth keeping.

It is not. It exists for one afternoon, in a subscription used for nothing else,
and is deleted the same day.

Having stopped protecting it, a second question follows: why is the student
carrying it at all? Every setup step is a step thirty people of mixed skill can
get wrong, on a morning when nothing else is working yet. The best handling of a
secret is handling the student never does.

## Decision

**One credential for the whole class, treated as public.** One app registration,
one client secret, **Contributor on one resource group** in a disposable
subscription, expiring in two days.

**The student runs no setup commands at all.** They fork, they push, the pipeline
does the rest. `deploy.yml` fetches the credential from a URL committed in the
workflow. There is no command on screen to transcribe, no `gh` to authenticate,
no shell that behaves differently on Windows, and no way to set the secret on the
wrong repository.

**Served base64-encoded, by an endpoint that says nothing about itself.** A small
HTTP service, outside the disposable subscription so it outlives teardown, reads
one string from Key Vault through a managed identity and returns it:

- The value is stored **already encoded**, so the service is a byte pass-through.
  It never decodes, parses, or names a field.
- The route carries no vocabulary — a cohort path, not `/credential`.
- `text/plain`, the bare string. No JSON envelope with `clientSecret` sitting in
  it as a field name.
- Closed, expired, unknown cohort, missing secret: all return an identical empty
  `404`. Distinguishing them confirms to a prober that something is there.
- Instructor diagnostics live behind an ops header on the same route. There is no
  public health endpoint announcing that a secret is present.

**Base64 is for scanners, not for secrecy.** GitHub's secret scanning partners
with Microsoft, and a recognizable Azure client secret is liable to be detected
and **auto-revoked** — which breaks the class rather than protecting it. Encoding
removes that failure mode. It is not encryption and nothing here pretends it is.

**Mask before parsing.** The workflow masks the encoded string the moment it
arrives, decodes, then masks the decoded blob and the client secret. The ids are
left unmasked on purpose — they are not secret, as above, and masking them makes
every later error message unreadable. The fork is public, so its Actions logs are
public, and an unmasked value in a failed step is the one way this still bites.

**The instructor keeps a kill switch.** The service reads an enable flag and an
auto-close timestamp at request time, so it can be closed from the portal
mid-class and closes itself afterwards without being remembered. If
`AZURE_CREDENTIALS` is set on a fork it takes precedence over the fetch, which
leaves a manual override for anyone in a strange state at 3pm.

**No repository variables.** The resource group, registry and environment names
are committed in `deploy.yml`, because none of them is secret. That single
observation is what removes the seat card, the handout and the setup script.

**Shared infrastructure, one app each.** One registry and one Container Apps
environment for the class. The container app name is derived from
`github.repository_owner`, so **a student's GitHub account is their isolation**
and their URL carries their own name.

**Frank uses the same credential at runtime.** The deploy passes
`AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, `AZURE_TENANT_ID`,
`AZURE_SUBSCRIPTION_ID` and `AZURE_RESOURCE_GROUP` into the container;
`DefaultAzureCredential` picks them up. **This removes the managed identity and
the instructor's `Reader` handoff entirely** — which was the blocker that made
ADR-009 unimplementable.

**Do not commit the credential to the repository.** The published URL is the
channel, deliberately.

## Consequences

- **Provisioning is O(1).** Four shared objects for any class size, plus one
  container app per student. Thirty students cost what three do.
- **Setup is nothing.** Fork and push. This deletes the seat cards, three
  scripts, and the two class-stopping bugs found inside them — including
  `gh repo view` resolving to the upstream in a fork clone, which set the secret
  on the wrong repository and failed ten minutes later as something unrelated.
- **The service is now a single point of failure for every deploy, not just for
  setup.** Before, a student who had the secret was independent of it. Now it is
  load-bearing all afternoon, so it stays warm and the kill switch stays on for
  the whole session.
- **A committed URL is permanently discoverable** — code search, crawlers, and
  every fork-of-a-fork inherits it. Obscurity is no longer doing any work; the
  cohort path and the auto-close are. Old cohorts return `404` forever.
- **The credential is over-privileged for what Frank does.** It holds Contributor;
  Frank only reads. The read-only guarantee lives in ADR-002's tool surface, not
  in the credential.
- **Everyone shares one identity and one resource group.** A student can redeploy
  over another's app. It takes deliberate effort, since the name comes from their
  own account. The upside is that they can see each other's work.
- **The realistic abuse is compute, not data.** Contributor on a resource group
  means *create container apps*, and container apps run arbitrary containers. A
  scraped credential mines cryptocurrency; it does not exfiltrate anything,
  because there is nothing there. **Set a subscription budget before publishing.**
- **This is the deliberate opposite of ADR-005**, which wanted no deployable
  password anywhere. Teach the contrast: why it is acceptable for one afternoon
  in a disposable subscription, and why it would be indefensible at work. That is
  a better security lesson than a correct design nobody questions.
- **Teardown is three commands**: revoke the credential, delete the resource
  group, close the cohort.
