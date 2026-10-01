# 19 — Build the reusable embedded Qlik host and token bridge

**What to build:** One native WebView host shared by the Agentic Assistant and, later, the Analytics App surface, using only the auth path chosen and approved in ticket 15. This ticket delivers a host that loads the embed and keeps it signed in for a full session; navigation, storage and sign-out hardening are ticket 24.

**Blocked by:** Ticket [15](15-record-embedded-auth-spike-outcome.md). If it selects the Qlik-web-page fallback instead of native-token reuse, the token-bridge criteria below are replaced by that fallback's.

**Status:** blocked

- [ ] Agree the host's minimum surface/identifier interface and use the installed `react-native-webview` 13.16.1; keep `ai/agentic-assistant` settings aligned with device evidence. `classic/app` is out of scope until ticket 20
- [ ] For native-token reuse, use the existing `getAccessToken(config)` authority. Tokens and generated HTML remain in memory; no backend, API key, client secret, refresh token in page JavaScript, or browser token store is introduced
- [ ] The host reproduces the spike-demonstrated behaviour: the page's origin is the tenant, the runtime's same-origin `fetch` calls carry the bearer token except calls under `/oauth/`, and the runtime's `POST /oauth/token` exchange is answered locally. Escape interpolated configuration and identifiers for their actual HTML/JavaScript context
- [ ] The locally answered exchange returns a **fresh** token obtained from the native app on each call, with an `expires_in` taken from the token's actual expiry, not the load-time token or a hard-coded value. The same token source feeds the bearer on calls
- [ ] The native-to-page token bridge validates messages, binds replies to the current trusted page and session, and rejects stale requests after sign-out or Tenant change
- [ ] Verify Agentic AI permissions and Native OAuth granted/requested scopes for the Assistant. If the existing `user_default`/`offline_access` request is insufficient, add only the proven required scopes and record re-consent/re-authentication needs for ticket 23's runbook
- [ ] Token expiry uses actual expiry metadata, not a hard-coded six-hour lifetime. Prove that a session survives past the access token's expiry and an app resume; when silent refresh fails, show actionable native re-authentication guidance without a login redirect or retry loop
- [ ] Unexpected runtime behaviour — a navigation to a Qlik login page, a fatal embed error, a failed exchange — is treated as session failure with native guidance, never an interactive login inside the WebView unless ticket 15 approved that fallback
- [ ] Handle only the traffic observed in the spike (`fetch`). Document that WebSocket or XHR use by the runtime is not covered, and the manual device check to repeat after Qlik runtime updates, because the runtime is downloaded from the tenant and can change without notice
- [ ] The host is unreachable on web, including direct routes; web previews stay on fixtures. App-wide screen-capture protection remains active
- [ ] After the host works, delete `src/app/agentic-spike.tsx` and its header link/Stack registration in `src/app/_layout.tsx`, preserving unrelated local edits. Do not delete earlier; the spike is the reference until then
- [ ] Tests verify the chosen auth seam, the bearer/exchange decisions (including the `/oauth/` exclusion) and fresh-token delivery. Device evidence verifies refresh/expiry and a long chat session on iOS and Android; `npm run lint`, `npx tsc --noEmit`, `npm test` pass

**Decide during:** Whether the page asks the app for a token on every call (through `postMessage`) or the app pushes renewals into a long-lived page; mid-session expiry UX; whether unsent input can survive re-authentication in memory. Do not promise input restoration the Qlik-owned surface cannot provide.

References: [ADR-0001](../adr/0001-per-user-native-oauth-no-backend.md), [ADR-0005](../adr/0005-native-only-qlik-integration.md), [ADR-0007](../adr/0007-no-answer-content-on-device.md), [WebView reference](https://github.com/react-native-webview/react-native-webview/blob/v13.16.1/docs/Reference.md), [qlik-embed parameters](https://qlik.dev/embed/qlik-embed/parameters/).
