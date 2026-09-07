# Sign-in verification — what to run once a device is available

Covers [docs/poc-tickets/05-sign-in-refresh-sign-out.md](poc-tickets/05-sign-in-refresh-sign-out.md). The code below is built and unit-tested, but the ticket's actual deliverable — a real Qlik User signing in, staying signed in, and signing out, with measurements — needs a real device running a development build (ticket 3) against a resolved tenant config (ticket 4). Neither exists in the environment this was written in: no EAS access, no physical devices, and per ADR-0005 the whole auth layer is unreachable from the web preview by design (verified — see Status).

## What's built

- [`src/auth/token-expiry.ts`](../src/auth/token-expiry.ts) — `computeExpiresAtMs` / `needsRefresh`, unit-tested. Derives expiry from `expires_at` (what Qlik's schema declares) or falls back to `expires_in` if the live response ever includes it, and treats an unknown expiry as needing an immediate refresh rather than assuming the token never expires — the exact bug technical-proposal.md:133-155 warns `expo-auth-session`'s own freshness check has.
- [`src/auth/oauth.ts`](../src/auth/oauth.ts) — redirect URI, discovery endpoints derived from `tenantHost` (Qlik has no discovery document), scopes.
- [`src/auth/tokens.ts`](../src/auth/tokens.ts) — refresh token and expiry timestamp in `expo-secure-store`, `WHEN_UNLOCKED_THIS_DEVICE_ONLY`. The access token is never written here — memory only, per the proposal.
- [`src/auth/session.ts`](../src/auth/session.ts) — `useQlikAuth(config)`: `signIn`, `signOut`, `refreshIfNeeded`. Sign-in sends `deviceType` (`Phone`/`Tablet`, from `expo-device`) and a `description` on the token request so an admin can identify this app's tokens. Sign-out revokes the access token and (if present) the refresh token server-side before clearing local storage.
- [`src/auth/session.web.ts`](../src/auth/session.web.ts) — throws on web (ADR-0005 covers auth, not just data transport). Unit-tested. The Settings screen checks `Platform.OS` before rendering the sign-in control at all, so this throw is a development-time guard against a future accidental cross-boundary import, not something a user can trigger by normal navigation.
- Settings screen: a sign-in/out control appears once a tenant config is resolved, native platforms only.

## What's blocked

Every checklist item that requires an actual signed-in session:

| Checklist item | Status |
|---|---|
| PKCE sign-in completes on both platforms as a real Qlik User | **Blocked** — needs a dev-client build (ticket 3) on a real device |
| Refresh token in secure storage, access token never on disk | Code does this (`tokens.ts`); not exercised against a real token yet |
| Silent refresh after expiry; survives a restart | Code does this (`refreshIfNeeded`, backed by tested `needsRefresh`); not exercised live |
| Token expiry handled whether or not `expires_in` is present, and which one Qlik actually returns is recorded | Code handles both cases (tested); **which one Qlik's live token endpoint actually returns is not yet observed** |
| Measured: actual access-token lifetime, refresh-token behaviour, whether it rotates on use | **Not measured** — needs a live sign-in |
| Measured: whether the tenant's session policy shortens token validity | **Not measured** — needs `GET /api/core/auth-settings` as TenantAdmin, plus a live comparison |
| Sign-out revokes server-side; a revoked refresh token no longer mints an access token | Code calls `revokeAsync` for both tokens before clearing storage; **not verified against a real token** |
| Whether the revocation endpoint accepts the extra client identifier the library sends | **Not observed** |
| Token labelled with device type and description | Code sends both (`deviceTypeLabel`, `description: 'QlikAnswersApp'`); not confirmed visible in the tenant's token list |
| Evidence: recording/screenshots on both platforms | **Not producible** — no device |

## Runbook — run once a dev-client build and a resolved tenant config exist

1. From Settings, tap **Sign in**. Complete the browser consent screen as a real Qlik User with an Answers entitlement.
2. Confirm the app returns to foreground signed in (no crash, no stuck browser tab) — do this on **both** iOS and Android.
3. Immediately after sign-in, log the raw token response (temporarily — do not commit this log) and note: is `expires_in` present alongside `expires_at`? Record it in this file's table above, third row.
4. In Qlik Cloud's Management Console, find this token in the tenant's token list under the signed-in user and confirm the device type / description are visible and correct.
5. Force the stored expiry earlier than now (or wait out the real lifetime) and confirm `refreshIfNeeded` silently refreshes — no re-prompt, no interaction.
6. Kill and relaunch the app after signing in. Confirm no re-login is required.
7. As TenantAdmin, check `GET /api/core/auth-settings` for `userSessionInactivityTimeoutMinutes` / `maxUserSessionLifespanMinutes` and compare against the observed token lifetime.
8. Tap **Sign out**. Immediately attempt to use the just-revoked refresh token directly (e.g. via `POST /oauth/token` with `grant_type=refresh_token`) and confirm it's rejected. Check whether the revocation response accepted or ignored the `client_id` the library sent.
9. Record actual measured lifetimes (access token, refresh token, rotation behaviour) here, replacing this line.
10. Attach recordings/screenshots for both platforms per the ticket's evidence requirement.
