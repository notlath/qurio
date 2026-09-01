# 05 — Sign in, stay signed in, sign out

**What to build:** A real Qlik User signs in on both platforms, stays signed in across restarts without re-prompting, and signs out in a way that actually ends the session server-side.

This ticket also produces the measurements the proposal currently marks as unverified.

**Blocked by:** Tickets 03 and 04.

**Status:** ready-for-agent

- [ ] Authorization-code sign-in with PKCE completes on both platforms as a real Qlik User
- [ ] The refresh token is stored in platform secure storage, device-only and available only when unlocked; the access token is never written to disk
- [ ] The access token refreshes without user interaction after expiry, and the app survives a restart without re-login
- [ ] Token expiry is handled correctly **whether or not** the live response carries an `expires_in` field, and which one it actually returns is recorded
- [ ] **Measured and written down:** actual access-token lifetime, refresh-token behaviour observed, and whether the refresh token rotates on use
- [ ] **Measured and written down:** whether the tenant's session policy settings shorten token validity, since that would let a Customer silently cut every mobile session
- [ ] Sign-out revokes server-side and then clears local state; a revoked refresh token is verified to no longer mint an access token
- [ ] It is recorded whether the revocation endpoint accepts the extra client identifier the auth library sends
- [ ] The token is labelled with a device type and description so a tenant administrator can identify and revoke this app's tokens
- [ ] Evidence: a recording or screenshots of the flow on both platforms, plus the written measurements
