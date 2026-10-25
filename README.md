# Qurio — QlikAnswersApp

Qurio is an iOS and Android app for Qlik Cloud. It lists Analytics Apps and provides access to Qlik Answers Assistants. Each Qlik User signs in with their own Tenant identity. The repository name is `qlik-answers-mobile`. The Expo project slug is `QlikAnswersApp`.

This README describes the current code. Some design documents describe changes that are not implemented.

## Contents

- [Beta release and Android installation](#beta-release-and-android-installation)
- [Current behavior](#current-behavior)
- [Technology](#technology)
- [Requirements](#requirements)
- [Install dependencies](#install-dependencies)
- [Run and build](#run-and-build)
- [Configure a Tenant](#configure-a-tenant)
- [Authentication](#authentication)
- [Architecture](#architecture)
- [Development and verification](#development-and-verification)
- [Beta verification status](#beta-verification-status)
- [Security and storage](#security-and-storage)
- [Troubleshooting](#troubleshooting)
- [Known limitations](#known-limitations)
- [Maintenance and related documents](#maintenance-and-related-documents)
- [License](#license)

## Beta release and Android installation

The latest release is **Qurio v1.0.0-beta.6**, an internal beta for installation and acceptance testing. It is not a stable release.

On October 21, 2026, the maintainer published the signed standalone Android APK and checksum in [Qurio v1.0.0-beta.6](https://github.com/notlath/qlik-answers-mobile/releases/tag/v1.0.0-beta.6). The release tag points to merged `main` (`e9b8e24`). The existing GitHub workflow runs CI only. Earlier betas remain on the [Releases](https://github.com/notlath/qlik-answers-mobile/releases) page.

Download the APK and checksum from the release Assets section. This repository is private, so GitHub downloads require repository access.

Beta 6 is built from `main`. Some `dev` features in this README are not in beta 6:

- The Customer Brand.
- PR #49: the Metadata Client for every region, the iOS private sign-in sheet, and the Tenant approval message.

| Prepared APK | Verified value |
| --- | --- |
| Filename | `qurio-1.0.0-beta.6-e9b8e24-release-signed.apk` |
| Android package | `com.mtc.qlikanswersapp` |
| Embedded version / version code | `1.0.0` / `6` |
| Minimum Android version | Android 7.0, API 24 |
| Build | Release, not debuggable, with the application bundle included |
| Signature | Release certificate. APK Signature Scheme v2 and v3 passed |
| Alignment | 16 KB alignment check passed |

The beta release label does not change the APK's embedded `1.0.0` version name. Beta 1 to 3 use version code `1`. Beta 4 uses version code `4`. Beta 5 uses version code `5`. Beta 6 uses version code `6`.

### Install the standalone APK

1. Obtain the APK from the maintainer or an approved GitHub Release.
2. Compare its SHA-256 checksum with the value below.
3. Open the APK on Android. Complete Android's installation confirmation if device policy permits installation from that source.
4. Open Qurio. Enter the Tenant hostname and complete Qlik sign-in.

Expected SHA-256 for the prepared APK:

```text
06678C1697E35B2850A40AAB1B6E935CEFF434E4890E7C58056949AE5321BFC9
```

On Windows, verify a downloaded copy with PowerShell:

```powershell
Get-FileHash -LiteralPath './qurio-1.0.0-beta.6-e9b8e24-release-signed.apk' -Algorithm SHA256
```

For USB installation, connect an authorized device with USB debugging enabled:

```bash
adb devices
adb install ./qurio-1.0.0-beta.6-e9b8e24-release-signed.apk
```

The standalone APK runs without a computer or Expo/Metro server. Sign-in, Answers, and Analytics Apps still require internet access to Qlik Cloud. A development-client APK normally requires Metro, even when it is signed. Signing alone does not make a build standalone.

No installable iOS artifact is recorded for this beta. Use the iOS development options below for testing.

## Current behavior

On first start, the Qlik User types only the Tenant hostname, then signs in. The app looks up MTC's published OAuth client for the hostname's region. It then lists the Tenant's Assistants. See [Configure a Tenant](#configure-a-tenant).

The app opens on the Assistant. A side panel provides navigation and the selected Assistant's History:

| Destination | Behavior |
| --- | --- |
| Apps | Lists accessible Analytics Apps in update order. Supports list and grid views, name search, pagination, and pull to refresh. Opens an Analytics App in an embedded Qlik view. |
| Assistant | Provides native classic Assistant chat. Supports streamed Answers, Stop, Starters, Citations, Feedback, and a **New conversation** action. The header shows the current Assistant. It opens a sheet that lists classic and Agentic Assistants. History lists the Threads of one Assistant at a time. |
| Settings | Provides sign-in, sign-out, the privacy lock, and **Change tenant**. Internal builds also provide a Developer section with manual Tenant Configuration, screenshot, and token-expiry controls. |

On narrow windows, the panel overlays the current screen. At widths of 768 points or more, it docks beside the content. The panel button can collapse the docked panel. Settings opens above the overlay on phones or beside the docked panel on wide windows.

The app shows classic Assistants as "Legacy Assistants", which is Qlik's own name for them. The code and this README call them classic Assistants.

The Qlik User chooses the Assistant for each new Thread. A Thread keeps its Assistant for its whole life. The app remembers the last choice for each Tenant. If the Tenant has only one classic Assistant, the app selects it.

Classic Citations show document names and available excerpts. They do not open the source documents. Negative Feedback can include a reason and a comment.

Long-press a Thread in History to **Pin** or **Unpin**, **Rename**, or **Delete** it. Screen-reader actions provide the same controls. Delete asks for confirmation. Pinned Threads appear above the other conversations. Swiping closes the overlay panel instead of deleting a Thread.

The app finds Agentic Assistants in the same Assistant list. They open in Qlik's own interface inside a WebView. Their history is separate from classic Thread history. Recorded Android use shows that reopening starts a new chat. Qlik's history control provides access to earlier chats.

Live Qlik features require an internet connection. The app does not provide offline Qlik content.

### Customer Brand

A Brand is a Customer's logo and main colour ([ADR-0013](docs/adr/0013-customer-brand-at-runtime-one-build.md)). All Customers use the same build. The app applies the Brand at runtime. The source is [src/brand/brand.ts](src/brand/brand.ts).

1. MTC hosts one static Brand file for each tenant hostname: `https://notlath.github.io/qurio-oauth/brands/<tenantHost>.json`.
2. The app reads the file when it knows the hostname. This includes the sign-in screen, before the configuration is saved.
3. The app shows the stored Brand for that hostname at once. It then fetches the hosted file and stores the result.

The file holds `primary.light` and `primary.dark` as `#RRGGBB` colours. It can also hold `name`, `logo` and `logoDark`. Logos are `https://` PNG URLs with a transparent background. The app ignores a file that has a missing or malformed field.

| Brand element | Where it shows |
| --- | --- |
| Main colour | Replaces the `primary` theme colour, also on the sign-in screen and in navigation headers. The text colour on it is white or black, whichever has more contrast. |
| Logo | Replaces the Qurio logo in the side-panel header and on the chat welcome. Dark mode uses `logoDark` when present. A screen reader announces `name`. |

The app uses Qurio's Brand in these cases:

- No hostname is entered yet.
- The hostname has no Brand file (HTTP 404).
- A colour has less than 3:1 contrast with the background or 4.5:1 with its text. This applies to each theme separately.
- A logo fails to load. Only the logo falls back.

The app name, the home-screen icon and the splash screen are compiled in and stay Qurio. A Customer that needs its own name and icon needs a White-label Build. A failed request keeps the stored Brand.

## Technology

These versions are declared in [package.json](package.json). Exact installed versions are recorded in [package-lock.json](package-lock.json).

| Component | Version or configuration |
| --- | --- |
| Expo | SDK 57; `~57.0.29` |
| React / React Native | `19.2.3` / `0.86.3` |
| Expo Router | `~57.0.27`; file-based routes and typed routes |
| TypeScript | `~6.0.3`; strict mode |
| Reanimated / Worklets | `4.5.1` / `0.10.1` |
| React Native WebView | `13.16.1` |
| Tests | Jest 29 with `jest-expo` |
| Lint | ESLint 9 with Expo configuration |
| React Compiler | Enabled in `app.json` |

Native UI uses a drawer with native navigation stacks, platform symbols, and SwiftUI or Compose switches. The app follows the device's light or dark appearance.

## Requirements

- Node.js 24.3 or later in the 24.x series. CI uses Node.js 24. Check `package-lock.json` for dependency engine requirements.
- npm for dependency installation and the committed lockfile.
- An iOS device with an Expo Go version that supports SDK 57, or an installed development build.
- An Android device or emulator with a development build for coding, or the standalone APK for acceptance testing.
- An EAS account with project access for cloud builds.
- Android SDK Platform 36, Platform Tools, Build Tools, JDK 17, and the generated project's NDK/CMake versions for local Android builds.
- macOS, compatible Xcode, and CocoaPods for local iOS builds. Physical iOS device builds also require Apple signing credentials.

For live Qlik access, obtain:

- A reachable Qlik Cloud Tenant at `<name>.<region>.qlikcloud.com`, in any region. A custom domain is not supported.
- A Tenant admin approval of the app, given once per Tenant. The first sign-in at a Tenant must be by a Tenant admin. See [Authentication](#authentication).
- A Qlik User with the Answers Entitlement for Assistant use.
- Space access for the Qlik User to each Assistant, and to the Analytics Apps and Knowledge Bases that the Assistant uses.

CLI examples use npm and npx with the committed `package-lock.json`. These development tools are not required to run the standalone APK.

## Install dependencies

From the repository root, run:

```bash
npm ci
```

Use `npm install` when you intentionally change dependencies. Commit the resulting `package-lock.json` changes. Do not add a Bun, Yarn, or pnpm lockfile.

You do not need a `.env` file to configure the app. See [Environment template](#environment-template).

## Run and build

These commands are for developers. Testers with the standalone APK can use [Android installation](#install-the-standalone-apk).

Only the `development` EAS profile is committed. It normally connects to Metro. The prepared standalone APK came from a local Release build with a temporary signing override and a separate signing step. No standalone EAS profile or release-publishing workflow was added.

Verify the actual signing certificate before distributing a local Release APK. The generated Android project used the debug key by default during build preparation.

### iOS with Expo Go

Start Metro with a tunnel and select Expo Go:

```bash
npx expo start --tunnel --go
```

Open the project in Expo Go on your iPhone. The tunnel allows access without a shared local network. Tunnel mode requires internet access and the tunnel support requested by Expo CLI.

The sign-in redirect remains `qlikanswers://auth`. On iOS, the authentication session receives this callback directly. Face ID is unavailable in Expo Go; device authentication can use the passcode fallback.

Expo Go does not validate this app's compiled native configuration. Use an iOS development build to check native plugins, signing, and app-specific settings.

### Android with an EAS development build

Android requires a development build. Expo Go does not contain the local managed-configuration module and cannot receive this app's OAuth redirect.

Sign in to EAS:

```bash
npx eas-cli@latest login
```

Build the Android app:

```bash
npx eas-cli@latest build -p android --profile development
```

Install the APK from the completed build on your device. Then start Metro for the installed development client:

```bash
npx expo start --tunnel --dev-client
```

Open the development client and connect to the Metro URL. Use `npx expo start --dev-client` if the device can reach Metro through the local network.

[eas.json](eas.json) defines the `development` profile with `developmentClient: true` and internal distribution. It requires EAS CLI 16.0.1 or later. [app.json](app.json) already contains an EAS project ID. Obtain access to that project before building. To use a different EAS project, link it with `npx eas-cli@latest init` and review the configuration change.

### Local native builds

These commands compile and run the app with local platform tools:

```bash
npx expo run:android
npx expo run:ios
```

For an iOS cloud development build, use:

```bash
npx eas-cli@latest build -p ios --profile development
```

The iOS cloud build requires the applicable Apple signing setup. Install the resulting build before connecting it to Metro.

### Web preview

```bash
npx expo start --web
```

Web uses an in-memory fixture adapter. It does not sign in to Qlik or load embedded Qlik content. Use it to check classic-chat layouts and simulated data states. Web configuration does not enable live Qlik access.

## Configure a Tenant

### Configuration fields

The source contract is [src/config/types.ts](src/config/types.ts).

| Key | Type | Required | Purpose |
| --- | --- | --- | --- |
| `tenantHost` | string | Yes | Tenant hostname, such as `acme.sg.qlikcloud.com`. Store no scheme or path. |
| `clientId` | string | No | Native OAuth client ID. When absent, the app uses MTC's published client for the hostname's region, or the Metadata Client where MTC has no published client. Required for a custom domain. |
| `assistantId` | string | No | Read, but not used. The Qlik User chooses the Assistant in the app. |
| `agenticAssistantId` | string | No | An Agentic Assistant to offer in the Assistant sheet. Without it, the sheet lists the Agentic Assistants that the Qlik User can view. |
| `biometricTimeoutMs` | number | No | Background duration before the enabled privacy lock locks again. Default: `300000` milliseconds. |

[src/config/resolver.ts](src/config/resolver.ts) holds the published client ID for each region. Today it covers `ap`, `sg` and `us`. Every other region uses the Metadata Client (ADR-0012). Do not add a region unless Customers there need a published client.

The resolver resolves each source on its own:

1. Use managed configuration if it resolves.
2. Otherwise, use the configuration saved in the app if it resolves.
3. Otherwise, report why the configuration did not resolve. If managed configuration supplied a hostname, the report is about that hostname.

A source resolves when it has a hostname and a client ID, supplied or looked up by region. A hostname without a region (a custom domain) needs its own client ID.

The resolver does not combine fields from different sources. It removes whitespace and control characters from identifiers. It also normalizes a pasted Tenant URL to a lowercase hostname.

### Configure in the app

1. Start the app. The **Connect to your Tenant** screen opens.
2. Type the Tenant hostname, such as `acme.sg.qlikcloud.com`.
3. Select **Continue**.
4. Select **Sign in**. Complete Qlik sign-in.
5. Choose an Assistant from the Assistant screen header.

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

Each sign-in asks Qlik for a new login form, so a sign-out and a new sign-in do not return the previous account:

- All platforms send `prompt=login`. Android needs it because Chrome keeps the Qlik web session after a sign-out.
- iOS also opens a private sign-in sheet (`preferEphemeralSession`) that does not share Safari cookies.

An Identity Provider session (for example Okta or Entra) can still select the same account without a form. This is not verified against a real Tenant.

A client that you supply must use the exact redirect URI. No client secret is required. Expo Router sends the OAuth callback path to Settings while the authentication listener handles the callback.

The access token stays in memory. The refresh token and access-token expiry timestamp use SecureStore. Expiry is derived from `expires_at`, with `expires_in` as a fallback. An unknown expiry requires refresh. The refresh check uses a 60-second margin. Concurrent requests share one refresh operation.

Sign-out attempts to revoke both tokens. It clears local tokens even if server revocation fails. The Settings control then rebuilds the Qlik adapter. Immediate teardown of an already-mounted embedded view remains incomplete; see [Known limitations](#known-limitations).

## Architecture

### Source layout

```text
src/
  app/                 Expo Router routes and layouts
  auth/                OAuth, token storage, refresh, and lock decisions
  brand/               Customer Brand file, stored Brand, and contrast checks
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
| `/` | Redirects to `/assistant` |
| `/apps` | Analytics App list |
| `/apps/[id]` | Embedded Analytics App |
| `/assistant` | New or resumed classic Thread. History supplies the Thread and Assistant parameters |
| `/assistant/choose` | Assistant sheet (form sheet). `?agentic=1` also lists Agentic Assistants. |
| `/assistant/agentic` | Embedded Agentic Assistant; redirects to classic chat when unavailable |
| `/settings` | Account, security, and Tenant controls |
| `/settings/change-tenant` | Hostname entry for another Tenant |
| `/docked-settings` | Settings beside the panel on wide windows |
| `/docked-settings/change-tenant` | Tenant change beside the docked panel |

History is part of the side panel, not a separate route. The root layout loads fonts, applies capture protection, creates the Qlik adapter, and mounts the privacy lock. It shows the hostname and sign-in screen until a Tenant resolves and a session exists. The drawer destinations contain separate navigation stacks.

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
| Start Metro | `npx expo start` |
| Start iOS Expo Go through a tunnel | `npx expo start --tunnel --go` |
| Start a development client through a tunnel | `npx expo start --tunnel --dev-client` |
| Build and run Android locally | `npx expo run:android` |
| Build and run iOS locally | `npx expo run:ios` |
| Build Android on EAS | `npx eas-cli@latest build -p android --profile development` |
| Start web preview | `npx expo start --web` |
| Lint | `npx expo lint` |
| Type check | `npx tsc --noEmit` |
| Run tests | `npx jest --runInBand` |
| Run source tests only | `npx jest --runInBand --roots ./src` |

These commands invoke the tools used by the existing package scripts. The EAS build command uses the existing development profile. The repository has no production build profile or release script.

Tests are stored beside source files as `*.test.ts` or `*.test.tsx`. They cover configuration, token expiry and refresh, domain errors, HTTP access, stream parsing, fixtures, Answer rendering, UI controls, and the embedded bridge. Tests use mocks and fixtures. They do not prove live Qlik access or device storage behavior.

For a focused run, pass a test path:

```bash
npx jest src/config/resolver.test.ts --runInBand
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

## Beta verification status

Recorded for beta 6 on October 21, 2026:

| Check | Result |
| --- | --- |
| PR [#53 checks](https://github.com/notlath/qlik-answers-mobile/pull/53/checks) | All six CI checks passed |
| Lint, TypeScript, and unit tests | Passed locally. 49 suites, 588 tests |
| Signed APK | Release certificate (same as beta 1 to 5), v2/v3 signatures, checksum, and 16 KB alignment verified |
| `prompt=login` sign-in | Not verified against a real Tenant |
| Prepared APK on a physical Android device | Installation and live acceptance remain unverified |
| iOS native build and device installation | Remain unverified. No signed iOS application is included |
| GitHub Release and APK upload | Published as `v1.0.0-beta.6` |

CI and signature checks do not establish production readiness. Earlier proof-of-concept device evidence does not validate this prepared APK.

For beta acceptance, use a test Tenant and disposable Threads:

1. Install the standalone APK. Start it with Metro stopped and internet access available.
2. Verify Tenant connection, sign-in callbacks, token refresh, background resume, and the privacy lock.
3. Ask a question. Verify Answers, History, pin/unpin, rename, and confirmed deletion of a test Thread.
4. Verify Analytics Apps, Agentic Assistants, sign-out, and session isolation where the Tenant permits access.
5. Record the device, OS version, APK version, and results. Test iPhone and iPad behavior separately when an iOS build is available.

## Security and storage

| Data or control | Current implementation |
| --- | --- |
| Access token | Memory only |
| Refresh token and expiry timestamp | SecureStore with `WHEN_UNLOCKED_THIS_DEVICE_ONLY` |
| Local Tenant Configuration | AsyncStorage key `qlik.devTenantConfig` |
| Last chosen Assistant | AsyncStorage key `qlik.lastAssistant.<tenantHost>` |
| Customer Brand of the current Tenant | AsyncStorage key `qlik.brand`. Removed when the Tenant changes or its file returns 404 |
| Apps view preference | AsyncStorage key `qlik.appsViewMode` |
| Docked panel preference | AsyncStorage key `qlik.sidePanelCollapsed` |
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
| Assistant screen shows "No Assistants available" | Ask the Tenant admin to give the Qlik User access to the space of an Assistant. |
| An Assistant opens but cannot answer | Give the Qlik User access to the spaces of the Assistant's Analytics Apps and Knowledge Bases. Make sure the Knowledge Base is indexed. |
| Android Expo Go cannot start or sign in | Install an Android development build and connect with `--dev-client`. |
| Agentic Assistant is absent from the sheet | Give the Qlik User access to the space of the Agentic Assistant. The entry is native-only. |
| Web shows sample content | This is expected. Web always uses fixtures. |
| Customer Brand does not show | Check that `brands/<tenantHost>.json` exists and has valid `primary.light` and `primary.dark` colours. A colour with too little contrast falls back to Qurio green. |
| Embedded view reports a load failure | Check internet access and CDN access. Select **Try again**. |
| Embedded view requests sign-in | Sign in from Settings, then reopen or retry the embedded view. |
| Answers access is denied | Check Answers Entitlement and Assistant permissions with the Tenant administrator. |
| App is locked | Select **Unlock** and complete device authentication. |
| Standalone APK requests Metro | Verify that you installed the standalone Release APK rather than a development-client build. |
| Android reports `INSTALL_FAILED_UPDATE_INCOMPATIBLE` | The installed app uses a different signing identity. Ask the maintainer for an update or migration plan. |
| Jest reports duplicate modules or unrelated worktree failures | Use `npx jest --runInBand --roots ./src`. Jest otherwise scans local agent worktrees. |
| Metro serves stale output | Restart with `npx expo start --clear` and the required `--go` or `--dev-client` option. |

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
- Side-panel gestures, the Assistant form sheet, and the press animations still require physical-device acceptance for this beta.
- History loads up to 100 pinned Threads in its separate pinned query. Further pinned Threads appear when their regular History page loads.
- Web shows no Apps search field, because the native search bar is iOS and Android only. Web also cannot delete a Thread, because `Alert` does not show on web.
- The app is online only. It has no offline content, alerts, or push notifications.
- Brand files are hosted on a personal GitHub Pages site for the beta. They must move with the Client ID Metadata Document (#55).

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
