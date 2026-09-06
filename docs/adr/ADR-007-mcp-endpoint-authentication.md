# ADR-007: Frank's MCP endpoint requires caller authentication

**Status:** **Rejected** (2026-09-06)
**Date:** 2026-09

**Supersession — VOID, this ADR was rejected.** Had it been accepted it would
have replaced exactly one clause of ADR-003: *"The UI
holds **no secrets** — it can only reach what Frank exposes, and Frank is
read-only per ADR-002."* Under this ADR the console holds a bearer token. The
rest of ADR-003 — React + Vite + Cloudscape, the Overview and Tools pages,
schema-driven forms — **remains in force**, and the second half of that
sentence still holds: Frank is still read-only per ADR-002, and the console
still reaches nothing Frank does not expose.

**Extends** ADR-001, which specified `POST /mcp` and said nothing about who may
call it. ADR-001 is unchanged.

**Depends on ADR-006, which is still Proposed.** Every deployment instruction
below assumes ADR-006's single container, seat model, and `deploy.yml` shape.
**If ADR-006 is not accepted, this ADR must be re-drafted, not implemented.**

**Amends ADR-006's credential count.** ADR-006 says *"The student adds **one**
GitHub secret, `AZURE_CREDENTIALS`"*; under this ADR they add **two**. ADR-006
is still Proposed, so this is an amendment rather than a supersession, but it
must not be left implicit — three artefacts assert "one secret" today and all
three are updated as part of implementing this ADR:
`docs/adr/ADR-006-classroom-credentials.md:57`, the header comment at
`.github/workflows/deploy.yml:5`, and `README.md:118`. A fourth line needs the
same treatment for a different reason: `server/README.md:44` says *"No secrets
belong here"* directly above the environment table this ADR adds
`FRANK_MCP_TOKEN` to — reword it to say that the table names the variable while
its value lives only in GitHub secrets, Azure, and an untracked
`server/.env.local`. Nothing else about
ADR-006's credential model changes: the seat card, the client secret, its 2-day
expiry, and the Contributor-on-one-resource-group scope are untouched.

> **Separately, for a human to resolve:** ADR-006 already replaced ADR-003's
> `VITE_FRANK_URL` build-time URL and CORS allowlist without declaring it. That
> is an unrecorded supersession predating this ADR; it is ADR-006's to fix, not
> this one's, and it is not fixed here.

## Decision outcome — REJECTED

Considered and declined for the classroom build. Frank's `POST /mcp` stays
**unauthenticated**.

**Why.** The seats live in the instructor's own subscription, every resource
group is torn down the same day, and the tools Frank exposes read only that
seat's own resource group — there is no `resource_group` parameter to point him
elsewhere. Against that, authentication costs a token prompt in the console, a
second seat secret, and an `mcp-remote` bridge for the Desktop demo, which is
the moment the whole day builds toward.

**What this accepts, stated plainly rather than hidden.** The FQDN is not a
secret: it is printed to the Actions job summary and appears in Certificate
Transparency logs within minutes of ingress issuing a certificate, where
automated scanners will find it. For the life of the class, anyone who finds a
seat URL can call `tools/list` and every tool on it. Once ADR-009 grants
`Reader`, that includes a read-only view of one seat resource group's inventory
— resource names, types, locations. No credentials, no data, no write path.

**What bounds it.** Read-only tools (ADR-002); one resource group of scope, not
the subscription; no tool parameter that redirects the scope; and same-day
teardown of every resource group and app registration.

**When this must be revisited.** If the class is ever run against a subscription
that holds anything real, if seats survive the day, or if a tool is added that
returns more than an inventory. Any of those, and this ADR gets a successor.

The analysis below is kept intact because the trade-off is worth teaching: it is
a decision made with eyes open, not an oversight.

---

## Context

`deploy.yml` creates the Container App with `--ingress external`, and ADR-006
collapsed everything onto it: console at `/`, MCP at `POST /mcp`, health at
`GET /healthz`. Frank's Express app has no authentication anywhere. Anyone who
knows the FQDN can `tools/list` and call every tool. The FQDN is not a secret:
it is printed to the Actions job summary, it appears in Certificate
Transparency logs the moment ingress issues a certificate, and students will
paste it into chat to show each other.

Today that buys an attacker very little — `get_status` and `get_node_version`.
**ADR-009, written in class, changes that.** It grants the Container App's
managed identity `Reader` on the seat's resource group so Frank can report on
his own world. From that moment an anonymous internet caller has a read-only
window into someone's Azure environment. ADR-002's read-only rule bounds *what*
a caller can do; it says nothing about *who* the caller is. The two controls are
not substitutes, and the authentication one has to land first.

The MCP specification's answer is OAuth 2.1 with protected-resource metadata.
That requires an authorization server and a client registration, and ADR-006
already established the blocking fact: students commonly cannot create Entra app
registrations, and the instructor does not know who is in the room in time to
pre-provision one each. Whatever we choose has to work for three caller shapes —
the Cloudscape console in a browser, Claude Code, and the Claude Desktop
connector used in the closing demo — without any of them needing rights the
class does not have.

## Decision

**Every `POST /mcp` request must carry `Authorization: Bearer <token>`.**
Requests without a valid token are refused before their body is parsed.

### Server

**Config.** Add `FRANK_MCP_TOKEN` to the zod schema in `server/src/config.ts` as
`z.string().min(32)` with **no default**, and `mcpToken: string` (required, not
optional) to the `Config` interface. A container started without it fails at
boot with the existing plain-language config error. (That "fail at boot, not at
first request" behaviour is `server/src/config.ts:36`'s established practice,
not a clause of ADR-001 — ADR-001 says only that config comes from environment
variables.) There is no "auth disabled when unset" mode, and
`mcpToken` must not be made optional to avoid one — an optional field is that
mode wearing a different hat.

**Call sites.** Add `server/test/helpers.ts` — safe, because
`server/vitest.config.ts:6` collects only `test/**/*.test.ts` — exporting:

```ts
export const TEST_TOKEN = "t".repeat(32);
export const validEnv = (overrides = {}) => ({ FRANK_MCP_TOKEN: TEST_TOKEN, ...overrides });
```

Two distinct sets of call sites break. **Neither is caught by a type-check**:
`server/tsconfig.json:21` includes only `src/**/*.ts`, so `npm run typecheck`
and `npm run build` never look at `server/test/`, and `vitest run` transpiles
without checking types. Both sets therefore fail at *runtime*, as red suites —
do not expect the compiler to find them for you:

- **`createApp({...})` literals** — three of them:
  `server/test/mcp-http.test.ts:24`, `server/test/static-console.test.ts:31`,
  `server/test/static-console.test.ts:138`. Each gains `mcpToken: TEST_TOKEN`.
- **`loadConfig(...)` calls** — a missing token is now a throw rather than a
  default. Every existing call in `server/test/config.test.ts` (lines 7, 11, 15,
  19, 20, 24, 28, 29) passes its environment through `validEnv({...})`. The only
  calls that omit the token are the two new cases asserting that omission throws.

Tests assert against `TEST_TOKEN`; they do not each invent a token.

**Middleware.** In `server/src/app.ts`, register the check on `POST /mcp`
*before* `express.json()`, so an unauthenticated caller never gets a 1 MB body
parsed on their behalf. Specifically:

- Read `Authorization`; require the literal prefix `Bearer ` (case-sensitive
  scheme, one space).
- Compare the presented token to `config.mcpToken` with `crypto.timingSafeEqual`
  over the **SHA-256 digests** of both strings — equal length by construction,
  so the comparison leaks neither timing nor length.
- On failure respond `401` with `WWW-Authenticate: Bearer realm="frank"` and the
  existing `jsonRpcError` shape: code `-32001` (unused today), message
  `"Frank's MCP endpoint requires an Authorization: Bearer token."`
- A missing token and a wrong token produce the **identical** response.
- Log `"[frank] rejected an unauthenticated /mcp request"` and nothing else — no
  header, no presented value, and **no client address**: Express runs with
  `trust proxy` off behind Container Apps ingress, so `req.ip` is the internal
  proxy and logging it would be confidently wrong.

**What stays open, deliberately.** `GET /healthz` remains unauthenticated —
Container Apps probes it, and it discloses only version and uptime. The console
bundle at `/` and its static assets remain unauthenticated; they contain no
secret (see below). The existing `GET /mcp` and `DELETE /mcp` 405 handlers stay
as they are: the SDK treats a 405 on the SSE GET as the expected "no
notifications" reply, whereas a 401 there throws for any client without an
`authProvider`.

### Console

The token is **not** built into the bundle. Ownership and flow, exactly:

**`ui/src/App.tsx` is not modified, and neither are the pages.** `AppProps`
keeps `client: FrankClient` and `initialPage?: PageId` exactly as they are —
that is the injection seam `ui/test/pages.test.tsx:159,164` renders through, and
breaking it to thread a token would cost the console's existing coverage for no
gain. The authentication concern lives entirely in two new places:

- **`ui/src/frank/client.ts`** — signature becomes
  `createFrankClient(options?: { endpoint?: string; getToken?: () => string | null; onUnauthorized?: () => void })`.
  `getToken` is called on **each** `connect()`. When it returns a non-null
  string, pass `requestInit: { headers: { Authorization: "Bearer " + token } }`
  to `StreamableHTTPClientTransport` (the SDK merges `requestInit.headers` last,
  so it wins). **When it returns `null`, omit the `Authorization` header
  entirely** — never send the string `"Bearer null"`. The client catches
  `StreamableHTTPError` with `code === 401` (thrown at
  `streamableHttp.js:365` with `code === response.status`; there is no
  `authProvider`, so this is the only 401 path), calls `onUnauthorized()`, and
  **re-throws** so the page's existing error handling still runs.
- **`ui/src/Root.tsx`** (new) — owns the token. `useState` initialised from
  `sessionStorage.getItem("frank.mcpToken")`;
  `const client = useMemo(() => createFrankClient({ getToken: () => token, onUnauthorized: reject }), [token])`,
  where `reject` clears `sessionStorage`, sets the token to `null`, and records
  that the last token was refused. Because the memo is keyed on `token`, a new
  token yields a new client and the old memoised connection is discarded —
  there is no `reset()` to write.
- **`ui/src/main.tsx`** — renders `<Root />` instead of
  `<App client={createFrankClient()} />`.
- **While no token is held**, `Root` renders only the Cloudscape `Modal` and
  does **not** render `App` at all — so no `AppLayout`, no side navigation, and
  no page mounts. Nothing calls Frank until a token exists, so there is no
  spurious first 401.
- **Modal copy.** First prompt: *"Frank needs your MCP token."* After a
  rejection: *"That token was rejected."* The second string appears only via
  `onUnauthorized`; every other failure keeps the existing *"Frank did not
  answer"* alert in `ui/src/pages/Overview.tsx:79`. These two paths must not be
  collapsed.
- Storage is `sessionStorage`, not `localStorage`: closing the tab discards it.

The modal links to the **"Your MCP token"** section that this ADR adds to
`server/README.md`, which is also where a student recovers a token they have
lost (`server/.env.local`, see below).

### Getting the token to the container

- New repository secret `FRANK_MCP_TOKEN`.
- `scripts/setup-seat.sh` generates it once (`openssl rand -hex 32`), and:
  1. sets it with `gh secret set FRANK_MCP_TOKEN`;
  2. writes `server/.env.local` as `FRANK_MCP_TOKEN=<token>` — already covered
     by `server/.gitignore`'s `.env.*`, so it cannot be committed;
  3. prints it once.

  The file is the recovery path, so "printed once" is not the only copy. The
  token is **not** on the seat card, so ADR-006's instructor pre-provisioning is
  unchanged.

  **Precondition:** `setup-seat.sh` today sets only `AZURE_RESOURCE_GROUP` and
  `CONTAINER_APP_NAME`, though `deploy.yml`'s preflight also requires `ACR_NAME`
  and `CONTAINERAPPS_ENV` — ADR-006's "sets all of them in one command" is
  already false. Fix that gap in the same change; do not add a fifth item to a
  script that is already missing two.
- `deploy.yml`'s preflight fails loudly on an empty `FRANK_MCP_TOKEN`, in the
  same style as the `AZURE_CREDENTIALS` check, reading it through an `env:`
  binding — never inline `${{ }}` expansion into a shell line.
- **Every** shell step that touches the token — preflight, create, and update
  alike — reads it from an `env:` binding (`TOKEN: ${{ secrets.FRANK_MCP_TOKEN }}`)
  and refers to it as `"$TOKEN"`. The no-inline-`${{ }}` rule above is not
  scoped to the preflight: a `${{ }}` expansion anywhere in a `run:` line is the
  injection shape this ADR forbids, and the snippets below assume that binding
  is present.
- The deploy passes it as a Container Apps **secret**, never a bare env var, and
  **without adding a control-plane round trip**. On the `create` branch:
  `--secrets frank-mcp-token="$TOKEN" --env-vars FRANK_MCP_TOKEN=secretref:frank-mcp-token`.
  On the `update` branch: one `az containerapp secret set`, then fold
  `--set-env-vars FRANK_MCP_TOKEN=secretref:frank-mcp-token` into the
  **existing** `az containerapp update --image` call rather than issuing a
  second one — otherwise every deploy makes an extra call and an extra revision.

### Local development

`npm run dev` would otherwise fail at boot for every student, since the token is
required. Change `server/package.json` to:

```json
"predev": "node scripts/ensure-dev-token.mjs",
"dev": "tsx watch --env-file=.env.local src/index.ts"
```

`server/scripts/ensure-dev-token.mjs` creates `server/.env.local` with a freshly
generated token **only if the file is absent**, and prints where it put it.
The `predev` step is not optional politeness: **Node's `--env-file` throws
ENOENT when the file is missing** (the tolerant spelling, `--env-file-if-exists`,
is not available across all Node 22 patch releases), so without `predev` a fresh
clone dies on a filesystem error instead of Frank's own plain-language message.
`setup-seat.sh` writes the same file when it runs.

**`npm start` needs the same treatment.** `server/README.md:33-34` documents
`npm run build && npm start` as the local end-to-end recipe, and
`server/package.json:14` is a bare `node dist/index.js` with no env file — so it
breaks for exactly the reason `dev` did. Change it to
`node --env-file=.env.local dist/index.js` with a matching `prestart`, or have
the README recipe export `FRANK_MCP_TOKEN` first; either is fine, but the ADR
does not leave `start` broken while fixing `dev`.

Document both in `server/README.md`'s environment table, and note in
`ui/README.md` that the Vite dev proxy now forwards a request the console will
only send once a token is entered. Also update that file's source-tree map at
`ui/README.md:72`, which currently says `main.tsx mounts App with the real MCP
client` and does not list `Root.tsx` at all.

### Clients

```bash
# curl
curl -H "Authorization: Bearer $FRANK_MCP_TOKEN" -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' https://<fqdn>/mcp

# Claude Code
claude mcp add --transport http frank https://<fqdn>/mcp \
  --header "Authorization: Bearer $FRANK_MCP_TOKEN"
```

Claude Desktop's custom connectors negotiate OAuth and offer no field for a
static header, so Desktop connects through a stdio bridge in
`claude_desktop_config.json`:
`npx -y mcp-remote https://<fqdn>/mcp --header "Authorization: Bearer <token>"`.
**This is the one step in this ADR that must be proven in the trial run before
the ADR is accepted.** If the bridge does not work on the day, the closing demo
runs from Claude Code — the same lesson with a different client. It is not
solved by turning authentication off.

### Rotation

`setup-seat.sh` gains real flag parsing (it has none today — the first argument
is taken as a card path), including `--rotate-token`: generate a new token,
update the GitHub secret, rewrite `server/.env.local`, and then trigger a deploy
with `gh workflow run build-and-deploy`. **Rotating a secret produces no
commit**, and while the workflow itself also runs on `pull_request`
(`deploy.yml:20-25`), the `deploy` job is gated by
`if: github.event_name != 'pull_request'` (`deploy.yml:59`) — so
`workflow_dispatch`, not a push and not a PR, is what re-deploys. The token's real
lifetime is the seat's: two days, and it dies with the resource group (ADR-006).

### Tests

**Existing tests break first.** Every current caller of `POST /mcp` in the
server suites will now get a 401, so these are repairs, not additions:

There are exactly three, named individually — no "and any others", because
that hedge is what hid the second one:

- `server/test/mcp-http.test.ts:38` — the transport inside the shared
  `connect()` helper. Must pass
  `{ requestInit: { headers: { Authorization: "Bearer " + TEST_TOKEN } } }`.
  Fixing this one helper covers that file's handshake, `tools/list`, call-tool
  and no-arguments cases.
- `server/test/static-console.test.ts:85` — a second, independent transport, in
  the *"still answers POST /mcp over the real MCP client"* test. Same change.
- `server/test/static-console.test.ts:101` — the raw `fetch` to `/mcp` that
  asserts `200` at `:107`. Add the header to its existing `headers` object.

**New server cases:**

- `server/test/config.test.ts` — missing and too-short `FRANK_MCP_TOKEN` each
  throw at load.
- `server/test/mcp-http.test.ts` — no header, wrong scheme, wrong token, correct
  token; and `/healthz` still answers unauthenticated. **Not** the console-asset
  case: that suite deliberately boots against an empty `publicDir`, so there is
  no asset to fetch.
- `server/test/static-console.test.ts` — a console asset still answers
  unauthenticated.

**New console cases** — `ui/test/token-gate.test.tsx`. The 401 path is the one
this ADR calls fragile, so it does not ship untested:

- with no stored token, `Root` renders the modal and does not mount `App`;
- submitting a token stores it in `sessionStorage` and mounts `App`;
- the client sends `Authorization: Bearer <token>`, and sends no
  `Authorization` header at all when `getToken` returns `null`;
- a `StreamableHTTPError` with `code === 401` clears storage and re-opens the
  modal with *"That token was rejected."*;
- any other error does **not** clear storage and leaves the existing
  *"Frank did not answer"* alert in place.

`ui/test/pages.test.tsx` needs no change — `App`'s props are unchanged.

## Consequences

- **Frank stops being an open door before ADR-009 gives him anything worth
  taking.** The ordering is the whole point: this must be implemented and
  deployed before the Azure `Reader` grant, not in the same afternoon and not
  after.
- **A second runtime password now exists** — in the student's GitHub secrets,
  their terminal scrollback, and `server/.env.local` on disk. ADR-006 removed
  `AZURE_STATIC_WEB_APPS_API_TOKEN` and this adds one back; note that ADR-006
  never claimed the pipeline was password-free, since `AZURE_CREDENTIALS` is
  itself a deployable password it admits to. So this is a second password beside
  an existing one, not a fall from grace. It is materially smaller — read access
  to one classroom Frank, not deploy rights to a resource group — and bounded by
  the same two-day seat lifetime and same-day teardown.
- **A shared bearer token is not identity.** Frank learns that a caller holds
  the token, not who they are. No per-caller attribution, no revoking one client
  without rotating for all, no audit trail beyond "someone with the token".
  Acceptable at one Frank per student. Not acceptable the moment a Frank is
  shared between people, which is the trigger for the OAuth ADR this one defers.
- **ADR-003's "the UI holds no secrets" is now false**, and that is a genuine
  loss: it was a clean property that made the console safe to deploy anywhere.
  It is traded for the endpoint not being anonymous, and the trade is only worth
  it because ADR-009 is coming.
- **The console gains a prompt, and a new way to fail.** It no longer just loads
  and works — a real regression, and the direct price of the endpoint not being
  public. A mistyped token presents as "Frank is down" unless the 401 path is
  implemented exactly as specified, which is why it is specified rather than
  left to the implementer.
- **The Desktop demo gets harder**: an `npx` bridge instead of pasting a URL,
  and one more thing that can fail on stage. This is the largest risk this ADR
  introduces and the reason it is Proposed rather than obvious.
- **Three documents start lying the moment this ships** unless they are updated
  in the same change — ADR-006's "one GitHub secret", `deploy.yml`'s header
  comment, and `README.md`'s "one secret and four variables". They are listed
  above rather than left for a reader to discover.
- **Ongoing cost**: one env var, one secret, one preflight branch, one modal,
  flag parsing in a script that has none, a `.env.local` on every laptop, and
  roughly eight tests to keep passing.

**Rejected, with reasons:**

- **OAuth 2.1 with MCP protected-resource metadata** — the specification's
  answer and the right production one. It needs an authorization server and a
  client registration per student, and ADR-006 established that students
  frequently cannot create Entra app registrations at all. Correct, and not
  buildable in a one-day class. This ADR is the thing OAuth eventually
  supersedes.
- **Container Apps built-in authentication (EasyAuth)** — auth at the ingress,
  no code in Frank. Configuring it requires an Entra app registration, the same
  blocker; it redirects browsers rather than returning 401 to programmatic MCP
  clients; and it would teach the class nothing about how an MCP server defends
  itself.
- **IP allow-listing on the ingress** — a room on hotel or corporate NAT, plus
  any hybrid attendee, makes this fail unpredictably, and it grants full access
  to everyone in the room regardless.
- **Token as a query parameter (`/mcp?token=…`)** — easier for every client, and
  it deposits the secret in access logs, `Referer` headers, and browser history.
  Rejected outright.
- **Switching the ingress to internal** — kills the console, kills Desktop, and
  removes the point of deploying a remote MCP server at all.
- **Baking the token into the UI bundle as a `VITE_` variable** — makes the
  console "just work" and publishes the token to anyone who fetches
  `/assets/index-*.js`. That is not authentication.
- **Making `mcpToken` optional so tests and `npm run dev` keep working** — the
  path of least resistance, and it silently reintroduces an unauthenticated
  Frank whenever the variable is unset. Solved instead with an explicit test
  constant and `.env.local`.
- **Leaving `/mcp` open until ADR-009 lands** — plausible sequencing, and worse.
  The class's first push to `main` happens well before the Azure grant, so
  "we'll add auth later" means the door is open at exactly the moment twenty
  students are pasting their FQDNs into a chat window.
