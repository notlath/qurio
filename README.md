# Qurio — QlikAnswersApp

Qurio is an iOS and Android app for Qlik Cloud. It lists Analytics Apps and provides access to Qlik Answers Assistants. Each Qlik User signs in with their own Tenant identity. The repository name is `qlik-answers-mobile`. The Expo project slug is `QlikAnswersApp`.

This README describes the current code. Some design documents describe changes that are not implemented.

## Contents

- [Current behavior](#current-behavior)
- [Technology](#technology)
- [Requirements](#requirements)
- [Install dependencies](#install-dependencies)
- [Run and build](#run-and-build)
- [Configure a Tenant](#configure-a-tenant)
- [Authentication](#authentication)
- [Architecture](#architecture)
- [Development and verification](#development-and-verification)
- [Security and storage](#security-and-storage)
- [Troubleshooting](#troubleshooting)
- [Known limitations](#known-limitations)
- [Maintenance and related documents](#maintenance-and-related-documents)
- [License](#license)

## Current behavior

The app has three tabs:

| Tab | Behavior |
| --- | --- |
| Apps | Lists accessible Analytics Apps in update order. Supports list and grid views, pagination, and pull to refresh. Opens an Analytics App in an embedded Qlik view. |
| Assistant | Provides native classic Assistant chat. Supports streamed Answers, Stop, Starters, Thread history, Thread deletion, Citations, and Feedback. Shows an Agentic Assistant entry when configured on a native platform. |
| Settings | Provides Tenant Configuration, sign-in, sign-out, and a privacy lock setting. Development builds also provide screenshot and token-expiry controls. |

Classic Citations show document names and available excerpts. They do not open the source documents. Negative Feedback can include a reason and a comment.

The Agentic Assistant uses Qlik's own interface inside a WebView. Its history is separate from classic Thread history. Recorded Android use shows that reopening starts a new chat. Qlik's history control provides access to earlier chats.

Live Qlik features require an internet connection. The app does not provide offline Qlik content.

## Technology

These versions are declared in [package.json](package.json). Exact installed versions are recorded in [package-lock.json](package-lock.json).

| Component | Version or configuration |
| --- | --- |
| Expo | SDK 57; `~57.0.26` |
| React / React Native | `19.2.3` / `0.86.3` |
| Expo Router | `~57.0.24`; file-based routes and typed routes |
| TypeScript | `~6.0.3`; strict mode |
| Reanimated / Worklets | `4.5.1` / `0.10.1` |
| React Native WebView | `13.16.1` |
| Tests | Jest 29 with `jest-expo` |
| Lint | ESLint 9 with Expo configuration |
| React Compiler | Enabled in `app.json` |

Native UI uses Expo native tabs, platform symbols, and SwiftUI or Compose switches. The app follows the device's light or dark appearance.

## Requirements

- Node.js compatible with React Native 0.86.3. The lockfile declares `^20.19.4 || ^22.13.0 || ^24.3.0 || >=25.0.0`.
- npm for dependency installation and the committed lockfile.
- Bun for the `bunx` commands in this README.
- An iOS device with an Expo Go version that supports SDK 57, or an installed development build.
- An Android device or emulator with an installed development build.
- An EAS account with project access for cloud builds.
- Android SDK and Java for local Android builds.
- macOS and Xcode for local iOS builds. Physical iOS device builds also require Apple signing credentials.

For live Qlik access, obtain:

- A reachable Qlik Cloud Tenant.
- A Native OAuth client ID accepted by that Tenant.
- A classic Assistant ID.
- A Qlik User with the required resource permissions and Answers Entitlement for Assistant use.
- An Agentic Assistant ID if you need the embedded Agentic Assistant.

CLI examples use `bunx`. Dependency installation uses npm because this repository maintains `package-lock.json`. [Bun's documentation](https://github.com/oven-sh/bun/blob/main/docs/pm/bunx.mdx) explains executable resolution. Do not add `--bun` to force a different runtime for these tools.

## Install dependencies

From the repository root, run:

```bash
npm ci
```

Use `npm install` when you intentionally change dependencies. Commit the resulting `package-lock.json` changes. Do not add a Bun, Yarn, or pnpm lockfile.

You do not need a `.env` file to configure the app. See [Environment template](#environment-template).

## Run and build

### iOS with Expo Go

Start Metro with a tunnel and select Expo Go:

```bash
bunx expo start --tunnel --go
```

Open the project in Expo Go on your iPhone. The tunnel allows access without a shared local network. Tunnel mode requires internet access and the tunnel support requested by Expo CLI.

The sign-in redirect remains `qlikanswers://auth`. On iOS, the authentication session receives this callback directly. Face ID is unavailable in Expo Go; device authentication can use the passcode fallback.

Expo Go does not validate this app's compiled native configuration. Use an iOS development build to check native plugins, signing, and app-specific settings.

### Android with an EAS development build

Android requires a development build. Expo Go does not contain the local managed-configuration module and cannot receive this app's OAuth redirect.

Sign in to EAS:

```bash
bunx eas-cli login
```

Build the Android app:

```bash
bunx eas-cli build -p android --profile development
```

Install the APK from the completed build on your device. Then start Metro for the installed development client:

```bash
bunx expo start --tunnel --dev-client
```

Open the development client and connect to the Metro URL. Use `bunx expo start --dev-client` if the device can reach Metro through the local network.

[eas.json](eas.json) defines the `development` profile with `developmentClient: true` and internal distribution. It requires EAS CLI 16.0.1 or later. [app.json](app.json) already contains an EAS project ID. Obtain access to that project before building. To use a different EAS project, link it with `bunx eas-cli init` and review the configuration change.

### Local native builds

These commands compile and run the app with local platform tools:

```bash
bunx expo run:android
bunx expo run:ios
```

For an iOS cloud development build, use:

```bash
bunx eas-cli build -p ios --profile development
```

The iOS cloud build requires the applicable Apple signing setup. Install the resulting build before connecting it to Metro.

### Web preview

```bash
bunx expo start --web
```

Web uses an in-memory fixture adapter. It does not sign in to Qlik or load embedded Qlik content. Use it to check classic-chat layouts and simulated data states. Web configuration does not enable live Qlik access.

## Configure a Tenant

### Configuration fields

The source contract is [src/config/types.ts](src/config/types.ts).

| Key | Type | Required | Purpose |
| --- | --- | --- | --- |
| `tenantHost` | string | Yes | Tenant hostname, such as `acme.eu.qlikcloud.com`. Store no scheme or path. |
| `clientId` | string | Yes | Native OAuth client ID. |
| `assistantId` | string | Yes | Classic Assistant ID used by the REST adapter. |
| `agenticAssistantId` | string | No | Agentic Assistant ID used by the embedded view. It does not replace `assistantId`. |
| `biometricTimeoutMs` | number | No | Background duration before the enabled privacy lock locks again. Default: `300000` milliseconds. |

`tenantHost`, `clientId`, and `assistantId` are required even if you use only Analytics Apps or the Agentic Assistant.

The resolver selects one complete configuration:

1. Use managed configuration if all three required fields are present.
2. Otherwise, use the saved Settings configuration if it is complete.
3. Otherwise, return `ConfigMissing`.

The resolver does not combine fields from different sources. Optional fields in Settings do not fill gaps in a complete managed configuration. It removes whitespace and control characters from identifiers. It also normalizes a pasted Tenant URL to a lowercase hostname.

### Configure through Settings

1. Open **Settings**.
2. Open **Workspace connection**.
3. Enter the Tenant hostname, OAuth client ID, and classic Assistant ID.
4. Enter the optional Agentic Assistant ID if needed.
5. Select **Validate & Save**.
6. Select **Sign in** in the Account section. Complete Qlik sign-in.

Validation checks whether the Tenant serves `/.well-known/oauth-authorization-server`. It does not verify the OAuth client ID, Assistant IDs, permissions, or entitlement.

Saving replaces the local configuration and rebuilds the Qlik adapter. A blank Agentic Assistant field removes the saved optional ID. Complete managed configuration still takes precedence. The Workspace connection form is available in both development and release builds. It does not expose the lock timeout field.

### Configure through device management

Managed app configuration uses the same case-sensitive keys from the table above.

- **iOS:** Supply the `com.apple.configuration.managed` dictionary. The app reads it through React Native's `Settings` API.
- **Android:** Supply App Restrictions. The local `ManagedConfig` module reads `RestrictionsManager.applicationRestrictions`.

Android declares all five keys in [app_restrictions.xml](modules/managed-config/android/src/main/res/xml/app_restrictions.xml). The config plugin registers that resource in the Android manifest. Supply `biometricTimeoutMs` as an integer. The JavaScript normalizer accepts positive numeric values or numeric strings.

Configuration is read when the app resolves it. There is no managed-configuration change listener. Restart the app after a device-management update to reload startup settings.

### Environment template

[.env.example](.env.example) contains `QLIK_*` variables for manual API checks and captured test evidence. The app does not read these variables as Tenant Configuration.

`QLIK_API_KEY` is for manual checks only. The app uses per-user OAuth. Never place API keys or client secrets in app configuration. Real `.env` files are ignored by Git.

## Authentication

Authentication uses OAuth authorization code with PKCE. There is no application backend or token broker.

| Setting | Value |
| --- | --- |
| Redirect URI | `qlikanswers://auth` |
| Scopes | `user_default`, `offline_access` |
| Authorization endpoint | `https://<tenantHost>/oauth/authorize` |
| Token endpoint | `https://<tenantHost>/oauth/token` |
| Revocation endpoint | `https://<tenantHost>/oauth/revoke` |
| iOS bundle ID / Android package | `com.mtc.qlikanswersapp` |

Register the exact redirect URI on the Native OAuth client. No client secret is required. Expo Router sends the OAuth callback path to Settings while the authentication listener handles the callback.

The access token stays in memory. The refresh token and access-token expiry timestamp use SecureStore. Expiry is derived from `expires_at`, with `expires_in` as a fallback. An unknown expiry requires refresh. The refresh check uses a 60-second margin. Concurrent requests share one refresh operation.

Sign-out attempts to revoke both tokens. It clears local tokens even if server revocation fails. The Settings control then rebuilds the Qlik adapter. Immediate teardown of an already-mounted embedded view remains incomplete; see [Known limitations](#known-limitations).

## Architecture

### Source layout

```text
src/
  app/                 Expo Router routes and layouts
  auth/                OAuth, token storage, refresh, and lock decisions
  components/          Shared controls, Answer rendering, and privacy lock
  config/              Tenant Configuration, platform readers, and capture policy
  constants/           Theme colors, fonts, spacing, and dimensions
  domain/              Application types and error messages
  hooks/               Theme, view preference, and Thread state
  qlik/                AnswersPort, native adapter, and web fixtures
    classic/           HTTP requests, wire types, mappings, and stream parsing
  qlik-embed/           Generated HTML, runtime script, token bridge, and WebView host
modules/managed-config/ Android Expo module and restriction resources
plugins/               Android manifest config plugin
assets/                Icons, splash images, and other visual assets
docs/                  Design decisions, runbooks, tickets, and captured evidence
```

Routes belong in `src/app/`. Do not add a separate root `app/` directory.

### Routes

| Route | Purpose |
| --- | --- |
| `/` | Analytics App list in the Apps tab |
| `/apps/[id]` | Embedded Analytics App |
| `/assistant` | New classic Thread |
| `/assistant/history` | Classic Thread history |
| `/assistant/thread/[id]` | Existing classic Thread |
| `/assistant/agentic` | Embedded Agentic Assistant; redirects to classic chat when unavailable |
| `/settings` | Configuration, account, and security controls |

The root layout loads fonts, applies capture protection, creates the Qlik adapter, and mounts the privacy lock. Native tabs contain separate navigation stacks.

### Native REST access

UI code uses [AnswersPort](src/qlik/port.ts) and application domain types. The native adapter maps Qlik wire data to those types. Web receives a fixture implementation. An unconfigured native app receives an adapter whose data operations fail with `ConfigMissing`.

Classic requests use `/api/v1/assistants/<assistantId>/...`. Analytics App listing uses `/api/v1/items?resourceType=app`. Thumbnail requests use the Apps API. Requests obtain a current token before reaching Qlik. Pagination links must remain on the configured Tenant.

Stream responses contain concatenated JSON objects. The stream parser tracks braces and string boundaries across reads. The adapter accumulates text and Citations. After a completed stream, it checks the latest Interaction to recover its ID. Stop preserves the partial Answer. A new Thread is created only when the first question is sent.

### Embedded Qlik access

The native WebView hosts `ai/agentic-assistant` or `classic/app`. Generated HTML stays in memory. It loads `@qlik/embed-web-components@1` from jsDelivr.

The token bridge uses a proof-of-concept workaround:

1. Set the WebView base URL to the Tenant origin.
2. Supply a current native access token to the runtime.
3. Add a bearer token to same-origin `fetch` requests without existing authorization. Exclude `/oauth/` requests.
4. Answer the runtime's token exchange locally with the current token and its remaining lifetime.
5. For an engine WebSocket exchange, request a temporary token from Qlik through native code.

Messages and replies use a session identifier. Replies for an ended host session are discarded. A failed script load or no initial token request within 20 seconds produces native retry guidance.

This workaround depends on Qlik runtime behavior. It is not a stable Qlik integration contract.

## Development and verification

Run these commands from the repository root:

| Task | Command |
| --- | --- |
| Start Metro | `bunx expo start` |
| Start iOS Expo Go through a tunnel | `bunx expo start --tunnel --go` |
| Start a development client through a tunnel | `bunx expo start --tunnel --dev-client` |
| Build and run Android locally | `bunx expo run:android` |
| Build and run iOS locally | `bunx expo run:ios` |
| Build Android on EAS | `bunx eas-cli build -p android --profile development` |
| Start web preview | `bunx expo start --web` |
| Lint | `bunx expo lint` |
| Type check | `bunx tsc --noEmit` |
| Run tests | `bunx jest --runInBand` |
| Run source tests only | `bunx jest --runInBand --roots ./src` |

These commands invoke the tools used by the existing package scripts. The EAS build command uses the existing development profile. The repository has no production build profile or release script.

Tests are stored beside source files as `*.test.ts` or `*.test.tsx`. They cover configuration, token expiry and refresh, domain errors, HTTP access, stream parsing, fixtures, Answer rendering, UI controls, and the embedded bridge. Tests use mocks and fixtures. They do not prove live Qlik access or device storage behavior.

For a focused run, pass a test path:

```bash
bunx jest src/config/resolver.test.ts --runInBand
```

### Development conventions

- Keep TypeScript strict mode enabled. Avoid `any`.
- Use `@/` for source imports and `@/assets/` for assets.
- Keep platform variants beside the base file: `.ios`, `.android`, or `.web`.
- Use `src/constants/theme.ts` and `useTheme()` for shared visual values.
- Keep Qlik wire types inside the adapter layer. UI code uses domain types.
- Read the relevant code before changing it. Keep changes limited to the task.
- Run lint, type checks, and the affected tests before submitting changes.

Web fixtures support failure checks. Asking `ERROR:Offline` or `ERROR:RateLimited` simulates those errors. A Feedback comment equal to `FAIL` simulates submission failure. These triggers are fixture behavior only.

## Security and storage

| Data or control | Current implementation |
| --- | --- |
| Access token | Memory only |
| Refresh token and expiry timestamp | SecureStore with `WHEN_UNLOCKED_THIS_DEVICE_ONLY` |
| Local Tenant Configuration | AsyncStorage key `qlik.devTenantConfig` |
| Apps view preference | AsyncStorage key `qlik.appsViewMode` |
| Privacy lock preference | AsyncStorage key `qlik.privacyLockEnabled` |
| Development screenshot preference | AsyncStorage key `qlik.devAllowScreenshots` |
| Native Answers and Thread data | React state; no application persistence layer |
| Thumbnail image cache | Memory cache |
| Embedded WebView | Incognito mode; HTTP cache disabled |
| WebView debugging | Enabled only when `__DEV__` is true |

The privacy lock is enabled by default. It locks on startup and after the configured background duration. A Qlik User can disable it in Settings. Unlock uses device authentication. It does not clear the Qlik session.

Native startup requests screenshot and recording protection. Development builds can allow capture through Settings. Release builds always request protection. Web does not apply these native controls.

The application avoids writing Qlik Answer content to storage. The embedded runtime's actual storage behavior still requires device verification. Incognito mode and a disabled HTTP cache do not prove that all runtime storage remains empty.

Development traces report token-request outcomes, remaining lifetime, and sanitized navigation details. They do not intentionally log tokens or Answer content.

## Troubleshooting

| Symptom | Check or action |
| --- | --- |
| App reports missing configuration | Supply all three required fields. Check managed configuration precedence. |
| Tenant validation fails | Check the hostname, internet connection, and public OAuth metadata endpoint. |
| OAuth rejects the client or callback | Check `clientId`, Native client type, and the exact `qlikanswers://auth` redirect. |
| Android Expo Go cannot start or sign in | Install an Android development build and connect with `--dev-client`. |
| Agentic Assistant entry is absent | Set `agenticAssistantId` in the active configuration. The entry is native-only. |
| Web shows sample content | This is expected. Web always uses fixtures. |
| Embedded view reports a load failure | Check internet access and CDN access. Select **Try again**. |
| Embedded view requests sign-in | Sign in from Settings, then reopen or retry the embedded view. |
| Answers access is denied | Check Answers Entitlement and Assistant permissions with the Tenant administrator. |
| App is locked | Select **Unlock** and complete device authentication. |
| Jest reports duplicate modules or unrelated worktree failures | Use `bunx jest --runInBand --roots ./src`. Jest otherwise scans local agent worktrees. |
| Metro serves stale output | Restart with `bunx expo start --clear` and the required `--go` or `--dev-client` option. |

Assistant HTTP 403 errors currently map to `NotEntitled`. The adapter cannot distinguish a missing entitlement from denied Assistant access. Tenant-level HTTP 403 errors map to `AccessDenied`.

HTTP 429 produces a visible retry delay. The adapter uses `Retry-After` seconds when supplied, or 60 seconds otherwise. The UI does not retry automatically.

## Known limitations

- The embedded Agentic Assistant and Analytics App viewer are proof-of-concept integrations. Recorded Android runs do not establish iOS device acceptance.
- Analytics App opening is implemented. Sheet browsing, reconnect behavior, and full device acceptance remain incomplete.
- An already-mounted embedded host does not immediately observe sign-out. Complete session teardown and a second Qlik User's isolation still require verification.
- Navigation containment relies on WebView callbacks. Earlier Android evidence showed a missed login redirect. Storage and redirect hardening remain open.
- The runtime wrapper covers observed `fetch` traffic. It does not intercept all XHR or WebSocket traffic. The engine WebSocket token exchange has a separate native path.
- An invalid Agentic Assistant ID can produce Qlik's own empty-context screen without a host error.
- Recorded Android use showed that the first question after a long background period can fail inside Qlik's interface.
- Classic Starters and thumbnail endpoints have implementation comments that mark their live behavior as unverified.
- Classic Citations cannot resolve documents to viewable URLs. History can omit excerpt text because it is not hydrated separately.
- Native classic chat is still present. Plans to retire it are not implemented.
- Tenant-hostname-only setup and automatic Assistant discovery in ADR-0010 are not implemented. The current resolver still requires three fields.

## Maintenance and related documents

Use [Expo SDK 57 documentation](https://docs.expo.dev/versions/v57.0.0/) when changing Expo code. Verify package versions and scripts in `package.json` before changing instructions.

Rebuild the development client after native dependency, plugin, or compiled app-configuration changes. Review `app.json`, `eas.json`, `modules/managed-config/`, and `plugins/` when changing platform setup.

Generated `android/`, `ios/`, Expo caches, dependencies, build outputs, and real environment files are ignored. Do not commit them. If local Graphify tooling is installed, run `graphify update .` after code changes, as required by `AGENTS.md`.

Repeat embedded-view device checks after Qlik runtime changes. The CDN reference selects major version 1; it does not pin an exact runtime release. Check sign-in, token refresh, background resume, navigation, sign-out, and storage on physical iOS and Android devices.

| Document | Purpose |
| --- | --- |
| [AGENTS.md](AGENTS.md) | Repository contribution rules |
| [CONTEXT.md](CONTEXT.md) | Domain terminology; some configuration text describes planned behavior |
| [Technical proposal](docs/technical-proposal.md) | Original design and rationale |
| [Architecture decisions](docs/adr/) | Decisions, amendments, and superseded approaches |
| [Development build runbook](docs/dev-build-runbook.md) | Build history and platform setup notes |
| [Customer onboarding runbook](docs/customer-onboarding-runbook.md) | Tenant and managed-configuration setup history |
| [Authentication verification](docs/auth-verification-runbook.md) | Live sign-in and token checks |
| [Embedded host ticket](docs/poc-tickets/19-reusable-embedded-qlik-host.md) | Android evidence and open bridge checks |
| [Analytics App ticket](docs/poc-tickets/20-open-analytics-app-sheets.md) | Sheet-viewing acceptance criteria |
| [Agentic Assistant ticket](docs/poc-tickets/21-embedded-agentic-assistant-tab.md) | Embedded Assistant evidence and acceptance criteria |
| [Embedded hardening ticket](docs/poc-tickets/24-harden-embedded-host-navigation-storage-signout.md) | Open navigation, storage, and sign-out checks |

Older runbooks contain historical status and setup instructions. For example, the development build runbook predates the committed EAS project ID and current iOS Expo Go support. Use the code and this README for current behavior. Use tickets for the limits of recorded evidence.

## License

The repository contains an [MIT license](LICENSE). Retain its copyright and permission notice when distributing covered code.
