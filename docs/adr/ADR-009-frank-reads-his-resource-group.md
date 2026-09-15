# ADR-009: Frank reads his own resource group

**Status:** Accepted
**Date:** 2026-09

## Context

Frank's whole tool surface is `get_status`, which reports on Frank. He already
holds Azure credentials at runtime — ADR-010 injects the subscription, resource
group and service principal into the container — and does nothing with them.

ADR-007 rejected authenticating `/mcp` on two facts this ADR changes: Frank read
one seat's own group, and returned a bare inventory. The group is now class-wide
and `get_resource` returns more. We have read ADR-007's revisit trigger and judge
it still unmet — the group holds disposable student demos and nothing else.

## Decision

**The scope is the resource group, and it is not a parameter.** Both tools read
`AZURE_RESOURCE_GROUP` from config; neither accepts a subscription, resource
group or resource path.

**Two tools**, per ADR-002:

- `list_resources` — every resource in the group: name, ARM type, location, tags.
  Optional filter on the full ARM type string, applied after the fetch.
- `get_resource` — one resource, by **name and ARM type together** (a name alone
  is unique only per type), adding SKU, provisioning state and timestamps. No
  match returns `isError: true`.

**Both resolve by listing the group**, following paging to the end — that avoids
per-provider API versions, and one response serves both. Cache the listing for 30
seconds, shared, not populated on failure: one identity, thirty consoles polling.

**Build the client lazily.** `@azure/arm-resources` with `DefaultAzureCredential`.
The Azure settings are optional in `loadConfig` and the client is constructed on
first call, so Frank boots and serves `get_status` with no Azure access and
`npm test` runs offline, as the Dockerfile requires. Both tools stay listed when
unconfigured.

## Consequences

- Overview gets something to show; Tools gets real parameters to render a form
  from. The cost is two dependencies and their MSAL/`@azure/core-*` tree, in the
  image and the lockfile, plus results up to 30 seconds stale.
- **Anonymous callers get the inventory plus SKUs, tags and timestamps.**
  Acceptable for a disposable group of student demos, and worth saying out loud.
- Rejected: **a `resource_group` parameter** — RBAC already confines the
  credential to this group, so it would mostly return authorization failures, and
  accepting an input whose only use is to attempt that is worse than omitting it;
  **Azure Monitor metrics and logs**, a second SDK and permission story belonging
  with ADR-008; and **authenticating `/mcp`** — ADR-007, already Rejected.
