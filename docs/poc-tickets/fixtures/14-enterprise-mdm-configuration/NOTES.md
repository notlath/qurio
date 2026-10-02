# Ticket 14 — status

Covers [docs/poc-tickets/14-enterprise-mdm-configuration.md](../../14-enterprise-mdm-configuration.md).
Unlike every prior ticket, the Android piece here is genuinely new native code (a hand-written Kotlin
Expo module), not a call into an already-compiled Expo SDK API. Per your direction, the full module was
written rather than only specced — flagged below as never compiled or run, since this environment has no
Android SDK/Gradle/`javac` (confirmed: `ANDROID_HOME` unset, no `gradle`/`javac` on `PATH`).

## Done

**The pure normalisation seam, TDD'd** — [`src/config/managed.ts`](../../../src/config/managed.ts),
`normalizeManagedConfig(raw: unknown)`. Takes whatever either platform's native read returns — `undefined`,
a complete object, missing keys, wrong-typed fields, an empty string, `biometricTimeoutMs` as a numeric
string or an invalid value — and produces a safe `Partial<TenantConfig>` or `undefined`. 7 tests, all
red→green, [`managed.test.ts`](../../../src/config/managed.test.ts).

**iOS read** — [`src/config/load-managed-config.ios.ts`](../../../src/config/load-managed-config.ios.ts).
`Settings.get('com.apple.configuration.managed')` from `react-native` — zero new dependency, per
technical-proposal.md §4. The privacy-manifest reason (`AC6B.1`) for this read was already declared in
`app.json` back in ticket 12.

**Android module, written but unverified** — [`modules/managed-config/`](../../../modules/managed-config/):
`expo-module.config.json`, `android/build.gradle`, and
[`ManagedConfigModule.kt`](../../../modules/managed-config/android/src/main/java/expo/modules/managedconfig/ManagedConfigModule.kt)
(reads `RestrictionsManager.applicationRestrictions`, single responsibility, never touches auth or UI, matching
technical-proposal.md §4's brief). `getManagedConfigAsync()` is the JS-facing read; `onManagedConfigChanged`
is emitted from a **dynamically registered** `BroadcastReceiver` for
`ACTION_APPLICATION_RESTRICTIONS_CHANGED`, registered in `OnCreate` / unregistered in `OnDestroy` — the
Android platform constraint that this broadcast never reaches a manifest-declared receiver is why it has to
be done this way, not a design choice. `package.json`'s `expo.autolinking.searchPaths` now includes
`./modules` so this gets picked up by prebuild.

**Both platforms normalise to the same value** — `src/config/load-managed-config.{ios,android,web}.ts` all
pipe their raw read through the same `normalizeManagedConfig`, and `src/config/index.ts` calls whichever one
Metro resolves for the build target. `resolveTenantConfig` (ticket 4, unchanged) already can't tell which
source it came from — precedence and the null/`ConfigMissing` fallback were already source-agnostic.

**Malformed config → `ConfigMissing`, already wired** — no new UI code needed. `normalizeManagedConfig`
drops malformed/absent fields; `resolveTenantConfig` already treats an incomplete managed config as absent
and falls through to dev config or `null`; `errorMessageFor({kind:'ConfigMissing'})` (ticket 11) already
reads "This app has not been configured for your organization. Contact your IT administrator." — this
chain existed before this ticket and just needed the malformed-input case proven safe, which the 7
`managed.test.ts` cases do.

**Dev screen already absent from release builds** — pre-existing, not new: `IS_INTERNAL_BUILD = __DEV__`
(`src/config/development.ts`), and `app/settings.tsx` already gates the entire `TenantConfigForm` behind
it. `__DEV__` is `false` in every release build by React Native's own guarantee, so this checklist item was
already satisfied; confirmed by reading the code, not re-implemented.

**Android manifest + restrictions schema** —
[`modules/managed-config/android/src/main/res/xml/app_restrictions.xml`](../../../modules/managed-config/android/src/main/res/xml/app_restrictions.xml)
declares the same four keys (`tenantHost`, `clientId`, `assistantId`, `biometricTimeoutMs`) the Kotlin
module reads and `normalizeManagedConfig` accepts.
[`plugins/withManagedConfigRestrictions.js`](../../../plugins/withManagedConfigRestrictions.js) (a config
plugin, since `/android` is gitignored and regenerated via `expo prebuild`) injects the
`android.content.APP_RESTRICTIONS` meta-data into the app's manifest at prebuild time; `@xml/app_restrictions`
resolves because Android library-module resources merge into the app automatically — confirmed by reading
how `expo-secure-store` ships its own `res/xml/*.xml` the same way. A declared key absent at runtime returns
`null` from `readRestrictions()` in Kotlin, which `normalizeManagedConfig` already treats as "field not
present," not an error.

**No secrets in the binary — verified statically.** Grepped `src/` for tenant-hostname-shaped and
client/assistant-ID-shaped literals: every match is a placeholder (`acme.eu.qlikcloud.com`,
`client-123`, `assistant-456`) already used consistently in tests and comments — nothing real is
hardcoded anywhere. All real configuration only ever arrives at runtime, from `AsyncStorage` (dev) or the
platform's managed-configuration read (production) — matching CONTEXT.md's own definition of Tenant
Configuration as "supplied at deployment time, never compiled in."

**Onboarding runbook written** — [docs/customer-onboarding-runbook.md](../../../customer-onboarding-runbook.md).
Expands technical-proposal.md §11 with this ticket's concrete key names and the iOS/Android push mechanism
for each.

**Regression check** — `npx jest` (86 passed, up from 79 — the 7 new `managed.test.ts` cases), `npx tsc
--noEmit` (clean), `npx expo lint` (clean). Loaded the web preview and clicked through to Settings: no
console or bundler errors, "Active: `{tenantHost}`" still resolves correctly through the new
`load-managed-config.web.ts` → `normalizeManagedConfig` → `resolveTenantConfig` chain (web's managed read is
always `undefined`, so behaviour versus before this ticket is unchanged — this only proves the new module
wiring didn't break anything reachable from web, since iOS/Android are exactly the two platforms that
cannot be exercised here at all).

## Blocked — all need a real device with a real MDM

| Checklist item | Status |
|---|---|
| Kotlin module actually compiles and runs | **Blocked** — no Android SDK/Gradle/`javac` in this environment; written correctly per the Expo Modules API (cross-checked against `expo-device`'s and `expo-secure-store`'s real, installed Kotlin modules for exact DSL syntax), but literally never built |
| iOS `Settings.get` read verified against a real managed-config push | **Blocked** — needs a device (ticket 3) and a real MDM (or Apple Configurator / Simulator managed-config injection) |
| Runtime-change behaviour recorded, both platforms | **Blocked** — Android's dynamically-registered-receiver mechanism is built but never triggered by a real restrictions push; iOS has no analogous change notification for `Settings.get` at all (Apple's own documented behaviour — a managed-config change is only guaranteed to be picked up on next launch, not live), which is worth telling the Customer up front rather than promising live updates on iOS |
| End-to-end verification against a real MDM on each platform | **Blocked** — this ticket's own explicit prerequisite; no device-management system available here |

## Runbook — run once a device + a real MDM (or MDM emulation, e.g. Apple Configurator / Android Enterprise test console) are available

1. `npx expo prebuild --clean` to regenerate `/android` and `/ios`, confirming the config plugin actually
   injects the `APP_RESTRICTIONS` meta-data and that `modules/managed-config` autolinks (check
   `android/app/build.gradle`'s dependency list, or just that the build succeeds).
2. Build and install a development build on each platform (per
   [docs/dev-build-runbook.md](../../../dev-build-runbook.md)).
3. Push the three required values (plus optionally `biometricTimeoutMs`) through the MDM, following
   [docs/customer-onboarding-runbook.md](../../../customer-onboarding-runbook.md) exactly.
4. Confirm the app resolves the pushed config (Settings screen on an internal build; a normal sign-in on a
   release build, since the dev screen won't exist there).
5. Push a **changed** value and confirm: Android picks it up live (background the app briefly if needed to
   trigger the broadcast) via `onManagedConfigChanged`; record what iOS actually does (expected: only after
   the next cold start, per Apple's documented behaviour — confirm this rather than assume it).
6. Remove one of the three required keys from the push and confirm the app falls back to `ConfigMissing`'s
   "Contact your IT administrator" message, not a raw error or a crash.
7. Repeat steps 3-6 with a second, different MDM if the Customer's own MDM differs from whatever was used
   for step 1's build-time smoke test — or explicitly document that only one was available and this ticket's
   "or the emulation used is documented" fallback was taken.
