# 15 — Record the embedded Agentic Assistant and Analytics App spike outcome

**What to build:** An evidence-backed decision on how native iOS and Android builds open Qlik content, recorded in a new ADR titled “Native lists over REST, Qlik content via qlik-embed”. Resolve ADR-0002 and update ADR-0005 against the auth path actually demonstrated.

**Blocked by:** Device verification of the selected path on iOS and a physical Android device (the auth decision is made; it does not gate ticket 19's code). A second WebView sign-in would require explicit team-lead approval and is not part of path (a).

**Status:** in-progress — team lead chose path (a), the native-token workaround, on 2026-10-02 for the PoC; decision recorded in [ADR-0009](../adr/0009-native-lists-over-rest-qlik-content-via-qlik-embed.md). iOS and physical-device verification still open and carried by ticket 19

Only the **Agentic Assistant** outcome gates tickets 19, 21, 22, 23 and 24. The **Analytics App** (`classic/app`) outcome is recorded here as unproven and gates only ticket 20. Tickets 16, 17 and 18 (configuration field, tab shell, native Analytics App list) are needed under every variant and do not wait on this ticket.

## Spike findings — Android emulator, development build, 2026-10-02

These are observations. Interpretations are marked as hypotheses. Everything came from `src/app/agentic-spike.tsx`; the Customer's tenant is in the Singapore region and the Qlik runtime is downloaded from the tenant at load time. Only an Android emulator has been tested — no iOS, no physical device.

**`ai/agentic-assistant`, no workarounds**
- The tenant runtime calls our `getAccessToken`, but its own same-origin API calls carry no bearer token (`POST /api/v1/accesscontrol/evaluation` returned 401 with `bearer=no`). `GET /api/v1/csrf-token` also returns 401.
- Seconds later the WebView navigates to the Qlik login page; after logging in it lands on the tenant hub and Qlik's own assistant page. Our top-level navigation block did not report this navigation on Android.
- Making the page origin the tenant (`baseUrl`) works as intended (`location.origin` is the tenant) but does not prevent the redirect. Stubbing the CSRF call alone did not prevent it either.
- With the auth type unset and no page origin, nothing observable happens.

**`ai/agentic-assistant`, with workarounds**
- Adding `Authorization: Bearer` to the runtime's same-origin `fetch` calls (excluding `/oauth/`): the assistant loads, every API call returns 200 and chat streams. `csrf-token` returns 404 “No token found”, which is harmless here.
- Adding the bearer to the token endpoint is wrong: that request returned OAUTH-16 (it expects Basic credentials), so `/oauth/` is excluded.
- Without further help the runtime later calls `POST /oauth/token` as JSON with RFC 8693 token-exchange field names (`subject_token`, `subject_token_type`, `grant_type`, `purpose`, `redirect_uri`, `client_id`). The tenant rejects it with OAUTH-29 (invalid Origin header) and the runtime reports a fatal embed error. In every run it occurred 1.5–4 minutes after a chat stream started.
- Answering that exchange locally with our own token: a 20-minute session, two questions answered, ten exchange calls answered, no errors and no login redirect.

**`classic/app`**
- With `data-auth-type="Oauth2"` and either page origin, the runtime's `/oauth/token` call fails with OAUTH-29 at startup and the embed reports a fatal error.
- With the bearer and local exchange workarounds the exchange is answered and the runtime proceeds, then the app view shows error code 1006 (an abnormal WebSocket close). The cause is unknown; whether the app overview lists Sheets and works on a phone was not observed.
- With the auth type unset, nothing observable happens.

**Hypotheses (not established)**
- The token endpoint rejects browser-style requests carrying an `Origin` header from a native OAuth client, whatever the origin value.
- The runtime's exchange timing is tied to chat activity, not a fixed timer.
- Error 1006 is an engine-connection handshake rejection; the logging could not see the frame that opens that connection.

**Not tested:** iOS; physical devices; real token expiry and refresh (the workaround returned the load-time token); Knowledge Base and Analytics App questions; WebSocket or XHR traffic from the assistant; sign-out; storage behaviour against ADR-0007; the Analytics App overview and Sheets.

## Acceptance criteria

- [x] The ADR records the run matrix above with actual settings, platform, package versions, callback calls, HTTP failures and navigation observations, and keeps observations separate from hypotheses: a callback invocation alone does not prove token acceptance, and a working session does not prove iOS behaviour
- [x] The team lead chooses and the ADR records one Agentic Assistant path: (a) the demonstrated native-token workaround, (b) Qlik's own web pages in the WebView with a second sign-in, or (c) a SPA OAuth client or system browser, which reverses ADR-0005 and the Customer's veto and needs its own decision
- [x] If (a): the ADR states that it depends on behaviour of a tenant-downloaded runtime with no Qlik contract, lists the three parts (tenant page origin, bearer on same-origin calls except `/oauth/`, locally answered token exchange), and inlines the prototype's decision-bearing lines, marked as coming from a prototype. It also records the security consequence: our access token is held in page JavaScript for the session
- [ ] If (b): demonstrate the Agentic Assistant, obtain and record the team-lead approval for the second sign-in, and specify permitted login/content navigation, cookie lifetime and cookie clearing on sign-out. Resolve the cookie/storage policy against ADR-0007 (caching off, no Answer content persisted) and record any ADR edit explicitly; if it cannot be satisfied, keep downstream tickets blocked
- [ ] Verify the selected path on a physical Android device and on iOS, including whether it asks for a second sign-in; do not treat the emulator result as iOS evidence
- [x] Record the Analytics App surface as **unproven**, with the failure modes above. State that it does not gate the Assistant, and that opening an Analytics App is revisited through ticket 20 after the Assistant ships
- [x] The new ADR captures native Analytics App lists over published Items REST, Qlik-owned embedded content, online-only operation, Apps · Assistant · Settings navigation, optional `agenticAssistantId`, the staged native classic-chat retirement and the selected auth path. Mark ADR-0002 superseded and link its replacement; leave ADR-0008 superseded and the unpublished API abandoned
- [x] Make a substantive ADR-0005 edit explaining native WebView use versus the fixtures-only web target and the Customer's SPA-client veto. Neither a SPA client nor a system browser is implicitly authorised
- [x] The handoff owner confirmed on 2026-10-01 that the previously exposed personal Qlik API key was revoked
- [ ] Evidence, tickets and fixtures contain no tokens, keys, sensitive query parameters, tenant identifiers or Customer content
- [ ] This ticket does **not** delete `src/app/agentic-spike.tsx` or its header link in `src/app/_layout.tsx`. The spike stays as a working reference until ticket 19 has merged; ticket 19 deletes it. The spike's local edits are uncommitted as of this writing and must be committed or otherwise preserved before then. A trailing-newline-only ADR change is not an architectural decision
- [ ] Evidence: sanitised run matrix and selected-path device observations in the decision record; `npm run lint`, `npx tsc --noEmit` and `npm test` pass; run `graphify update .`

References: [ADR-0001](../adr/0001-per-user-native-oauth-no-backend.md), [ADR-0002](../adr/0002-native-ui-over-rest-not-webview.md), [ADR-0005](../adr/0005-native-only-qlik-integration.md), [ADR-0007](../adr/0007-no-answer-content-on-device.md), [research §10](../research-integration-gaps.md#10-agentic-path--any-supported-route-today). The [derived cloud-assistants contract](derived/cloud-assistants-contract.md) is historical reference, not an implementation contract.
