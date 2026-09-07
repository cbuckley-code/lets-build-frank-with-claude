# ADR-010: One deliberately open classroom credential

**Status:** Proposed — **supersedes ADR-006's credential model and distribution**
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

## Decision

**One credential for the whole class, treated as public.** One app registration,
one client secret, **Contributor on one resource group** in a disposable
subscription, expiring in two days.

**Published to an open URL.** `class-azure/publish-credential.sh` creates it and
uploads it to a public blob. The container name is a random token — the blob is
genuinely public, but not discoverable by crawling.

**The student runs two commands. That is the entire setup.**

```bash
gh secret set AZURE_CREDENTIALS --body "$(curl -s <the URL on screen>)"
git push origin main
```

**No repository variables.** The resource group, registry and environment names
are committed in `deploy.yml`, because none of them is secret. That single
observation is what removes the seat card, the handout and the setup script —
they existed only to move values that turned out not to need hiding.

**Shared infrastructure, one app each.** One registry and one Container Apps
environment for the class — the environment takes ~90 seconds to create, so it is
created once rather than thirty times. The container app name is derived from
`github.repository_owner`, so **a student's GitHub account is their isolation**
and their URL carries their own name.

**Frank uses the same credential at runtime.** The deploy passes
`AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, `AZURE_TENANT_ID`,
`AZURE_SUBSCRIPTION_ID` and `AZURE_RESOURCE_GROUP` into the container;
`DefaultAzureCredential` picks them up. **This removes the managed identity and
the instructor's `Reader` handoff entirely** — which was the blocker that made
ADR-009 unimplementable, because students cannot create role assignments and the
identity did not exist until first deploy.

**Do not commit the credential to the repository.** GitHub secret scanning
partners with Microsoft; a committed Azure client secret is liable to be detected
and **auto-revoked**, which breaks the class rather than protecting it. The
published URL is the channel, deliberately.

## Consequences

- **Provisioning is O(1).** Four shared objects for any class size, plus one
  container app per student. Thirty students cost what three do.
- **Three scripts and the seat cards are deleted** — `provision-class.sh`,
  `setup-seat.sh`, `handout.sh` — along with the two class-stopping bugs found
  inside them (`gh repo view` resolving to the upstream in a fork clone; the four
  pipeline variables the card never carried).
- **ADR-009 becomes implementable.** No role assignment, no managed identity, no
  privileged handoff after deploy.
- **The credential is over-privileged for what Frank does.** It holds Contributor;
  Frank only reads. The read-only guarantee lives in ADR-002's tool surface, not
  in the credential — say that plainly rather than implying the credential
  enforces it.
- **Everyone shares one identity and one resource group.** A student can redeploy
  over another's app. It takes deliberate effort, since the name comes from their
  own account, but it is possible. The upside is that they can see each other's
  work.
- **The realistic abuse is compute, not data.** Contributor on a resource group
  means *create container apps*, and container apps run arbitrary containers. A
  scraped credential mines cryptocurrency; it does not exfiltrate anything,
  because there is nothing there. **Set a subscription budget before publishing.**
- **This is the deliberate opposite of ADR-005**, which wanted no deployable
  password anywhere. Teach the contrast: why it is acceptable for one afternoon
  in a disposable subscription, and why it would be indefensible at work. That is
  a better security lesson than a correct design nobody questions.
- **Teardown is three commands**: revoke the credential, delete the resource
  group, done.
