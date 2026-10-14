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

On first start, the Qlik User types only the Tenant hostname, then signs in. The app looks up MTC's published OAuth client for the hostname's region. It then lists the Tenant's Assistants. See [Configure a Tenant](#configure-a-tenant).

The app has three tabs:

| Tab | Behavior |
| --- | --- |
| Apps | Lists accessible Analytics Apps in update order. Supports list and grid views, name search, pagination, and pull to refresh. Opens an Analytics App in an embedded Qlik view. |
| Assistant | Provides native classic Assistant chat. Supports streamed Answers, Stop, Starters, Citations, Feedback, and a **New conversation** action. The header shows the current Assistant. It opens a sheet that lists classic and Agentic Assistants. History lists the Threads of one Assistant at a time. |
| Settings | Provides sign-in, sign-out, the privacy lock, and **Change tenant**. Internal builds also provide a Developer section with manual Tenant Configuration, screenshot, and token-expiry controls. |

The app shows classic Assistants as "Legacy Assistants", which is Qlik's own name for them. The code and this README call them classic Assistants.

The Qlik User chooses the Assistant for each new Thread. A Thread keeps its Assistant for its whole life. The app remembers the last choice for each Tenant. If the Tenant has only one classic Assistant, the app selects it.

Classic Citations show document names and available excerpts. They do not open the source documents. Negative Feedback can include a reason and a comment.

To delete a Thread from History, swipe the row left, long-press the row, or use the screen reader's Delete action. Each path asks for confirmation first.

The app finds Agentic Assistants in the same Assistant list. They open in Qlik's own interface inside a WebView. Their history is separate from classic Thread history. Recorded Android use shows that reopening starts a new chat. Qlik's history control provides access to earlier chats.

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

- A reachable Qlik Cloud Tenant in a region with a published client (`ap` or `sg`). For another region or a custom domain, supply your own Native OAuth client ID.
- A Tenant admin approval of the published client, given once per Tenant. See [Authentication](#authentication).
- A Qlik User with the Answers Entitlement for Assistant use.
- Space access for the Qlik User to each Assistant, and to the Analytics Apps and Knowledge Bases that the Assistant uses.

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
| `tenantHost` | string | Yes | Tenant hostname, such as `acme.sg.qlikcloud.com`. Store no scheme or path. |
| `clientId` | string | No | Native OAuth client ID. When absent, the app uses MTC's published client for the hostname's region. Required for a custom domain or a region without a published client. |
| `assistantId` | string | No | Read, but not used. The Qlik User chooses the Assistant in the app. |
| `agenticAssistantId` | string | No | An Agentic Assistant to offer in the Assistant sheet. Without it, the sheet lists the Agentic Assistants that the Qlik User can view. |
| `biometricTimeoutMs` | number | No | Background duration before the enabled privacy lock locks again. Default: `300000` milliseconds. |

[src/config/resolver.ts](src/config/resolver.ts) holds the published client ID for each region. Today it covers `ap` and `sg`. To add a region, add its client ID to `PUBLISHED_CLIENT_IDS`.

The resolver resolves each source on its own:

1. Use managed configuration if it resolves.
2. Otherwise, use the configuration saved in the app if it resolves.
3. Otherwise, report why the configuration did not resolve. If managed configuration supplied a hostname, the report is about that hostname.

A source resolves when it has a hostname and a client ID, supplied or looked up by region. A hostname without a region (a custom domain) needs its own client ID. A region without a published client is reported as unsupported.

The resolver does not combine fields from different sources. It removes whitespace and control characters from identifiers. It also normalizes a pasted Tenant URL to a lowercase hostname.

### Configure in the app

1. Start the app. The **Connect to your Tenant** screen opens.
2. Type the Tenant hostname, such as `acme.sg.qlikcloud.com`.
3. Select **Continue**.
4. Select **Sign in**. Complete Qlik sign-in.
5. Choose an Assistant from the Assistant tab header.

**Continue** checks whether the Tenant serves `/.well-known/oauth-authorization-server`. It does not verify the client, Assistant access, permissions, or entitlement.

To connect to another Tenant, open **Settings**, then select the Tenant row. Connecting to another Tenant signs out of the current one. **Back** leaves the current Tenant and session unchanged. Managed configuration hides this control.

Internal builds (`__DEV__`) also show a **Developer** form on the first screen and in Settings. Enter the hostname, an OAuth client ID, an Assistant ID, and an Agentic Assistant ID. Then select **Validate & Save**. Release builds do not show this form.

### Configure through device management

Device management is optional. Managed app configuration uses the same case-sensitive keys from the table above. Only `tenantHost` is required.

- **iOS:** Supply the `com.apple.configuration.managed` dictionary. The app reads it through React Native's `Settings` API.
- **Android:** Supply App Restrictions. The local `ManagedConfig` module reads `RestrictionsManager.applicationRestrictions`.

Android declares all five keys in [app_restrictions.xml](modules/managed-config/android/src/main/res/xml/app_restrictions.xml). The config plugin registers that resource in the Android manifest. Supply `biometricTimeoutMs` as an integer. The JavaScript normalizer accepts positive numeric values or numeric strings.

Configuration is read when the app resolves it. There is no managed-configuration change listener. Restart the app after a device-management update to reload startup settings.

The [Customer onboarding runbook](docs/customer-onboarding-runbook.md) covers the Tenant-side setup.

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

MTC publishes one Native OAuth client per region ([ADR-0010](docs/adr/0010-published-oauth-client-tenant-hostname-only.md)). A Tenant admin approves it once for each Tenant, by signing in first and selecting **Approve**. After that, each Qlik User gives consent once, at first sign-in. If a non-admin signs in before the approval, Qlik returns `OAUTH-28`. The app then shows "Tenant Approval required".

A client that you supply must use the exact redirect URI. No client secret is required. Expo Router sends the OAuth callback path to Settings while the authentication listener handles the callback.

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
| `/assistant/choose` | Assistant sheet (form sheet). `?agentic=1` also lists Agentic Assistants. |
| `/assistant/history` | Classic Thread history |
| `/assistant/thread/[id]` | Existing classic Thread |
| `/assistant/agentic` | Embedded Agentic Assistant; redirects to classic chat when unavailable |
| `/settings` | Account, security, and Tenant controls |
| `/settings/change-tenant` | Hostname entry for another Tenant |

The root layout loads fonts, applies capture protection, creates the Qlik adapter, and mounts the privacy lock. It also shows the hostname and sign-in screen until a Tenant resolves and a session exists. Native tabs contain separate navigation stacks.

### Native REST access

UI code uses [AnswersPort](src/qlik/port.ts) and application domain types. The native adapter maps Qlik wire data to those types. Web receives a fixture implementation. An unconfigured native app receives an adapter whose data operations fail with `ConfigMissing`.

Classic requests use `/api/v1/assistants/<assistantId>/...`, with the Assistant that the Qlik User chose. Assistant discovery uses `/api/v1/assistants` and reads all pages. Analytics App listing uses `/api/v1/items?resourceType=app`. Search adds `name=`, which ignores case and matches part of a name. Thumbnail requests use the Apps API. Requests obtain a current token before reaching Qlik. Pagination links must remain on the configured Tenant.

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
| Last chosen Assistant | AsyncStorage key `qlik.lastAssistant.<tenantHost>` |
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
| App says the region is not supported | No published client exists for that region. Supply your own `clientId` through device management, or add the region to `PUBLISHED_CLIENT_IDS`. |
| App says the hostname is a custom domain | Enter the standard hostname that ends in `qlikcloud.com`, or supply your own `clientId`. |
| Tenant validation fails | Check the hostname, internet connection, and public OAuth metadata endpoint. |
| Sign-in shows "Tenant Approval required" | A Tenant admin must sign in once and approve the app. Then sign in again. |
| OAuth rejects the client or callback | Check `clientId`, Native client type, and the exact `qlikanswers://auth` redirect. |
| Assistant tab shows "No Assistants available" | Ask the Tenant admin to give the Qlik User access to the space of an Assistant. |
| An Assistant opens but cannot answer | Give the Qlik User access to the spaces of the Assistant's Analytics Apps and Knowledge Bases. Make sure the Knowledge Base is indexed. |
| Android Expo Go cannot start or sign in | Install an Android development build and connect with `--dev-client`. |
| Agentic Assistant is absent from the sheet | Give the Qlik User access to the space of the Agentic Assistant. The entry is native-only. |
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
- A managed `assistantId` is read but not used. The Assistant always comes from the Qlik User's choice in the app.
- Swipe-to-delete, the Assistant form sheet, and the press animations are not yet verified on physical devices.
- Web shows no Apps search field, because the native search bar is iOS and Android only. Web also cannot delete a Thread, because `Alert` does not show on web.
- The app is online only. It has no offline content, alerts, or push notifications.

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
