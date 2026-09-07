# Ticket 12 — status

Covers [docs/poc-tickets/12-security-hardening.md](../../12-security-hardening.md). Almost every checklist
item needs a real device or a real telemetry pipeline to fully verify; this pass builds what's genuinely
achievable now and is explicit about what still needs hardware.

## Scope decision: telemetry (your call)

No telemetry or crash-reporting SDK exists anywhere in this project or in technical-proposal.md's
dependency list (§10) — the proposal mentions "telemetry redaction" only as a POC exit criterion and a
risk mitigation, never as an architectural decision with a chosen vendor. Adding one now would be a real
new third-party dependency decision, not hardening something that exists. Per your direction: not added.
Instead — verified by grepping all of `src/` for `console.*`, `Sentry`, `Bugsnag`, `analytics.`, and
`logEvent`: **zero matches**. There is no logging in this codebase at all yet, so "release builds emit
no sensitive content to logs" (checklist item 6) is trivially, verifiably true right now — there's
nothing to leak. The "inspect captured telemetry payloads" checklist item (5) stays unresolved until a
telemetry solution is chosen; that's a decision for whoever picks one, not something to fake evidence for.

## Done

- [`src/auth/biometric-gate.ts`](../../../src/auth/biometric-gate.ts) — `shouldBeLocked`, the lock
  decision (cold start, or backgrounded past `TenantConfig.biometricTimeoutMs`), unit-tested. Kept
  separate from the real `expo-local-authentication` prompt specifically so it's testable without
  biometric hardware.
- [`src/components/lock-gate.tsx`](../../../src/components/lock-gate.tsx) — wired into the root layout,
  wrapping the whole app. Reads the timeout from `TenantConfig` (falls back to 5 minutes only when MDM
  hasn't set one — "configuration, not hard-coded" per checklist item 1). Failing or dismissing the
  prompt only ever sets local `locked` state back to `true` — verified by inspection that this component
  has no import of `src/auth/tokens.ts` anywhere, so it structurally cannot sign the user out or touch
  the stored refresh token (checklist item 2).
- Screen-capture protection wired into the root layout via `expo-screen-capture`'s
  `preventScreenCaptureAsync()`/`allowScreenCaptureAsync()`.
- iOS privacy manifest: `app.json`'s `ios.privacyManifests` now declares
  `NSPrivacyAccessedAPICategoryUserDefaults` with reason `AC6B.1` for the managed-configuration read
  (checklist item 4) — confirmed against Expo's own versioned config schema docs; the reason code itself
  was already researched and cited in technical-proposal.md:522, not re-derived here.

## A real bug found and fixed while verifying in the browser

Assumed `expo-screen-capture`'s hook/functions would silently no-op on web, same as
`expo-local-authentication` genuinely does. Wrong: calling `usePreventScreenCapture()` — and the plain
`preventScreenCaptureAsync()` function — **throws** `ERR_UNAVAILABLE` on web, an unhandled promise
rejection every time the app loaded. Caught by actually loading the web preview and checking the
console, not by reading the code. Fixed with the same `Platform.OS !== 'web'` guard `LockGate` already
uses; re-verified clean afterward (fresh dev-server restart needed — the first re-check still showed the
old error from a stale bundle, same pattern seen in ticket 8).

## Blocked — all need a real device

| Checklist item | Status |
|---|---|
| Biometric gate actually runs (the real prompt, cold start, background timeout, on hardware) | **Blocked** — needs a device (ticket 3). The decision logic is tested; the real `LocalAuthentication.authenticateAsync()` call is wired but never exercised |
| Screen-capture protection verified per platform, iOS version gating confirmed | **Blocked** — needs real iOS 11+/13+ and Android hardware to confirm screenshots/recording are actually blocked, and that it's silently inert below those iOS versions as documented |
| iOS privacy manifest makes the build submittable | **Blocked** — needs an actual EAS/Xcode build to confirm the generated `PrivacyInfo.xcprivacy` is correct and accepted; static config is in place |
| Telemetry/crash reporting payload inspection | **Not applicable yet** — no telemetry solution chosen (see scope decision above) |
| Per-platform verification record (evidence) | **Blocked** — nothing above can be evidenced without a device to run it on |

`npx jest`, `npx tsc --noEmit`, `npx expo lint` all pass clean; the web build was manually verified to
load without error after the screen-capture fix.
