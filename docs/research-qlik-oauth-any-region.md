# Research: Sign in to any Qlik Cloud region with only the tenant hostname

Access date for every source: 2026-10-19. Sources are primary only: qlik.dev, help.qlik.com, the Qlik changelog, IETF and RFC text, and live Qlik Cloud tenant endpoints. Writing style follows `AGENTS.md` section 10 (STE-flavored).

Question: a Qlik User on any region (`eu`, `us`, and others) should sign in by typing only the tenant hostname. Today this works only in regions where MTC owns a Tenant and has published a Native OAuth client (`sg`, `ap`). Is there an easier way, with no per-Customer client ID and ideally no MTC Tenant per region?

## Summary and verdict

1. **A published client works only in its own region.** Qlik states that publishing shares a client "within a region". Live probes agree. [High: S2, S3, S8]
2. **Qlik Cloud supports Client ID Metadata Documents (CIMD).** Every tenant I probed advertises `client_id_metadata_document_supported: true`. The client ID is an HTTPS URL that MTC hosts. No MTC Tenant is needed, in any region. [High: S4, S7, S8]
3. **CIMD keeps one admin step.** A tenant administrator must approve the client once per Tenant. This is the same cost as a published client today. [High: S3, S4]
4. **CIMD is new and Qlik describes it for MCP clients.** Qlik announced it on 2 Oct 2026, 17 days before this research. The changelog and the Claude examples cover MCP only. Use by a native mobile app is not documented. [High: S13] That no Qlik page excludes other apps is [Unverified].
5. **Three facts decide if CIMD fits this app and no source states them.** Does Qlik accept the custom redirect `qlikanswers://auth` in a metadata document? Does a CIMD client get the `offline_access` scope? What does a non-admin see before approval? [Unverified]
6. **Other routes fail.** Dynamic Client Registration (DCR) needs an admin to enable it and approve each registration within 60 minutes. API keys give full account access and need an admin permission. The tenants do not advertise a device authorization grant. Region-level and organization-level clients are machine-to-machine only. "Trusted" consent is not available for published or CIMD clients. [High: S1, S5, S7, S9, S12, S15]
7. **Qlik runs a pre-provisioned client that works in every region I probed.** It is the static client for Claude Desktop. No page says a third party can get one. Asking Qlik is a possible path. [High for the behaviour: S8, S14. Unverified that Qlik offers it to third parties.]

**Recommendation.** Test CIMD with a hosted metadata document. If the three open facts hold, use CIMD as the default and keep the published-client table (`ap`, `sg`) and the typed client ID as fallbacks. In parallel, ask Qlik whether it can provision a static all-region client for the app. See section 7.

### Confidence legend

| Tag | Meaning |
| --- | --- |
| [High: Sn] | Read in primary source Sn, or observed on a live Qlik endpoint. |
| [Unverified] | Inferred, or not found in a primary source. Treat as an open question. |

Some Qlik help pages were read through a fetch tool that summarizes text. The key pages (S3, S14) were then re-read as raw page text. qlik.dev pages were read as raw Markdown (`.md` URLs).

---

## 1. Does a published Native client work only in its own region?

Yes, in the documents and in live behaviour.

### 1.1 What Qlik states

- A client is "bound to the tenant that created it" by default. [High: S2]
- "Publishing shares the client and makes it available to all other tenants within a region." Third-party apps "can then have the same client ID for all Qlik Cloud tenants." [High: S2]
- The help page repeats this: a client can be shared "across multiple tenants within the same region". [High: S3]
- The DCR page says: "Publishing constrains whether an OAuth client can be used by other tenants in the same region." [High: S5]
- The first login on a Tenant "will require consent from a tenant administrator". After approval the client appears in that Tenant's Administration activity center. [High: S3]
- Region-level clients use the same wording: client IDs "are unique to the region and can't be used in different regions". These clients are a different feature (machine-to-machine, My Qlik). The sentence supports the region boundary in Qlik's model. [High: S15]

### 1.2 What the live tenants do

I sent unauthenticated `GET /oauth/authorize` requests with the two MTC client IDs. No credentials were sent. The request used `redirect_uri=qlikanswers://auth` and PKCE parameters. Results (S8):

| Tenant (region) | `sg` client | `ap` client |
| --- | --- | --- |
| `mtcmarketing.sg`, `mtcklpi.sg` (sg) | 302 to login | 400 |
| `mtcteam.ap` (ap) | 400 | 302 to login |
| `demo.eu` (eu) | 400 | 400 |
| `sense-demo.us`, `demo.us` (us) | 400 | 400 |

- The 400 body reads `Invalid client_id` and `OAuth client is not authorized` (code `OAUTH-14`). The same body appears for an all-zero client ID. [High: S8]
- Each MTC client is visible in its own region only. [High: S8]
- Limit of this test: I found no unapproved Tenant in `sg` or `ap`. So the probe cannot separate "wrong region" from "not approved yet". The Qlik statements in 1.1 and ADR-0010 close the gap. ADR-0010 records a consent screen in `mtcklpi.sg` for a client created in `mtcmarketing.sg`, before approval. [High: ADR-0010] Consent screen behaviour in a region with no published client is [Unverified].

### 1.3 Consequence for MTC

MTC needs one Tenant per region and one published client per region. Qlik documents no way to get a client that is valid in all regions through publishing. Where Qlik lists regions is [Unverified]. I did not find a page with the full region list. The Qlik Cloud Government offering is separate. Its domain was not found. [Unverified]

---

## 2. Qlik Cloud OAuth discovery

I fetched the discovery documents from `mtcmarketing.sg`. They need no authentication. I also read the `demo.eu` and `sense-demo.us` documents. All returned HTTP 200 with the same fields. [High: S7]

`/.well-known/oauth-authorization-server` and `/.well-known/openid-configuration` returned the same JSON. Fields:

| Field | Value |
| --- | --- |
| `authorization_endpoint`, `token_endpoint`, `revocation_endpoint` | `/oauth/authorize`, `/oauth/token`, `/oauth/revoke` |
| `registration_endpoint` | `https://<tenant>/api/v1/oauth-clients/register` |
| `client_id_metadata_document_supported` | `true` |
| `authorization_response_iss_parameter_supported` | `true` |
| `response_types_supported` | `["code"]` |
| `grant_types_supported` | `authorization_code`, `refresh_token`, `client_credentials`, token-exchange, `urn:qlik:oauth:user-impersonation`, `urn:qlik:oauth:anonymous-embed` |
| `code_challenge_methods_supported` | `["S256"]` |
| `token_endpoint_auth_methods_supported` | `client_secret_basic`, `client_secret_post`, `private_key_jwt`, `none` |
| `jwks_uri` | `/.well-known/jwks.json` |

- The document lists a `registration_endpoint` (RFC 7591) and the CIMD flag. [High: S7]
- The advertised endpoint is `/api/v1/oauth-clients/register`. The DCR page shows `POST .../oauth/register` in its example. The two differ. Which path works is [Unverified]. The document does not say whether DCR is enabled on a Tenant. The DCR page says an admin must enable it. [High: S5]
- The document has no `device_authorization_endpoint` and no device-code grant. [High: S7]
- Correction to the repo: the comment in `src/auth/oauth.ts` says "Qlik publishes no discovery document". Live tenants publish one. The hardcoded endpoints still match it. This does not change behaviour. [High: S7]
- The discovery document does not say which clients a Tenant accepts, or in which region. It lists no other feature that removes per-Tenant setup. [High: S7]

---

## 3. Client ID Metadata Document (CIMD)

### 3.1 What the IETF draft requires

Source: `draft-ietf-oauth-client-id-metadata-document-02`, 6 July 2026, expires 7 January 2027. It is an Internet-Draft, not an RFC. [High: S10]

- The `client_id` is an "https" URL. It has a path. It has no fragment, no userinfo, and "SHOULD NOT" have a query. [High: S10, section 3]
- The URL returns a JSON document over HTTP 200. The document has a `client_id` property that equals the URL. The server "MUST NOT automatically follow HTTP redirects" when it fetches the file. [High: S10, sections 4 and 5]
- The metadata uses the RFC 7591 property names: `client_name`, `client_uri`, `redirect_uris`, `grant_types`, `token_endpoint_auth_method`, `logo_uri`. [High: S10, section 4]
- A shared-secret method is forbidden. `token_endpoint_auth_method` can be `none` (public client) or `private_key_jwt` (confidential). [High: S10, sections 4.1 and 8.2]
- The server SHOULD read at most about 5 KB. It may cache the document and "SHOULD respect HTTP cache headers". [High: S10, sections 5.2 and 8.7]
- The server MUST require registered redirect URLs and an exact match with the one in the request. [High: S10, section 4.2, citing RFC 9700]
- The server may restrict redirect URIs, for example to the same origin as the client ID URL. [High: S10, section 8.1]
- The URL is the client identity. A changed URL is "a brand new client". The operator should keep the URL "resolvable and under their control indefinitely". [High: S10, section 8.3]
- Servers advertise support with `client_id_metadata_document_supported`. [High: S10, section 6]

### 3.2 Redirect URIs for native apps

- The draft does not mention native apps or custom schemes. It leaves redirect rules to the authorization server. [High: S10. A search of the text for "native", "custom", and "scheme" found none that apply.]
- RFC 8252 covers native apps. It allows three redirect types: private-use URI scheme (section 7.1), claimed `https` link (section 7.2), and loopback (section 7.3). [High: S11]
- RFC 8252 says a private-use scheme MUST be "based on a domain name under their control, expressed in reverse order". It says servers SHOULD reject a scheme with no period. [High: S11, sections 7.1 and 8.4]
- `qlikanswers` has no period. A reverse-domain scheme would be, for example, `com.example.qurio`. Whether Qlik rejects a scheme with no period in a CIMD document is [Unverified].
- Qlik accepts a custom scheme for a manual client. The help page says native apps "can also use the application-specific link format, for example, `exampleapp://`". The limit is 5 redirect URLs per client. [High: S3]
- Qlik's CIMD page does not describe redirect rules. [High: S4]

### 3.3 Does Qlik Cloud implement CIMD?

Yes. [High: S4, S7, S13]

- Qlik "retrieves the metadata document" when a client connects. A tenant administrator "authenticates and approves the client". Qlik then creates the OAuth client for the Tenant. [High: S4]
- The page says an administrator "doesn't create a CIMD client manually". After approval the client shows on the **OAuth** page with source **CIMD**. [High: S4]
- "Other users on the tenant can then authorize access through the approved client when their application uses the same CIMD document URL." [High: S4]
- Client type follows the authentication method. `none` gives "Native (public)". `private_key_jwt` gives "Web (confidential)". [High: S4]
- CIMD "doesn't require DCR to be enabled on the tenant". [High: S4]
- CIMD clients "use the Required consent method". A tenant administrator "can't change the consent method to Trusted". [High: S4, S3]
- Properties from the document (name, redirect URIs, authentication method) cannot be changed in Qlik Cloud. An administrator can add or remove scopes. [High: S4]
- The page lists default scopes for "Qlik MCP Server connections": `user_default`, `mcp:execute`, `offline_access`. Default scopes for a non-MCP CIMD client are [Unverified].
- The changelog entry of 2 Oct 2026 says an administrator can "configure a Model Context Protocol (MCP) connection" with CIMD. The Qlik examples are Claude, Claude Code, and ChatGPT. [High: S13, S4]
- Qlik Help says Claude "uses an Anthropic-hosted metadata document" and an administrator approves "the first time it connects". [High: S14]

### 3.4 What I observed on a live tenant

I sent unauthenticated authorize requests to `mtcmarketing.sg` with a real CIMD client ID. The client ID was `https://claude.ai/oauth/claude-code-client-metadata`. Its public document lists `http://localhost/callback` and `http://127.0.0.1/callback`. [High: S8, S16]

| Request | Result |
| --- | --- |
| `redirect_uri=http://localhost:8080/callback` (a listed URI with a new port) | 302 to login |
| `redirect_uri=qlikanswers://auth` (not in the document) | 400, `Invalid redirect_uri`, `redirect_uri is not registered` (code `OAUTH-1`) |
| `client_id=https://example.com/nonexistent-client.json` | 302 to login |

- Qlik reads the metadata document and checks the redirect URI against it before login. [High: S8]
- A loopback URI with a different port passes. This matches RFC 8252 section 7.3. [High: S8, S11]
- A missing document did not produce an error before login. Where the error appears is [Unverified]. I did not log in or approve anything.
- I did not host a test document. So whether Qlik accepts `qlikanswers://auth` when a document lists it is [Unverified]. This is the first test to run. See section 7.

### 3.5 Redirect options for the app

| Option | Notes | Status |
| --- | --- | --- |
| Custom scheme in the document (`qlikanswers://auth`) | Matches the code today (`src/auth/oauth.ts`). | [Unverified] that Qlik accepts it for CIMD |
| Reverse-domain custom scheme | Follows RFC 8252 section 7.1. Needs an app scheme change in `app.json`. | [Unverified] that it is needed |
| Claimed `https` link on an MTC domain | Follows RFC 8252 section 7.2. Needs the Apple associated-domains file and the Android Digital Asset Links file on the same MTC domain. Expo Go cannot test it. The draft allows same-origin redirect rules. | [Unverified] for Qlik |
| Loopback | Not usable on a phone for this flow. | [High: S11] |

All public CIMD documents I read use `https` or loopback redirects. None uses a custom scheme. They belong to Claude, ChatGPT, VS Code, and Zed. [High: S16]

---

## 4. A Qlik-provided shared or first-party mobile client

- Qlik's developer overview says OAuth supports "authorization within other Qlik applications like the mobile app and qlik-cli". It names no client ID and no way for a third party to reuse it. [High: S1]
- The Qlik Sense Mobile SaaS help page says the user "must connect and authenticate to a Qlik Cloud tenant". It does not say which OAuth client the app uses. I found nothing on this. [High: S17 for the quoted setup text. Unverified for the client.]
- Qlik Help says: "For Anthropic Claude Desktop, Qlik provides a predefined static client ID. No administrator setup is needed beyond the initial approval." [High: S14]
- I sent the authorize request with that client ID to tenants in `sg`, `ap`, `eu`, and `us`. All four answered `redirect_uri is not registered` (`OAUTH-1`). None answered `OAUTH-14` (client not authorized). So Qlik knows this client in every region I tried. [High: S8]
- This shows Qlik can run one client ID across regions for a partner. No page says it offers this to a third party, or how to ask. [Unverified]
- Qlik documents no partner or marketplace route to a client that is valid in all regions. I found nothing. [Unverified]

---

## 5. Other routes

| Route | Finding | Source |
| --- | --- | --- |
| Dynamic Client Registration (DCR) | Public endpoint on each Tenant. An admin must enable DCR in Settings > Security and allow the `none` method. Qlik stores each client unapproved. An admin must complete the first connection within 60 minutes or Qlik deletes it. A public client does not get `offline_access`. Some vendors register a new client for every connection. Then "only Qlik Cloud tenant administrators can complete a DCR connection". The DCR page warns that DCR exposes "a public, unauthenticated endpoint". | [High: S5, S6] |
| API keys | Each user generates a key. A tenant admin must grant the "Manage API keys" permission. A key has the user's full permissions and "It is not possible to apply scopes". Qlik says to use OAuth for "apps and interactive use". | [High: S12] |
| Device authorization grant (RFC 8628) | The discovery document lists no device grant and no device endpoint. No qlik.dev page describes one. | [High: S7. Not found in docs: S1, S2] |
| Region-level OAuth client | Machine-to-machine only. Made by the Service Account Owner in My Qlik for one subscription. | [High: S1, S15] |
| Organization-level OAuth client | Machine-to-machine only. Used for organization APIs. | [High: S1] |
| Machine-to-machine impersonation | Needs a confidential client and a backend. This reverses ADR-0001. | [High: S1] |
| "Trusted" consent | Only for unpublished clients. "For published clients, the consent method is always Required." CIMD clients cannot use Trusted either. | [High: S3, S4] |
| Web session in a WebView | Rejected in ADR-0010. I found no Qlik page that supports it for third parties. | [High: ADR-0010] |

- Correction to ADR-0010: it says a Tenant admin "may be able to switch their Tenant to trusted". Qlik says no for published clients. [High: S3]
- Correction to ADR-0003: it says there is "no way to design that step away". Qlik now documents publishing (cross-tenant, per region) and CIMD (cross-region). One admin approval per Tenant still remains in every documented route. [High: S2, S4]
- No Qlik source lowers the per-Tenant approval below one admin action. [High: S3, S4, S5, S14]

---

## 6. Comparison

Costs are per route. "Admin" is the Customer's tenant administrator. "User" is the Qlik User.

| Rank | Option | MTC cost | Customer admin cost | Qlik User cost | Status |
| --- | --- | --- | --- | --- | --- |
| 1 | **CIMD** (hosted metadata document) | Host one small JSON file at a stable HTTPS URL, for ever. No Tenant per region. Possible domain setup for a claimed link. | One approval per Tenant. Same as today. | Hostname only, after approval. | Qlik supports it. Three open facts. [Unverified] for native-app use. |
| 2 | **Ask Qlik for a static all-region client** | A partner request. Qlik runs the client. Cost unknown. | One approval per Tenant (Claude Desktop precedent). | Hostname only. | Qlik does it for Claude Desktop. Offer to third parties is [Unverified]. |
| 3 | **Published client per region** (today) | One MTC Tenant per region, one client per region, one app release per new region. | One approval per Tenant. | Hostname only. | Works in `sg` and `ap`. [High: ADR-0010] |
| 4 | **Customer-made Native client** (current fallback) | None. | Create a client, hand over the client ID. | Type the client ID or get MDM. | Works. This is the problem to remove. |
| 5 | **DCR** | None for the registry. Needs a registration call. | Enable DCR, allow `none`, approve each registration within 60 minutes. | Needs an admin each time. No `offline_access`. | Weak fit. [High: S5, S6] |
| 6 | **API keys** | None. | Grant a permission to users. | Make and paste a long-lived full-access key. | Rejected. Security. |
| - | Device grant, region and organization clients, Trusted consent | - | - | - | Not available for this use. [High: S1, S3, S7, S15] |

Notes on rank:

- Rank 1 removes the MTC Tenant and the client ID. It keeps the same admin cost as rank 3.
- CIMD needs no region table. The app sends the same client ID to any hostname. It may also support custom domains. The app rejects a custom domain today (`custom-domain` in `src/config/resolver.ts`). Whether CIMD works on a custom domain is [Unverified].
- Rank 2 is cheaper for MTC to run if Qlik agrees. It depends on Qlik and has no document.
- Rank 3 is proven but scales per region.
- A static file is not a token broker. ADR-0001 says a server-side need "should be recorded as" a reversal. Hosting a static JSON file is much smaller. Record it in the new ADR anyway.

---

## 7. Recommendation and what to test

**Recommendation.** Make CIMD the default sign-in route, if the tests below pass. Keep the published-client table and the typed client ID as fallbacks. This keeps the Qlik User at "type the hostname". It removes the MTC Tenant per region. It does not remove the one admin approval per Tenant. No documented route does. Ask Qlik about a static all-region client in parallel. If Qlik says yes, that route may be simpler than hosting a document.

### Tests, in order

1. **Redirect check, no login needed.** Host a document at an MTC HTTPS URL. Set `client_id` to the URL, `token_endpoint_auth_method` to `none`, and `redirect_uris` to `qlikanswers://auth`. Send an unauthenticated authorize request to a Tenant in two regions. A 302 to login means Qlik accepts the redirect. A 400 `OAUTH-1` means it does not. Repeat with a reverse-domain scheme and with a claimed `https` link. If Qlik rejects every custom scheme, test the claimed link next, then ask Qlik (rank 2).
2. **Full sign-in in one MTC Tenant per region.** Use `sg` and one MTC Tenant in a region with no published client, if one exists. Approve as admin. Check the OAuth page shows the client with source CIMD. Complete the PKCE flow from a development build.
3. **Scopes.** Request `user_default offline_access`. Check the token has both. Check that a refresh token returns. Check what an admin must add by hand.
4. **App calls.** Call `GET /api/v1/assistants` and the Analytics App list with the token. This repeats the ADR-0010 evidence.
5. **Non-admin first sign-in before approval.** Record the screen and error text. ADR-0010 lists this as unverified for the published client too.
6. **Failure modes.** Test a metadata file that is slow, over 5 KB, or returns a redirect. Test an app release after a metadata change. Qlik may ask for fresh consent or reject the client. [Unverified]
7. **Platforms.** Test iOS Expo Go (the fixed redirect works today), an Android development build, and a release build. A claimed `https` link does not work in Expo Go.
8. **Custom domain.** Send the same request to a Tenant on a custom domain.
9. **Ask Qlik.** Ask whether a static all-region client, like the Claude Desktop client, is available to a partner app. Ask whether CIMD is supported for non-MCP Native clients.

### Test 1 result (2026-10-19): inconclusive

Script: `scripts/cimd-probe.mjs`. I ran it twice. Both runs gave the same result.

- Run 1: a test document in a temporary public GitHub gist. The gist served it as `text/plain`. I deleted the gist.
- Run 2: five test documents on GitHub Pages (`https://notlath.github.io/Paradaisu-Rando/qurio-cimd-*.json`). Pages served them as `application/json`. One document listed three redirects. Four listed one redirect each: loopback, `qlikanswers://auth`, `com.mtc.qurio://auth`, and an `https` link on the same origin.
- Run 2 also included a replica of the Claude Code document (loopback redirect, `client_uri`). Qlik did not reject `qlikanswers://auth` for the replica. So the content type and the redirect type are not the cause.

- With the gist as `client_id`, every redirect got a 302 to login in `sg`, `ap`, `eu` and `us`. This included `qlikanswers://other`, which the document does not list.
- With the Claude Code document as `client_id`, `qlikanswers://auth` got a 400 `OAUTH-1` in `sg` and `eu`. A listed loopback URI got a 302.
- So an unauthenticated authorize request does not check redirects against a document on a host like `gist.githubusercontent.com` or `github.io`. A document at `claude.ai` is checked. The probe cannot show that Qlik accepts `qlikanswers://auth`. Qlik may check only known hosts before login, or it may read the document only after login or at admin approval. [Unverified]
- The no-login test is therefore a dead end for a new host. Test 2 (full sign-in with an admin approval in an MTC Tenant) is the next step. It needs a person to sign in as a Tenant admin. Use the Pages documents above, one redirect at a time.

### Test 2 result (2026-10-19): Qlik accepts `qlikanswers://auth` in a CIMD client

Tenant: `mtcreports.us.qlikcloud.com` (`us`, a region with no published MTC client). Document: `https://notlath.github.io/Paradaisu-Rando/qurio-cimd-scheme.json`. It lists only `qlikanswers://auth`. A Tenant admin signed in and opened the authorize URL in the browser pane.

- Qlik showed the consent screen "Authorize app". It listed `qlikanswers://auth` as the redirect target and the scopes `user_default` and `offline_access`. [High: observed]
- After the admin selected Approve, the browser pane showed `ERR_ABORTED` on `POST /oauth/consent`. The pane cannot open a `qlikanswers://` link. This is not a Qlik error. The approval had worked.
- `GET /api/v1/oauth-clients` then listed the client: `appType` `native`, `createdByType` `cimd`, status `approved`, consent method `required`. Allowed grant types: `authorization_code` and `refresh_token`. Allowed scopes include `user_default`, `offline_access` and `mcp:execute`. [High: observed with an API key]
- So Qlik accepts a custom-scheme redirect without a period in a CIMD client, and the client gets `offline_access`. This closes two of the three open facts in section 1.
- Still [Unverified]: the code-for-token exchange, a refresh, and the `/api/v1/assistants` call with this client. Also unverified: what a non-admin sees before approval.
- The test client stays in `mtcreports.us`. Delete it from the OAuth page when the tests end.

### Test 3 result (2026-10-19): device sign-in works in a region with no published client

An iOS device ran Expo Go. The tester entered `mtcreports.us.qlikcloud.com`, then typed the CIMD document URL as the client ID in the new client ID field. Qlik showed its sign-in page, and the app opened afterwards.

- The app log showed `requested scope: user_default offline_access; granted: offline_access user_default`. So the code-for-token exchange succeeded, and Qlik granted both scopes. [High: observed]
- The tester reported that the app opened. What the Analytics Apps list and the Assistant showed is [Unverified]. A refresh after the access token expires is [Unverified]. A non-admin sign-in is [Unverified].
- Android and a release build are [Unverified].

### Test 4 result (2026-10-20): the production Metadata Client address works

Document: `https://notlath.github.io/qurio-oauth/client.json` (GitHub Pages, `application/json`). An admin approved it in `mtcreports.us`. Qlik created a native client with source CIMD. An iOS device then signed in with that address as the client ID, and the log showed `granted: offline_access user_default`. [High: observed]

Still [Unverified]: the Analytics Apps list and the Assistant after sign-in, a token refresh, a non-admin first sign-in, and Android. The old test client `qurio-cimd-scheme.json` still exists in `mtcreports.us`. An admin must delete it on the OAuth page.

### Test 5 result (2026-10-20): Analytics Apps open with the Metadata Client

After a fresh sign-in with the Metadata Client on `mtcreports.us`, the engine WebSocket token exchange returned `minted, expires in 90s`, and the Analytics App connected. An earlier run failed with `OAUTH-31 Mismatch between clientId in subject token and one in body`. The cause was a stored session from a different client, not the Metadata Client. [High: observed]

The Agentic Assistant, opened in the embedded view with the same session, returned answers. `mtcreports.us` has no legacy Assistant, so a legacy chat with the Metadata Client is [Unverified]. [High for the Agentic Assistant: reported by the tester]

One sign-in returned a `502 BAD-GATEWAY` once and did not repeat. The cause is [Unverified]. Qlik reading the document from GitHub Pages is one possible cause.

### If CIMD fails

- If Qlik rejects the redirect and no claimed link works, keep rank 3 and ask Qlik (rank 2).
- If Qlik removes or limits CIMD for non-MCP clients, keep rank 3.
- Do not use DCR or API keys.

### Decision record

Adoption needs a new ADR. It amends ADR-0010 (region table) and ADR-0003 (the "no way to design that step away" statement). It records the hosted metadata file and its permanent URL.

---

## 8. Sources

All accessed 2026-10-19. A live tenant request is an unauthenticated `GET` with no credentials.

**Qlik developer portal (qlik.dev)**

- S1: OAuth overview. https://qlik.dev/authenticate/oauth/ (read as https://qlik.dev/authenticate/oauth.md)
- S2: OAuth clients REST API spec, "Publish an OAuth client". https://qlik.dev/specs/rest/oauth-clients.json (reference: https://qlik.dev/apis/rest/oauth-clients/)
- S4: OAuth Client ID Metadata Documents (CIMD), last updated 2026-09-29. https://qlik.dev/authenticate/oauth/oauth-client-id-metadata-documents/
- S5: OAuth Dynamic Client Registration (DCR), last updated 2026-09-29. https://qlik.dev/authenticate/oauth/oauth-dynamic-client-registration/
- S12: Generate your first API key. https://qlik.dev/authenticate/api-key/generate-your-first-api-key/
- S13: Qlik developer changelog (CIMD entry 2 Oct 2026, DCR entry 2 Jul 2026). https://qlik.dev/changelog/
- S15: Create a region level M2M OAuth2 client. https://qlik.dev/authenticate/oauth/create/create-region-oauth-client/

**Qlik Help (help.qlik.com)**

- S3: Creating and managing OAuth clients. https://help.qlik.com/en-US/cloud-services/Sense_Hub/Admin/mc-create-oauth-client.htm
- S6: Configuring OAuth dynamic client registration. https://help.qlik.com/en-US/cloud-services/Subsystems/Hub/Content/Sense_Hub/Admin/oauth-dynamic-client-registration.htm
- S14: Connecting to the Qlik MCP server (CIMD, Claude static client). https://help.qlik.com/en-US/cloud-services/Subsystems/Hub/Content/Sense_Hub/QlikMCP/Connecting-Qlik-MCP-server.htm
- S17: Setting up Qlik Sense Mobile SaaS. https://help.qlik.com/en-US/cloud-services/Sense_Hub/Mobile/qsmsaas-setup.htm (seen through a search summary only)

**Live tenant endpoints**

- S7: `https://mtcmarketing.sg.qlikcloud.com/.well-known/oauth-authorization-server` and `.../.well-known/openid-configuration`. The same document shape also came from `demo.eu.qlikcloud.com` and `sense-demo.us.qlikcloud.com`.
- S8: `GET /oauth/authorize` probes on `mtcmarketing.sg`, `mtcklpi.sg`, `mtcteam.ap`, `demo.eu`, `sense-demo.us`, and `demo.us` with the `sg` and `ap` client IDs, the Claude Code CIMD URL, a nonexistent CIMD URL, and the Claude Desktop static client ID. Hosts `demo.sg`, `sense-demo.sg`, `demo.ap`, and `sense-demo.ap` returned 401 and do not exist.

**Standards**

- S9: RFC 8628, OAuth 2.0 Device Authorization Grant. https://www.rfc-editor.org/rfc/rfc8628 (used only to name the grant)
- S10: IETF Internet-Draft `draft-ietf-oauth-client-id-metadata-document-02`. https://datatracker.ietf.org/doc/draft-ietf-oauth-client-id-metadata-document/ (text: https://www.ietf.org/archive/id/draft-ietf-oauth-client-id-metadata-document-02.txt). Revision 03 did not exist on the access date.
- S11: RFC 8252, OAuth 2.0 for Native Apps. https://www.rfc-editor.org/rfc/rfc8252

**Public CIMD documents (examples of real documents)**

- S16: https://claude.ai/oauth/claude-code-client-metadata, https://claude.ai/oauth/mcp-oauth-client-metadata, https://chatgpt.com/oauth/client.json, https://vscode.dev/oauth/client-metadata.json, https://zed.dev/oauth/client-metadata.json

**Repo**

- `docs/adr/0001`, `0003`, `0004`, `0010`. `src/config/resolver.ts` (`PUBLISHED_CLIENT_IDS`, `REGIONAL_HOST`). `src/auth/oauth.ts` (fixed redirect `qlikanswers://auth`, hardcoded endpoints).
