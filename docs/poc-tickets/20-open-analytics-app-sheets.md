# 20 — Open an Analytics App and browse its Sheets

**What to build:** Selecting an Analytics App opens Qlik's own Analytics App overview and Sheets inside the reusable native host.

**Blocked by:** Tickets [15](15-record-embedded-auth-spike-outcome.md), [18](18-native-analytics-app-list.md), [19](19-reusable-embedded-qlik-host.md) and [24](24-harden-embedded-host-navigation-storage-signout.md), **and** a decision to reopen this surface after the Agentic Assistant (ticket [21](21-embedded-agentic-assistant-tab.md)) has shipped and passed device acceptance.

**Status:** in-progress (PoC) — the engine connection is explained and an Analytics App displays on a development build (2026-10-02; see the [ADR-0009 addendum](../adr/0009-native-lists-over-rest-qlik-content-via-qlik-embed.md#addendum--analytics-app-engine-connection-ticket-20-probe-2026-10-02)). Hardening and the remaining criteria are not started.

## Why it is unproven

The spike (recorded in ticket 15, Android emulator, 2026-10-02) could not open an Analytics App with `ui="classic/app"` using the native token:

- With `data-auth-type="Oauth2"`, the runtime's `POST /oauth/token` fails at startup with OAUTH-29 (invalid Origin header), with either a null or a tenant page origin, and the embed reports a fatal error.
- With the workarounds that made the Agentic Assistant work (bearer on same-origin calls, locally answered token exchange), the exchange is answered and the runtime proceeds, then the app view shows error code 1006 (abnormal WebSocket close). The cause is unknown: the spike's logging could not see the frame that opens the engine connection.
- Whether the overview lists Sheets and is usable on a phone was never observed, so the earlier assumption that Qlik's overview replaces a native Sheet list is also unverified.

## Acceptance criteria

- [x] Before any implementation, a short probe establishes why the engine connection closes (for example, which URL and parameters the connection uses and what the server returns) and whether a native-token path or the ticket 15 fallback can open an Analytics App at all. Record the result in an ADR or an addendum to ticket 15's decision record
- [ ] If an Analytics App cannot be opened by any approved path, record the blocker, keep the Apps list non-interactive (ticket 18) and revisit the native Sheet-list decision separately. That is a larger QIX-engine decision and is not an automatic fallback
- [ ] Selecting a list row passes its Analytics App `resourceId` to the host; the normal embed path uses `ui="classic/app"` and `app-id`, with no `sheet-id`, unless the probe shows another setting works
- [ ] Qlik's overview lists Sheets and lets the Qlik User open them on a phone. No native Sheet-list REST endpoint is invented and no QIX WebSocket integration is added by this ticket
- [ ] If ticket 15 accepted the web-page fallback, open the proven Analytics App URL through ticket 24's selected policy instead; preserve the same overview/Sheet acceptance criteria
- [ ] The Analytics App view has a native return path to Apps, and Android Back behaviour is demonstrated both within Qlik content and when returning to the list
- [ ] Access is enforced as the signed-in Qlik User. Removed/unavailable Analytics Apps and access changes produce actionable guidance rather than a blank WebView or raw runtime error
- [ ] Loading, offline, auth expiry and sign-out use the shared host's behaviour; no second host implementation, downloads or offline content store is introduced
- [ ] The destination is hidden on web and guarded against direct web entry; list fixtures remain previewable
- [ ] After route changes, briefly run `npx expo start` to refresh typed routes and run `graphify update .`; do not commit generated router types
- [ ] Evidence: a low-privilege Qlik User opens an accessible Analytics App, browses several Sheets and returns to Apps on physical iOS/Android development builds. Verify expiry/sign-out and an unavailable Analytics App; `npm run lint`, `npx tsc --noEmit`, `npm test` pass

If Qlik's overview proves unusable on a phone despite the probe, record the blocker and revisit the native Sheet-list decision separately. That larger implementation is outside this ticket.

References: [qlik-embed parameters](https://qlik.dev/embed/qlik-embed/parameters/), [CONTEXT.md](../../CONTEXT.md), [ADR-0007](../adr/0007-no-answer-content-on-device.md).
