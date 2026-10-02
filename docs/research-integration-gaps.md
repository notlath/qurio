# Research: open integration gaps (Qlik Answers on Expo SDK 57)

Researched 2026-09-01. Primary sources only: Qlik OpenAPI specs (`https://qlik.dev/specs/rest/*.json`, fetched live),
qlik.dev, help.qlik.com, developer.apple.com, developer.android.com, docs.expo.dev. Two Qlik Community items are
cited; both are by badged Qlik staff and are labelled as such.

## Summary

| # | Gap | Verdict |
|---|-----|---------|
| 1 | Token lifetimes and refresh semantics | PARTIAL |
| 2 | Tenant OIDC / OAuth discovery document | RESOLVED |
| 3 | `/oauth/revoke` extra params, cascade, client auth | UNRESOLVED — needs live tenant |
| 4 | Entitlement vs permission | PARTIAL |
| 5 | Resolving a citation to something viewable | RESOLVED |
| 6 | Rate limits: per-user or per-tenant | RESOLVED |
| 7 | Native OAuth client provisioning | RESOLVED |
| 8 | Streaming behaviour | PARTIAL |
| 9 | Thread visibility | PARTIAL |
| 10 | Agentic path — any supported route today | PARTIAL |
| 11 | MDM managed app configuration, both platforms | RESOLVED |
| 12 | Qlik guidance for native mobile clients | RESOLVED |

---

## 1. Token lifetimes and refresh semantics

**Question** — How long do Qlik access and refresh tokens live, do refresh tokens rotate, and what tenant policy affects them?

**Finding**
Qlik publishes lifetimes in exactly one place, the `@qlik/api` authentication page: *"A user will go through a login
flow to get hold of an access token that is valid for 6 hours. If a clientSecret is used a refresh token will also be
received. This can be used to refresh the access token and is valid for 30 days."* The 6 hours is corroborated
independently: the token-management tutorial's response example shows `"expires_in": 21600` alongside
`"expires_at": "2024-07-31T13:43:51.000Z"` — note that the tutorial example **does** carry `expires_in`, even though
the `oauth-token-response` schema does not declare it, so the field may be present on the wire.

Caveats that matter: that sentence describes `@qlik/api`'s browser OAuth2 config (`Oauth2AuthConfig`, which has
`clientSecret?`), not the Native/PKCE path, and it conditions the refresh token on a client secret rather than on
`offline_access`. Nothing published states whether refresh tokens **rotate** on use, whether the 30 days is idle or
absolute, or whether Native clients differ. The `oauth-refresh-request` schema requires only `grant_type` and
`refresh_token` — `client_id` is not even listed as an optional property, which is unusual for a public client.

A refresh token is a first-class, listable, admin-revocable tenant object: `oauth-token` has `id`, `userId`,
`tenantId`, `deviceType`, `description`, `lastUsed`. There is no `expiresAt` or `createdAt` on it. The presence of
`lastUsed` is suggestive of an idle-expiry model but proves nothing. `deviceType` ("Tablet, Phone etc.") and
`description` are settable on the authorization-code exchange — a mobile client can label its own token so a tenant
admin can identify and revoke it.

Tenant-configurable session policy exists and is public: `GET/PATCH /api/core/auth-settings` exposes
`userSessionInactivityTimeoutMinutes` (example 60) and `maxUserSessionLifespanMinutes` (example 1440, must be
divisible by 60), with `isDefault` when untouched. TenantAdmin only. The changelog frames these as controlling
*"user session behavior"* and says they *"apply tenant-wide"*. Whether they bound OAuth token/refresh validity or
only interactive browser sessions is **not stated anywhere**.

**Source**
- https://qlik.dev/toolkits/qlik-api/authentication — quoted above; `Oauth2AuthConfig` type block.
- https://qlik.dev/authenticate/oauth/manage-oauth-tokens — token response example with `expires_in: 21600`.
- `https://qlik.dev/specs/rest/oauth.json` — schemas `oauth-token-response`, `oauth-refresh-request`,
  `oauth-authorization-code-request` (fields `deviceType`, `description`).
- `https://qlik.dev/specs/rest/oauth-tokens.json` — schema `oauth-token`; paths `GET /api/v1/oauth-tokens`,
  `DELETE /api/v1/oauth-tokens/{tokenId}`.
- `https://qlik.dev/specs/rest/core/auth-settings.json` — schema `AuthSettingsResource`; path `/api/core/auth-settings`.
- https://qlik.dev/changelog/ § "Session policy management": *"These settings apply tenant-wide and help enforce
  security policies around session management."*

**Verdict** `PARTIAL`. Access token 6h and refresh token 30d are published; rotation, idle-vs-absolute, Native-client
behaviour, and the interaction with tenant session policy are not. Settling it takes one live tenant: exchange a code,
record `expires_at`; refresh once and check whether the response carries a *new* `refresh_token` (rotation) and whether
the old one still works; then leave a token idle past the tenant's inactivity timeout and try to refresh.

**Impact on the build** If refresh tokens rotate, the token store must write the new refresh token atomically on every
refresh or a crash mid-refresh logs the user out permanently; if they do not rotate, a simple read-modify-write is
fine. If the 30 days is idle-based, a user who opens the app monthly stays logged in indefinitely; if absolute, every
user is forced through the full browser consent flow every 30 days and the app needs a graceful re-auth path rather
than an error screen. If tenant session policy does bound tokens, an admin setting a 60-minute inactivity timeout
silently turns the app into a re-login-every-hour experience and that has to be surfaced, not swallowed.

---

## 2. Does a Qlik tenant serve OIDC discovery?

**Question** — Is there a discovery document on the tenant host for Qlik's own OAuth server?

**Finding**
Yes, but it is **RFC 8414 authorization-server metadata, not OIDC discovery**. There is a published, separately
specified endpoint: `GET /.well-known/oauth-authorization-server`, tier 1, `x-qlik-visibility: public`,
`x-qlik-stability: stable`. Its `oauth-metadata` schema declares exactly seven fields: `issuer`, `jwks_uri`,
`token_endpoint`, `revocation_endpoint`, `authorization_endpoint`, `grant_types_supported`,
`response_types_supported`. Examples confirm the tenant-host shape, e.g. `issuer: https://your-tenant.us.qlikcloud.com`,
`jwks_uri: https://your-tenant.us.qlikcloud.com/.well-known/jwks.json`.

There is **no** `/.well-known/openid-configuration` and no `/oauth/.well-known/*` in any published spec. The metadata
document also omits `registration_endpoint`, `scopes_supported`, `code_challenge_methods_supported`, and
`token_endpoint_auth_methods_supported`, so it cannot be used to feature-detect PKCE or the DCR endpoint. The admin
console corroborates the endpoint's existence from the other direction: *"select View OAuth configuration to display
authentication details for your Qlik Cloud tenant. This will show a code snippet with OAuth endpoints and settings, as
well as a URL that you can copy for use in external applications."*

The earlier assumption ("absent because the OAuth spec lists no such path") was wrong — the endpoint lives in its own
spec file, `https://qlik.dev/specs/rest/.well-known.json`, which is why it does not appear in `oauth.json`.

**Source**
- `https://qlik.dev/specs/rest/.well-known.json` — path `/.well-known/oauth-authorization-server`, schema `oauth-metadata`.
- https://qlik.dev/apis/rest/.well-known — *"Returns OAuth 2.0 metadata related to your tenant. Clients can use this
  information to programmatically configure their interactions with Qlik Cloud."*
- https://help.qlik.com/en-US/cloud-services/Subsystems/Hub/Content/Sense_Hub/Admin/mc-create-oauth-client.htm
  § "Viewing and copying the OAuth configuration".

**Verdict** `RESOLVED`.

**Impact on the build** The app can validate an MDM-supplied tenant hostname with one unauthenticated GET before ever
opening a browser, and can derive the three endpoints instead of string-concatenating them — which also survives any
future endpoint move. It cannot use `expo-auth-session`'s `fetchDiscoveryAsync`, which appends
`/.well-known/openid-configuration` and will 404; the endpoints must be assembled into a `DiscoveryDocument` by hand
(from this response, or hardcoded). Nothing in the document tells you whether PKCE is supported, so that stays a
compile-time assumption.

---

## 3. `/oauth/revoke` and extra parameters

**Question** — Does Qlik reject unknown body params on revoke, does revoking one token kill the other, and does a
public client need to authenticate to revoke?

**Finding**
The spec gives the request shape and nothing else. `oauth-revoke-request` is `type: object`, `required: [token]`, with
properties `token` and `token_type_hint` (enum `access_token` | `refresh_token`). It does **not** set
`additionalProperties: false`, so the schema does not forbid extra fields — but an OpenAPI schema is a description,
not a guarantee about the server's validator. Both `application/json` and `application/x-www-form-urlencoded` are
accepted. Responses are only `200` ("Token was revoked.") and `400` ("Invalid request."); there is no `401`, which is
weak evidence that client authentication is not required — RFC 7009 servers that require it return 401. Tier 2.

`expo-auth-session` does send `clientId`: `RevokeTokenRequestConfig` is
`{ clientId: string | undefined, clientSecret: string | undefined, extraHeaders: Record<string, string> | undefined,
token: string, tokenTypeHint: TokenTypeHint | undefined }`. So the request will carry a `client_id` field that Qlik's
schema does not mention.

Nothing published says whether revoking a refresh token cascades to its access tokens or vice versa. The separate
admin path `DELETE /api/v1/oauth-tokens/{tokenId}` is documented to be total — *"An `HTTP 204` status response
indicates the token has been revoked. Future requests made with that token will now fail"* — but that is the
token-record delete, not `/oauth/revoke`.

**Source**
- `https://qlik.dev/specs/rest/oauth.json` — schema `oauth-revoke-request`; path `/oauth/revoke` responses `200`/`400`.
- https://docs.expo.dev/versions/latest/sdk/auth-session/ — `RevokeTokenRequestConfig` field list.
- https://qlik.dev/authenticate/oauth/manage-oauth-tokens § "Revoke the token".

**Verdict** `UNRESOLVED — needs live tenant`. Four one-line curls settle it: (a) POST `/oauth/revoke` with
`{token, token_type_hint, client_id}` and see if it still returns 200; (b) revoke the refresh token, then immediately
call `/api/v1/users/me` with the still-unexpired access token; (c) revoke the access token, then try a refresh with
the refresh token; (d) do all of the above with no Authorization header, as a public client would.

**Impact on the build** If unknown params are rejected, `revokeAsync` cannot be used and sign-out needs a hand-rolled
POST. If revoking the refresh token does not kill the access token, sign-out must revoke both tokens (two tier-2
calls) rather than one, and must still clear local state if either call fails — otherwise "sign out" leaves a working
bearer token alive for up to six hours on a shared device.

---

## 4. Entitlement vs permission — how to tell them apart

**Question** — After authentication, how does the client distinguish "this tenant/user has no Qlik Answers" from
"this user cannot see *this* assistant"?

**Finding**
There are **three** distinct failure states, not two, and none of them is a single clean API call.

*Tenant-level entitlement.* Qlik Answers is a capacity add-on that rolls out per region and per tenant; a valid
subscription is not sufficient. The support FAQ is explicit: *"What if I have a valid subscription, but cannot use
Qlik Answers yet? Since launch, Qlik Answers has been rolled out across regions… Be on the lookout for an in-product
message alerting you once your tenant has access."* The licenses API is the wrong instrument for this: `licenseOverview`
`allotments[].name` is an enum of only `professional | analyzer | analyzer_time`, and `licenses/assignments` entries
carry only `type`, `subject`, `excess`, `created`. The only plausible carrier is the free-form
`licenseOverview.parameters[]` array ("Parameter set (provision) name" with `values`, e.g.
`{"name":"qlikAlerting","values":{"saas_alerting":"FULL"}}`) — **no published parameter name for Qlik Answers exists**.
`/licenses/overview` also documents `401` and `404 License not found` but no `403`, while `/licenses/assignments`
documents `403 Insufficient access`, so an ordinary user may or may not be able to read overview at all.

*User-level permission (the practical check).* Access to Answers is governed by custom-role scopes, not by license
type. The relevant OAuth-grantable scopes are `assistants` / `assistants:read` ("Basic query access to assistants"),
`knowledgebases:search` ("Search content in knowledge bases"), and `analysis-agent` ("Lets users use Qlik Answers to
analyse data…"). Qlik's own FAQ states the minimum: *"If you plan on asking questions to an assistant, you need the
'Data analysis' and 'Search knowledge base' scopes."* Crucially, `GET /api/v1/users/me` returns `assignedScopes`
(`AssignedScopes`, "An array of scopes assigned to a user", readOnly) — so the client can read the caller's effective
scopes directly. Note `/users/me` is documented as a **301 redirect** to `/api/v1/users/{id}`, which a fetch client
must follow with the Authorization header intact.

*Assistant-level access.* Space roles gate individual assistants independently of the above. `GET /api/v1/items` is
documented as *"Lists items that the user has access to"* and its `resourceType` enum includes both `assistant` and
`knowledgebase` — so `GET /api/v1/items?resourceType=assistant` is a direct, documented probe of which assistants this
user can see. On the assistants API itself, `GET /api/v1/assistants/{id}` documents `403` ("The user does not have
privileges to perform the requested action") and `404` separately, and the prompt endpoints document `403` and `404`
too, so a specific-assistant denial surfaces as 403 (or 404 if it does not exist / is invisible).

*A fourth state exists and is not an error code:* monthly question quota exhaustion. *"When you hit your limit, users
can no longer ask questions until the next month."* Also *"Questions that return an error do not consume question
capacity."*

**Source**
- https://community.qlik.com/t5/Official-Support-Articles/Qlik-Answers-Agentic-Analytics-FAQ/ta-p/2542617 —
  Qlik Support (Sonja_Bauernfeind, badged Support / Digital Support), created 2026-02-10, last updated 2026-08-06.
  Quotes above on rollout and on required scopes.
- https://qlik.dev/manage/access-control/scopes — rows `assistants`, `assistants:read`, `knowledgebases:search`,
  `analysis-agent`, `help-agent`, `thread-audits` (OAuth column ✓).
- `https://qlik.dev/specs/rest/users.json` — `User.assignedScopes` → `AssignedScopes`; `GET /api/v1/users/me` 301.
- `https://qlik.dev/specs/rest/licenses.json` — `licenseOverview.allotments[].name` enum; `assignmentsResponse`.
- `https://qlik.dev/specs/rest/items.json` — `itemResourceTypeEnum` contains `assistant` and `knowledgebase`;
  `GET /api/v1/items` "Lists items that the user has access to."
- `https://qlik.dev/specs/rest/assistants.json` — 403/404 responses on `/assistants/{id}` and the thread/invoke paths.
- https://help.qlik.com/…/QlikAnswers/administering-qlik-answers.htm § "Question capacity".

**Verdict** `PARTIAL`. The permission and per-assistant checks are fully answerable from public sources
(`assignedScopes` + `items?resourceType=assistant`). The tenant-entitlement check is not: no published field says
"this tenant has Qlik Answers". Settling it needs one call against a tenant that lacks the add-on —
`GET /api/v1/licenses/overview` as an ordinary user, plus `GET /api/v1/assistants` — to see whether entitlement
absence shows up as a named `parameters[]` entry, a 403, or an empty list indistinguishable from "no assistants
shared with you".

**Impact on the build** If a tenant-level signal exists, the app can show one honest "Qlik Answers is not enabled for
your organisation — contact your administrator" screen at launch. If it does not, the app has to infer it from an
empty assistant list plus missing scopes, which is the same observable as "an admin forgot to share the assistant" —
so the error copy has to hedge, and support burden goes up. Either way the quota-exhausted state needs its own
message; showing a generic failure for a 20-per-minute or monthly-quota rejection will look like a broken app.

---

## 5. Citations — can a mobile client resolve a source to something viewable?

**Question** — Can the client turn a `MessageSource` into readable text, a file, or a link?

**Finding**
Yes, on two independent routes, both published, stable, and public.

*Route A — chunk text.* `POST /api/v1/assistants/{assistantId}/sources/plaintexts`, "Bulk search source chunks",
takes `ChunksRefs` = `{ chunkIds: [uuid] }` and returns `202` with `sourcesPlaintext` =
`{ textByChunkId: { "<chunkId>": "<text>" } }`. `MessageSource.chunks[]` is `MessageSourceChunk`
(`{ chunkId, text? }`), so the chunk ids needed are already in the answer payload. Cheaper still: `promptInput` has
`includeText: boolean` ("Returns text from chunks in sources output. Default value is false.") — set it and the chunk
text arrives inline with the answer, no second call.

*Route B — the source document itself.*
`POST /api/v1/knowledgebases/{id}/datasources/{datasourceId}/actions/download`, "Download knowledgebase datasource
reference". Body is `downloadFile` = `{ path }` (example `"folder/file.pdf"`) — and `MessageSource.source` is exactly
that: *"Path to the document used"*, example `"Reference.md"`. Response `downloadFileResponse` is
`{ url, name, mimeType, spaceId, fileSize, lastUpdatedAt }` with `url` example `"/v1/temp-contents/65f4287d785c400fe6d1e861"`.
That resolves against the published temp-contents API: `GET /api/v1/temp-contents/{id}`, *"used to retrieve a temporary
content file… returns a valid (200 OK) in case the file exists and the user is authorized to view the contents…
returns a 410 Gone if the file has expired"*. Tier 2, 403 documented for insufficient privileges.

`MessageSource` also carries `lastIndexedAt`, so the UI can honestly say how stale a citation is.

*Deep link.* Qlik's own assistant URL format is documented in passing: *"…for example in
`https://tenant.region.qlikcloud.com/assistant/880c5981-77cd-4cb7-b79c-09d26c0b97a7/summary`…"*. That is a link to the
assistant, not to a citation; no per-document or per-chunk deep link is published.

**Source**
- `https://qlik.dev/specs/rest/assistants.json` — path `/api/v1/assistants/{assistantId}/sources/plaintexts`;
  schemas `ChunksRefs`, `sourcesPlaintext`, `MessageSource`, `MessageSourceChunk`, `promptInput.input.includeText`.
- `https://qlik.dev/specs/rest/knowledgebases.json` — path
  `/api/v1/knowledgebases/{id}/datasources/{datasourceId}/actions/download`; schemas `downloadFile`, `downloadFileResponse`.
- `https://qlik.dev/specs/rest/temp-contents.json` — `GET /api/v1/temp-contents/{id}`.
- https://qlik.dev/embed/qlik-embed/parameters — assistant URL example.

**Verdict** `RESOLVED`.

**Impact on the build** Citations are tappable. Tapping one can expand the cited chunk text inline with zero extra
network calls (set `includeText: true`), and "open source document" is a two-call sequence ending in a
`temp-contents` fetch whose `mimeType` decides the viewer. The download route is the only thing here that touches the
"no answer content persisted on device" line — a `temp-contents` body has to be rendered from memory or handed to a
system viewer, and the 410-Gone case needs handling because these URLs expire.

---

## 6. Rate limits: per-user or per-tenant?

**Question** — What is the scope of the tier limits, and what response headers drive backoff?

**Finding**
Both, plus a third limit specific to Answers that is stricter than either.

*Tier limits.* *"In general, rate limits for published APIs (documented on qlik.dev) are evaluated on a per tier, per
user, per tenant basis."* Tier 1 = 1,000/min, Tier 2 = 100/min, both *"evaluated over a 5-minute window to support
bursts of requests"*. *"All Qlik Cloud plans receive the same rate limit configuration. It's not possible to customize
this on a per-customer or per-tenant basis."*

*Tenant aggregate.* *"In addition to the per-user rate limit, there is a tenant rate limit which determines how many
users may send requests at the same time. This is determined by: `tenantRateLimit = (user rate limit) * (number of
users in the tenant) * 0.5`."*

*Headers.* Only `Retry-After`. *"you will receive an `HTTP 429 Too Many Requests` error response, and a `Retry-After`
HTTP header containing the number of seconds until you can retry."* The documented body is
`{"errors":[{"code":"HTTP-429","title":"API rate limit reached.","detail":"You need to wait 13 seconds until limit is
lifted."}]}`. There are **no** `X-RateLimit-*` headers anywhere in Qlik Cloud's published specs — I grepped all
downloaded spec files; the only rate-limit header declared is `retry-after` (integer, default 1). `X-RateLimit-*`
appears only in the Talend (`talend.qlik.dev`) SCIM API, a different product. Blast radius is tier-scoped: *"Calls to
endpoints in the same tier are all blocked in the waiting period. Calls to endpoints in other tiers are not
restricted."*

*The one that will actually bite.* Qlik Answers has hard guardrails quoted per **subscription**, not per user:
*"Knowledge base search rate limit: 50 per minute per subscription. Assistant question rate limit: 20 per minute per
subscription."* Twenty questions per minute across the whole tenant is two orders of magnitude below the tier-2 limit.

**Source**
- https://qlik.dev/apis/rest/rate-limiting — all quotes above.
- https://help.qlik.com/…/QlikAnswers/administering-qlik-answers.htm § "Qlik Answers guardrails".
- Spec grep across `assistants|knowledgebases|users|licenses|items|oauth*|api-keys|audits`.json: `retry-after` only.

**Verdict** `RESOLVED`.

**Impact on the build** Backoff reads `Retry-After` and nothing else — no proactive budget tracking is possible, so
the client is purely reactive. Because limits are per-tier, a 429 on a prompt (tier 2) does not block thread listing
(tier 1), so the UI can stay responsive. The 20-questions-per-minute-per-subscription guardrail is the real design
constraint: at any nontrivial rollout a user's question can be rejected because of *other people's* traffic, so the
"too busy, retry" state must be a first-class, retryable UI state and not an error, and the client must not auto-retry
aggressively or it makes the contention worse.

---

## 7. Native OAuth client provisioning

**Question** — Can an admin create a Native client in the console, which scopes can it hold, is there a consent
screen, can it be pre-trusted, and are custom schemes accepted?

**Finding**
*Creatable in the console.* Yes. *"Select a client type: Web for confidential clients. **Single-page app or Native for
public clients.** Anonymous embed for public clients."* (The qlik.dev OAuth overview's "Manual setup: Tenant-level
clients" list omits Native — that list is out of date; the Help procedure and the API both include it.) The API
confirms: `OAuthClientCreateRequest.appType` enum is `["web","native","spa","anonymous-embed"]`, and
`POST /api/v1/oauth-clients` *"Requires `TenantAdmin` role when created in-tenant. `appType` cannot be changed after
creation."* So the console and the API are both viable; My Qlik org-level clients are **not** required and in fact only
support M2M.

*Scopes.* Two exclusions are documented against client type. `admin_classic`: *"Not supported with the Single-page app
or Native client types."* `offline_access`: *"Not supported with the Single-page app client type"* — Native is
conspicuously absent from that exclusion, i.e. Native can hold `offline_access`. `offline_access` is never granted
implicitly: *"The offline_access scope is an exception, it won't be granted implicitly, and it must be requested to
get a refresh token."*

*Consent.* Yes, there is an end-user consent screen (qlik.dev shows a screenshot of the scope-consent dialog), and it
can be turned off. *"Required: The user is prompted for consent each time a new scope is requested by the OAuth
client."* / *"Trusted: The user is not prompted for consent. This option is only available for unpublished clients.
For published clients, the consent method is always Required."* Via API: `connectionConfig.consentMethod` is
`required | trusted` on read, but **only `trusted` is accepted at creation**; afterwards
`PATCH /api/v1/oauth-clients/{id}/connection-configs/me` with `{op: replace, path: /consentMethod, value: required|trusted}`.
Consent is also re-prompted on change: users *"will be prompted for their own consent the first time they connect (or
when the configuration of the OAuth client changes)"*.

*Redirect URIs.* Hard limits: *"Maximum of 5 redirect URLs per client. Maximum of 5 allowed origins per client.
Maximum of 5 client secrets per client. Maximum of 200 OAuth clients per tenant."* The API agrees (`redirectUris`
items `maxItems: 5`, `maxLength: 256`). Custom schemes are explicitly sanctioned: *"URLs must begin with https://
unless the domain is localhost, in which case it can start with http://. **Native applications can also use the
application-specific link format, for example, exampleapp://.**"*

*Multi-tenant relevant.* A client can be **published** to make one client ID work across every tenant in a region:
*"Publishing shares the client and makes it available to all other tenants within a region. Third-party applications
connecting to Qlik Cloud can then have the same client ID for all Qlik Cloud tenants."* Cost: published clients cannot
use Trusted consent, and *"The initial login will require consent from a tenant administrator."* Alternatively,
Dynamic Client Registration (RFC 7591, `POST /oauth/register`, unauthenticated) supports public clients via
`token_endpoint_auth_method: "none"` — but *"When `token_endpoint_auth_method` is set to `none` (public client), the
`offline_access` scope is excluded from the default assignment and is not assigned even if explicitly requested"*, and
DCR must be enabled per tenant (`dynamicClientRegistrationEnabled` in auth-settings) with unapproved clients deleted
after 60 minutes.

**Source**
- https://help.qlik.com/en-US/cloud-services/Subsystems/Hub/Content/Sense_Hub/Admin/mc-create-oauth-client.htm —
  client-type dropdown, limits list, redirect-URL rule, "Available OAuth scopes" table, "Consent methods",
  "Publishing OAuth clients".
- `https://qlik.dev/specs/rest/oauth-clients.json` — `OAuthClientCreateRequest.appType`, `redirectUris`,
  `connectionConfig.consentMethod`, `OAuthConnectionConfigUpdate`, path descriptions for POST and `/actions/publish`.
- https://qlik.dev/authenticate/oauth/scopes — consent dialog screenshot and the `offline_access` implicit-grant note.
- https://qlik.dev/authenticate/oauth/oauth-dynamic-client-registration — DCR flow, `none` auth method,
  `offline_access` exclusion, 60-minute deletion, `createdByType: dcr`.

**Verdict** `RESOLVED`.

**Impact on the build** Per-tenant Native clients: `offline_access` works, and an admin can set consent to Trusted so
users never see a scope dialog. One published client across a region: fewer MDM keys to distribute, but every user
sees the consent screen every time scopes change, and a tenant admin has to approve first — the app needs a
"waiting for your administrator to approve this app" state it would otherwise not need. The 5-redirect-URI cap means
at most five schemes/environments per client, so dev/staging/prod schemes have to be budgeted or split across clients.

---

## 8. Streaming behaviour

**Question** — Is the `actions/stream` framing documented, does aborting cancel server work, is the Interaction still
persisted, and how does the client recover the interaction id?

**Finding**
*Framing — not documented in the spec, documented by a Qlik employee.* The OpenAPI spec is unhelpful and arguably
wrong: `POST …/threads/{threadId}/actions/stream`, *"Execute prompt in asynchronous streaming mode"*, declares its
`200` as `application/json` → `promptOutput`, with `Etag` and `Last-Modified` headers. No SSE content type, no event
schema. The only primary description of the wire format is Qlik employee Ouadie's Design-blog article (badged
**Employee**, published 2025-02-14), whose parsing code is unambiguous about what actually arrives: the response body
is a stream of **concatenated JSON objects with no delimiter**, split with `textChunk.split(/(?<=\})(?=\{)/)`, where
incremental objects carry `parsed.output` and a final object begins `{"sources"` — the article's own code explicitly
tests `trimmedPart.startsWith('{"sources"')`. The SSE in that article is the sample's *own* re-emission to its
browser front end, not Qlik's format. A Qlik support article separately describes Answers as delivering *"its
real-time reasoning output via a streaming HTTP response (Server-Sent Events / chunked transfer encoding)"*, but that
is about the Qlik Answers web UI in a browser-extension troubleshooting context and does not describe
`/api/v1/assistants/.../actions/stream`. Treat "concatenated JSON, no framing" as the working assumption and the SSE
wording as not applicable.

*Abort / cancellation semantics.* Nothing published. There is no cancel endpoint on the assistants API (there is one
for knowledgebase syncs, `…/datasources/{datasourceId}/actions/cancel`, which is unrelated). No statement exists on
whether client disconnect stops generation or whether it still consumes a question from the monthly quota — and it
would, since only *errors* are exempt: *"Questions that return an error do not consume question capacity."*

*Interaction persistence.* Also undocumented for the disconnect case. What is known: `Interaction` is a real,
owner-stamped record (`id`, `ownerId`, `request`, `response`, `sources`, `threadId`, `createdAt`, `updatedAt`,
`rejected`), the stream response does **not** return an interaction id (`promptOutput` = `{output, sources}` only),
and there is a manual `POST …/interactions` (`createInteraction` = `{request, response, sources, rejected?,
rejectionReason?}`) — the existence of a client-side create endpoint hints that persistence may not be automatic on
every path, but that is inference, not documentation.

*Recovering the interaction id — this part is documented.*
`GET /api/v1/assistants/{assistantId}/threads/{threadId}/interactions` accepts `sort` with enum
`["CREATED","-CREATED","UPDATED","-UPDATED"]` and `limit` (1–100, default 20), plus `next`/`prev` cursors. So
`?sort=-CREATED&limit=1` returns the newest interaction first. Exact params, no guesswork.

**Source**
- `https://qlik.dev/specs/rest/assistants.json` — stream path and `200` schema; `promptOutput`; `Interaction`;
  `createInteraction`; interactions `sort`/`limit`/`next`/`prev`.
- https://community.qlik.com/t5/Design/DIY-your-Qlik-Answers-Experience-with-the-new-KB-and-Assistants/ba-p/2506001 —
  author **Ouadie**, badge **Employee**, 2025-02-14; the `split(/(?<=\})(?=\{)/)` and `startsWith('{"sources"')` code.
- https://community.qlik.com/t5/Official-Support-Articles/Real-time-reasoning-view-not-displayed-in-Qlik-Answers/ta-p/2548168
  — the SSE/chunked wording, in a browser-extension context.
- https://help.qlik.com/…/QlikAnswers/administering-qlik-answers.htm — "Questions that return an error do not consume
  question capacity."

**Verdict** `PARTIAL`. Framing is known from one employee-authored source and needs confirming on the wire; the
interactions-listing params are fully resolved; abort and mid-stream persistence are undocumented. One live tenant
settles the rest: POST to `actions/stream`, dump raw bytes and the response `Content-Type` header; then repeat,
`AbortController.abort()` halfway, and immediately `GET …/interactions?sort=-CREATED&limit=1` to see whether a
partial (or any) Interaction was written — and check the tenant's question meter before and after.

**Impact on the build** If the framing is concatenated JSON, the parser must buffer across chunk boundaries (an object
can split mid-token) and cannot use an SSE reader — a naive `split` on each `expo/fetch` chunk will corrupt output.
If aborting does not cancel server-side work, a user who backs out of a screen still burns a question from a
subscription-wide monthly quota, which argues for a confirm-cancel rather than a silent abort. If the Interaction is
still persisted on disconnect, "conversation history" will show orphaned half-answers the user never saw and the
thread view must tolerate them.

---

## 9. Thread visibility

**Question** — Does `GET /assistants/{id}/threads` return only the caller's threads, and is `ownerId` filterable?

**Finding**
Not answerable from the spec, and the spec's own hints point both ways. `GET /api/v1/assistants/{assistantId}/threads`
is described only as *"Retrieves the list of threads for the assistant"* — not "that the user has access to", which is
the phrasing Qlik uses elsewhere when it means per-user scoping (compare `GET /api/v1/items`: *"Lists items that the
user has access to"*, and `GET /api/v1/knowledgebases`: *"Returns a list of all knowledgebases the user has access
to"*). Its query params are `filter`, `limit`, `next`, `prev`, `sort` — and `sort` is restricted to
`NAME|-NAME|CREATED|-CREATED|UPDATED|-UPDATED`, with **no** `ownerId` sort and no documented `filter` grammar (the
description is just *"Optional parameter to filter threads"*; Qlik documents SCIM/RFC 7644 filter syntax for other
APIs but not here). Both `Thread` and `Interaction` carry a required `ownerId`, so the data model is per-user even if
the listing is not.

The product side implies threads are private by default with an explicit admin override. Reviewing other users'
conversations is a distinct, separately-gated capability: the `thread-audits` scope is *"Lets users review agent and
chat interactions"*, the role permission is *"Review agent and chat interactions: Allows user access to both Answers
review portal and Feedback in agentic assistants to review Qlik Answers conversations"*, and *"The audit admin user
role also allows users to review conversations and view feedback"*. That a separate permission exists to see other
people's conversations strongly implies the default listing does not include them — but Qlik never says so about the
REST endpoint.

**Source**
- `https://qlik.dev/specs/rest/assistants.json` — `GET /api/v1/assistants/{assistantId}/threads` description and
  parameters; schemas `Thread.ownerId`, `Interaction.ownerId`.
- `https://qlik.dev/specs/rest/items.json`, `https://qlik.dev/specs/rest/knowledgebases.json` — contrasting
  "that the user has access to" phrasing.
- https://qlik.dev/manage/access-control/scopes — `thread-audits`.
- https://help.qlik.com/…/QlikAnswers/administering-qlik-answers.htm § "Review agent and chat interactions".
- https://help.qlik.com/…/QlikAnswers/reviewing-assistant-conversations.htm — *"In Feedback, you can view your
  assistant's conversations and feedback from your users"*, gated on the audit-admin permission.

**Verdict** `PARTIAL`. Settling it takes two users on one live tenant: user A creates a thread, then user B (same
assistant access, no `thread-audits`) calls `GET …/threads` and checks whether A's thread appears and whether the
returned `ownerId`s are all B's. Same call again with `?filter=ownerId eq "<id>"` to see whether the filter grammar
accepts it (400 vs 200 is the answer).

**Impact on the build** If the listing is caller-scoped, "conversation history" is private by construction and the app
can show it with no filtering and no privacy caveat. If it is not, the app must filter client-side on
`Thread.ownerId == users/me.id` — which is a correctness *and* a confidentiality issue, because unfiltered it would
put other employees' questions on screen — and pagination becomes unreliable since a page of 20 may contain zero of
the caller's own threads.

---

## 10. Agentic path — any supported route today

**Question** — Is there any supported route to agentic Answers, what entitlement/tenant setting gates it, and could
`qlik-embed`'s `ai/agentic-assistant` work in a mobile WebView?

**Finding**
*API.* Still unpublished, and now with a roadmap statement attached. Qlik's answer in the referenced thread (author
badged Qlik staff, marked as the accepted solution, 2026-08-19): *"the path being called by REST here
(/api/v1/assistants/...) is the path which routes to Qlik Answers prior to the integration of structured data so it
will only return information from Knowledge Bases. Qlik Answers against structured and unstructured uses the path
/api/v1/cloud-assistants/.... which is not published. **It is on the roadmap to have these API published.**"* No date.
There is no published preview or early-access programme for it that I could find; searching for `cloud-assistants`
turns up only this thread. Using it anyway is a licence violation: *"Qlik does NOT permit use of any unpublished APIs,
and any use of unpublished APIs is a violation of these API Terms."*

*Tenant gate — this is the real prerequisite and it is a data-residency decision.* *"The Qlik Answers agentic
experience requires opting in to cross-regional data processing. If you do not use cross-regional data processing in
your tenant, you can use the Qlik Answers legacy experience, which offers a retrieval augmented generation (RAG)
experience."* And: *"To use the agentic Qlik Answers experience, you must opt in to cross-region inference. This allows
Qlik Answers to send inference requests outside your tenant region."* Qlik's stated risk position: *"Cross-region
inference has minimal risks as the data still stays within the AWS Virtual Private Network. The only difference here
is that the LLM call gets processed in a different region due to GPU availability."* Models are Anthropic Claude on
AWS Bedrock. Regional carve-outs exist: *"The Data product, Glossary, and Data quality contexts in the agentic
experience are not available in Mumbai or Singapore."* Agentic is supported in 10 regions.

*Permissions* for agentic are separate role permissions under **Agentic AI**: `Data analysis`, `Data governance`,
`Qlik product help`, `Review agent and chat interactions` — mapping to the OAuth-grantable scopes `analysis-agent`,
`data-governance-agents`, `help-agent`, `thread-audits`.

*WebView fallback.* `qlik-embed` `ui="ai/agentic-assistant"` exists and is GA-documented as of 2026-02-10; it takes
`assistant-id` and (for `ai/assistant`) `appearance` and `thread-id`. Nothing on either the changelog or the
parameters page says anything about mobile WebView support, iOS/Android WKWebView/Chrome Custom Tabs, or how its OAuth
would be obtained in a native shell — and I found no Qlik statement on the subject at all. What is knowable: the two
non-backend auth types `qlik-embed` supports are OAuth2 **SPA** and Anonymous. An SPA client requires `allowedOrigins`
(*"only available with SPA application type"*, max 5) and cannot hold `offline_access` (*"Not supported with the
Single-page app client type"*). A WebView loading a local/`file://` document has no stable HTTPS origin to allowlist,
which is a concrete obstacle, not a documented one.

**Source**
- https://community.qlik.com/t5/Qlik-Answers/Qlik-Answers-REST-invoke-only-uses-the-knowledge-base/td-p/2554956 —
  accepted solution, 2026-08-19; quoted above.
- https://qlik.dev/apis/api-policy § "Use of our APIs" — unpublished-API prohibition.
- https://help.qlik.com/…/QlikAnswers/administering-qlik-answers.htm — cross-region opt-in, supported regions,
  Mumbai/Singapore carve-out, Agentic AI permissions.
- https://community.qlik.com/t5/Official-Support-Articles/Qlik-Answers-Agentic-Analytics-FAQ/ta-p/2542617 —
  Bedrock/Claude, cross-region risk statement.
- https://qlik.dev/changelog/202-qlik-embed-agentic-assistant and https://qlik.dev/embed/qlik-embed/parameters —
  `ai/agentic-assistant` vs `ai/assistant`.
- https://help.qlik.com/…/Admin/mc-create-oauth-client.htm — SPA `allowedOrigins`, `offline_access` exclusion.

**Verdict** `PARTIAL`. The tenant prerequisite, permissions, regional limits and residency posture are fully resolved.
"Is there a preview programme" and "does `ai/agentic-assistant` work in a mobile WebView" are `UNRESOLVED — no public
source`; the first would be settled by the Qlik account team, the second only by trying it.

**Impact on the build** The cross-region inference opt-in is a customer-side blocker that no amount of app code fixes
— a tenant that refuses it can never get agentic answers, and in Mumbai/Singapore some agentic contexts are absent
regardless. Nothing here changes v1. When `cloud-assistants` publishes, the thread/interaction/citation shapes may not
match `/assistants/...`, so treating the current adapter's response types as the domain model would make that
migration a rewrite rather than a swap.

---

## 11. MDM managed app configuration, both platforms

**Question** — Is `com.apple.configuration.managed` supported and does it update at runtime; what does Android require
in the manifest and `res/xml`, and can restrictions change while the app runs?

**Finding**

**iOS.** The key is real, first-party, and Apple names it explicitly — in the privacy-manifest documentation, which
means using it has a submission consequence. `NSPrivacyAccessedAPITypeReasons` value **`AC6B.1`**: *"Declare this
reason to access user defaults to read the `com.apple.configuration.managed` key to retrieve the managed app
configuration set by MDM, or to set the `com.apple.feedback.managed` key to store feedback information to be queried
over MDM, as described in the Apple Mobile Device Management Protocol Reference documentation."* (Required-reason API
declarations apply iOS 17.0+.) `UserDefaults` documents the domain: *"Managed | persistent | This domain contains
settings that an administrator provided for a managed device. The system saves these values persistently on the
current device."* and *"Apps can't write to managed domains, so if your app encounters a managed setting, disable or
hide any controls that someone might use to change that setting's value."*

Status: supported but explicitly designated **legacy**. Apple's Device Management docs: *"For backward compatibility,
the device supports configuring managed apps with legacy app configuration data to allow the apps to use the MDMv1
`UserDefaults`-based mechanism for reading configuration… while waiting for the app developer to add support for the
ManagedApp framework."* The successor is the `ManagedApp` framework (iOS 18.4+), whose
`ManagedAppConfigurationProvider.configurations(_:)` returns `async -> some AsyncSequence<Optional<Configuration>, Never>`
— i.e. the new API delivers configuration changes as a stream, which is a direct statement that configuration *does*
change at runtime under MDM. Apple does **not** state anywhere I could find whether the legacy
`com.apple.configuration.managed` key is refreshed in a running process; the conventional signal
(`UserDefaults.didChangeNotification`) is not documented as covering the managed domain.

**Android.** Fully specified and unambiguous.
- Manifest, inside `<application>`: `<meta-data android:name="android.content.APP_RESTRICTIONS" android:resource="@xml/app_restrictions" />`
- File: `res/xml/app_restrictions.xml`, single top-level `<restrictions>` with one `<restriction>` per key.
  Each needs `android:key` (unique, non-localizable, string literal), `android:restrictionType`, `android:title`,
  `android:description`, optional `android:defaultValue`. Types: `bool`, `string`, `integer`, `choice`,
  `multi-select`, `hidden`, `bundle_array`. *"Do not create localized versions of the managed configuration file."*
- Read: `getSystemService(Context.RESTRICTIONS_SERVICE) as RestrictionsManager`, then
  `getApplicationRestrictions()` → `Bundle`. *"The `getApplicationRestrictions()` method requires reading from data
  storage, so it should be done sparingly… call it once when your app starts or resumes, and cache the fetched managed
  configurations bundle."*
- **Yes, they change at runtime**: *"The configurations provider and IT admin can change your app's managed
  configurations at any time, even when the app is not running."* Listen for `ACTION_APPLICATION_RESTRICTIONS_CHANGED`
  — with the trap: *"The `ACTION_APPLICATION_RESTRICTIONS_CHANGED` intent is sent only to listeners that are
  dynamically registered, *not* to listeners that are declared in the app manifest."*
- The gotcha that breaks defaults: *"The managed configurations `Bundle` contains one item for every configuration
  that has been explicitly set by a managed configurations provider. However, you cannot assume that a configuration
  will be present in the bundle just because you defined a default value in the managed configurations XML file."*

**Precedent, from Qlik.** Qlik ships exactly this pattern for its own mobile app, and publishes the schema — worth
mirroring. Intune app configuration key `mdm`, value:
`{"policyName":"<policy name>","Accounts":[{"name":"<tenant name>","url":"<tenant URL>"}]}`, where *"name: Your chosen
tenant name shown to users. url: The URL of the Qlik Cloud tenant (for example, mobileintune.us.qlikcloud.com)"* —
note `Accounts` is an **array**, i.e. Qlik's own app expects one config to carry several tenants. A second key
`IntuneMAMOID` = `{{userid}}` passes the Intune user ID.

**Source**
- https://developer.apple.com/documentation/bundleresources/app-privacy-configuration/nsprivacyaccessedapitypes/nsprivacyaccessedapitypereasons — `AC6B.1`.
- https://developer.apple.com/documentation/foundation/userdefaults § "Domains and settings search paths",
  § "Settings in managed environments".
- https://developer.apple.com/documentation/devicemanagement/configuring-managed-apps-and-extensions §
  "Configure a managed app with a legacy app configuration".
- https://developer.apple.com/documentation/managedapp and
  https://developer.apple.com/documentation/managedapp/managedappconfigurationprovider — `configurations(_:)` signature.
- https://developer.android.com/work/managed-configurations — all Android quotes.
- https://help.qlik.com/en-US/cloud-services/Subsystems/Hub/Content/Sense_Hub/Admin/configure-mobile-app.htm —
  the `mdm` key and `Accounts` schema.

**Verdict** `RESOLVED` for the mechanics on both platforms and for iOS support status. One sub-question stays open:
whether the legacy iOS key refreshes in a running process — settle it by pushing a config change from the MDM while
the app is foregrounded and re-reading `UserDefaults.standard.dictionary(forKey:)`.

**Impact on the build** iOS: the app **must** ship a `PrivacyInfo.xcprivacy` declaring `AC6B.1` under
`NSPrivacyAccessedAPICategoryUserDefaults`, or risk App Store rejection — this is a build-config task, not app code,
and it is easy to miss with `expo prebuild`. If the legacy key does not update live, re-reading config on
foreground/resume is mandatory, which is the same discipline Android needs anyway. Android: the local module needs
both the manifest `meta-data` entry and `res/xml/app_restrictions.xml`, and a **dynamically registered** receiver —
declaring it in the manifest silently never fires. On both platforms, config keys may simply be absent even when the
XML declares a default, so every read needs a fallback path (a "not configured — contact your administrator" state)
rather than assuming a value. Qlik's own `Accounts: [...]` array is a ready-made precedent for the tenant-selection
shape.

---

## 12. Any Qlik-published guidance for native mobile clients at all

**Question** — Is there a Qlik mobile SDK, a supported native-mobile pattern, or a statement that mobile is unsupported?

**Finding**
There is no mobile SDK and no "build your own mobile app" guide — but there is also no statement that mobile is
unsupported, and there is meaningful indirect guidance.

*Qlik acknowledges native apps as a first-class OAuth citizen.* The OAuth overview lists **Native application** among
supported app types — *"Apps that run natively on a device like a computer or mobile phone"* — and names its own
mobile app as a consumer of the same machinery: OAuth on Qlik Cloud exists to *"Support authorization within other
Qlik applications like the mobile app and qlik-cli."* (One caveat on that page: it also says Native apps are *"usually
public clients requiring both the Client Id and Client Secret"*, which contradicts both its own public-client
definition and the Help page's *"Public clients do not have a client secret."* Treat it as an editing error.)
The PKCE description is correct and explicit: *"Single-page applications and native applications (for example, mobile
apps) use the `Authorization Code` flow but with an additional component called `Proof Key for Code Exchange`."*

*Qlik ships its own native mobile app*, the Qlik Analytics mobile app for iOS and Android, and it is governed by a
dedicated scope: `mobile:all` — *"Allow use of the native mobile app (does not influence browser-based mobile
activity)"* — with a child `mobile:mamintune`, *"Enforce use of Intune for authentication and policy deployment in the
Qlik Analytics mobile app."* Both are **Custom Role / User Default only, not OAuth-grantable** (OAuth column ✗). So
that scope gates Qlik's app, not a third-party one, and cannot be requested by an external OAuth client.

The published mobile documentation (`qsmsaas-*` pages, `configure-mobile-app.htm`) is entirely about deploying and
securing *Qlik's* app — Intune app protection policies, app configuration policies, tenant `Accounts` config — plus
guidance on designing Qlik Sense sheets for small screens. Nothing addresses building a third-party client. Searches
across qlik.dev for a mobile SDK returned nothing.

**Source**
- https://qlik.dev/authenticate/oauth — "Native application" app type; "Support authorization within other Qlik
  applications like the mobile app and qlik-cli"; § "Single-Page and Native OAuth2 client applications".
- https://qlik.dev/manage/access-control/scopes — `mobile:all`, `mobile:mamintune` (Custom Role/User Default only).
- https://help.qlik.com/en-US/cloud-services/Subsystems/Hub/Content/Sense_Hub/Mobile/qsmsaas-get-started.htm and
  https://help.qlik.com/en-US/cloud-services/Subsystems/Hub/Content/Sense_Hub/Admin/configure-mobile-app.htm.
- https://help.qlik.com/…/Admin/mc-create-oauth-client.htm — "Public clients do not have a client secret."

**Verdict** `RESOLVED` — the answer is "no SDK, no dedicated guide, no prohibition; native OAuth clients are an
explicitly supported client type."

**Impact on the build** No SDK means no shortcut and no vendor-maintained surface to track, but also nothing to
migrate off. The `mobile:all` scope is a red herring: it cannot be requested and its absence says nothing about a
third-party app's access. The absence of any Qlik mobile guidance means every platform decision in this project is
uncorroborated by a vendor reference implementation, so the live-tenant tests below carry more weight than they
usually would.

---

## What to test first against a live tenant

Ordered by how much design risk each removes.

1. **Refresh-token semantics (gap 1).** Exchange a code, refresh once, inspect whether a new `refresh_token` comes
   back and whether the old one still works; then idle past the tenant's `userSessionInactivityTimeoutMinutes` and
   refresh again. Decides the token-store write strategy and whether re-auth is a rare event or a routine one.
2. **Stream framing and abort (gap 8).** Dump raw bytes and `Content-Type` from `actions/stream`; repeat with an
   abort halfway and check `…/interactions?sort=-CREATED&limit=1` plus the tenant question meter. Decides the parser
   and whether cancel is safe.
3. **Thread visibility (gap 9).** Two users, one assistant, one `GET …/threads` each. This is a confidentiality
   question, not just a UX one — a wrong assumption puts other people's questions on screen.
4. **Entitlement signal (gap 4).** On a tenant *without* the Answers add-on: `GET /api/v1/licenses/overview`,
   `GET /api/v1/assistants`, `GET /api/v1/users/me`. Decides whether "not entitled" can be a distinct screen or has
   to be folded into a hedged empty state.
5. **Revoke behaviour (gap 3).** Four curls (extra `client_id`; refresh→access cascade; access→refresh cascade;
   unauthenticated). Decides whether `revokeAsync` is usable and how many calls sign-out makes.
6. **Native client end-to-end (gap 7).** Create a Native client with a `qlikanswers://auth` redirect and
   `user_default offline_access`, set consent to Trusted, and complete one authorization. Confirms the custom scheme
   is accepted in practice and that Trusted really suppresses the dialog.
7. **Citation resolution (gap 5).** Take one real `MessageSource` and run both routes end to end
   (`sources/plaintexts`, and `actions/download` → `temp-contents/{id}`). Confirms an ordinary user — not an admin —
   is authorized on both, which the 403s in the spec leave open.
8. **iOS managed-config liveness (gap 11).** Push an MDM config change while the app is foregrounded and re-read
   `com.apple.configuration.managed`. Only decides whether a resume-time re-read is sufficient or a listener is needed.
9. **Answers guardrail behaviour (gap 6).** Fire >20 prompts in a minute across users and inspect the 429 body and
   `Retry-After`. Confirms the subscription-wide guardrail surfaces as a normal 429 rather than a different error
   shape.

### Not answerable by testing

- Whether `/api/v1/cloud-assistants/...` has a preview programme, and when it publishes (gap 10) — ask the Qlik
  account team; using it before publication breaches the API policy either way.
- Whether `qlik-embed`'s `ai/agentic-assistant` is supported in a mobile WebView (gap 10) — no public source exists;
  only Qlik can answer "supported", and only an experiment can answer "works".
