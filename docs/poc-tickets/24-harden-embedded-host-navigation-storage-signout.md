# 24 — Harden the embedded host: navigation, storage and sign-out

**What to build:** The embedded host keeps Qlik content inside our page, leaves nothing readable on the device after use, and forgets the previous Qlik User on sign-out. These are the privacy and containment rules for the host built in ticket 19.

**Blocked by:** Tickets [15](15-record-embedded-auth-spike-outcome.md) and [19](19-reusable-embedded-qlik-host.md).

**Status:** blocked

- [ ] The native-token path uses `incognito` and `cacheEnabled={false}`. Verify the actual iOS and Android storage behaviour against ADR-0007, including embedded runtime storage (local storage, IndexedDB, service workers); disabling the HTTP cache alone is not evidence that Answer content cannot reach disk
- [ ] Block top-level navigation away from the host document while permitting the embedded resources the selected path needs. The spike showed that on Android `onShouldStartLoadWithRequest` did **not** catch a navigation to the Qlik login page, and `onNavigationStateChange` fires after the navigation has happened. Do not rely on either alone: verify initial loads, server redirects, script-initiated navigation and new-window requests on both platforms, and show a test that a redirect to a login page is stopped or detected and handled as a session failure. `isTopFrame` is not a portable assumption
- [ ] For an approved Qlik-web-page fallback (ticket 15, option b), use the URLs and login/navigation allowlist recorded there. Keep cache off, retain cookies only under the approved policy, clear the app WebView's cookies on sign-out, and verify another Qlik User cannot inherit the web session. Implement only after its ADR-0007/storage policy is resolved
- [ ] Sign-out propagates beyond the Settings component: all mounted hosts unmount, pending token delivery stops, and a later mount cannot reuse the previous Qlik User's page, token or runtime state. Preserve server-side OAuth revocation
- [ ] Provide curated loading, load-failure, offline and session-expired states; do not forward raw runtime logs, tokens, tenant internals or Answer content to production logging. Release builds do not enable WebView debugging and do not carry spike instrumentation
- [ ] Tests cover the navigation decisions and session teardown. Device evidence on iOS and Android covers redirects, storage after use (no recoverable Answer content), sign-out and a second Qlik User signing in afterwards; `npm run lint`, `npx tsc --noEmit`, `npm test` pass

References: [ADR-0005](../adr/0005-native-only-qlik-integration.md), [ADR-0007](../adr/0007-no-answer-content-on-device.md), [WebView reference](https://github.com/react-native-webview/react-native-webview/blob/v13.16.1/docs/Reference.md).
