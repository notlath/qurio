---
status: accepted
---

# Native lists over REST, Qlik content via qlik-embed

The app renders lists itself from published Qlik REST APIs (Analytics Apps from Items REST, classic chat from `/assistants/...`) and opens Qlik-owned content — first the Agentic Assistant — in a native WebView running `qlik-embed`. The Agentic Assistant authenticates with the **native-token workaround**: our own Native OAuth access token is fed to the embed runtime. Supersedes ADR-0002; amends ADR-0005.

## Decision

Of the three auth paths ticket 15 offered for the Agentic Assistant, the team lead chose **(a) the demonstrated native-token workaround**, on 2026-10-02, as a proof of concept. It needs no backend (ADR-0001 stands), no second sign-in, and no SPA client or system browser (the Customer's veto, ADR-0005).

It has three parts, all in a page we generate and hold in memory:

1. **The page origin is the tenant** (WebView `baseUrl`), so the runtime's same-origin calls reach the tenant.
2. **A bearer token is added to the runtime's same-origin `fetch` calls, except under `/oauth/`.** The token endpoint wants Basic credentials and answers a Bearer with OAUTH-16.
3. **The runtime's `POST /oauth/token` exchange is answered locally** with our own token. The tenant otherwise rejects it with OAUTH-29 (invalid Origin header) and the runtime reports a fatal embed error.

Decision-bearing lines from the prototype (`src/app/agentic-spike.tsx`, a throwaway, not a contract):

```js
// bearer: only same-origin, never /oauth/, never over an existing Authorization
if (bearer && target.origin === bearer.origin && !present && target.pathname.indexOf('/oauth/') !== 0) { /* set Authorization: Bearer */ }
// exchange: answered locally
if (exchangeUrl.pathname === '/oauth/token' && init.method === 'POST') { /* 200 { access_token, issued_token_type, token_type: 'Bearer', expires_in } */ }
```

## Run matrix (Android emulator, development build, 2026-10-02)

Observations only. Hypotheses are marked.

| Surface | Settings | Observed |
| --- | --- | --- |
| `ai/agentic-assistant` | none of the workarounds | Runtime calls our `getAccessToken`; its own same-origin calls carry no bearer (`POST /api/v1/accesscontrol/evaluation` → 401, `GET /api/v1/csrf-token` → 401). Seconds later the WebView navigates to the Qlik login page. |
| `ai/agentic-assistant` | tenant `baseUrl` only; or CSRF stubbed only | `location.origin` is the tenant; the redirect still happens. |
| `ai/agentic-assistant` | auth type and origin unset | Nothing observable. |
| `ai/agentic-assistant` | bearer on same-origin calls, not `/oauth/` | Assistant loads, API calls return 200, chat streams. `csrf-token` → 404 "No token found" (harmless). Without more, `POST /oauth/token` (JSON, RFC 8693 field names) 1.5–4 minutes after a stream starts is rejected with OAUTH-29 and the runtime reports a fatal error. |
| `ai/agentic-assistant` | bearer, plus local exchange | 20-minute session, two questions answered, ten exchange calls answered, no errors, no login redirect. |
| `classic/app` | `Oauth2` auth type, either origin | `/oauth/token` fails with OAUTH-29 at startup; fatal embed error. |
| `classic/app` | bearer plus local exchange | Exchange answered, runtime proceeds, then error 1006 (abnormal WebSocket close). |

Hypotheses, not established: the token endpoint rejects browser-style requests carrying an `Origin` header from a native OAuth client, whatever its value; the exchange timing follows chat activity rather than a fixed timer; error 1006 is an engine-connection handshake rejection.

## Consequences

**No Qlik contract.** This depends on the behaviour of a runtime downloaded from the tenant at load time, which Qlik can change without notice. Only `fetch` traffic was observed; WebSocket or XHR use by the runtime is not covered. The device check is repeated after Qlik runtime updates (ticket 19).

**Security.** Our access token is held in page JavaScript for the session. It stays in memory only: no backend, no API key or client secret, no refresh token in the page, no browser token store.

**Unproven, accepted for the PoC.** Not yet tested: iOS, physical devices, real token expiry and refresh, Knowledge Base and Analytics App questions, sign-out, and storage behaviour against ADR-0007. Ticket 19 carries these as device-evidence criteria. A working emulator session is not iOS evidence.

**Analytics App (`classic/app`) is unproven.** It fails with the modes above and does not gate the Assistant. Opening an Analytics App is revisited through ticket 20 after the Assistant ships.

**Fallback.** If the iOS or physical-device check fails, or the runtime proves too unstable, option (b), Qlik's own web pages in the WebView with a second sign-in, is the fallback. It needs separate team-lead approval and a cookie policy resolved against ADR-0007. Option (c), a SPA client or system browser, and any backend remain separate decisions: a backend reverses ADR-0001.

## Also recorded

Navigation is **Apps · Assistant · Settings**. The Agentic Assistant is optional per Tenant (`agenticAssistantId`). Embedded content is online-only. Native classic chat is retired in stages (tickets 21 and 22). ADR-0008 stays superseded and the unpublished `cloud-assistants` API stays abandoned.
