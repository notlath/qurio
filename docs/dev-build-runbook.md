# Development build — setup, build and install

Covers [docs/poc-tickets/03-dev-build-custom-scheme.md](poc-tickets/03-dev-build-custom-scheme.md). Run this from a machine that actually has the tooling below — the environment this was written in (Windows, no Android SDK, no Xcode) has none of it, so nothing past "One-time setup" has been executed or verified yet. See **Status** at the bottom for exactly what that means for the ticket's checklist.

## Why not Expo Go

Expo Go is Qlik's own shell app: it only opens its own `exp://` links, so it structurally cannot open this app's `qlikanswers://auth` redirect — there is no way to register a custom scheme inside Expo Go. Beyond the scheme, every one of these also needs native code Expo Go doesn't bundle:

- `expo-secure-store` (token storage, ADR — §3.2 of the technical proposal)
- `expo-screen-capture` (screenshot/recording block, §9)
- The local Expo module for Android managed configuration (§4)
- Custom URL scheme handling itself

Once any one of these lands, Expo Go can't run the app at all. **Do not add Expo Go back into the workflow** — use a development build (this doc) from here on. `expo-dev-client` is now a project dependency for exactly this reason.

## Prerequisites (external — not provided by this repo)

- An [EAS](https://expo.dev) account with access to this project
- Apple Developer Program membership (for iOS device builds — provisioning profiles, TestFlight)
- An Android device with USB debugging enabled, or a way to sideload an `.apk` (no Play Console access needed for internal dev builds)
- `eas-cli`: `npm install -g eas-cli` (or `npx eas-cli`)
- **Windows, local Android builds:** a short project path with no spaces, e.g. `C:\dev\QlikAnswersApp`. The ninja shipped with the SDK's CMake 3.22.1 is not long-path aware and joins paths without collapsing `..`, so from a deep path it cannot see `react-native-workletsConfigVersion.cmake` under `expo-modules-core`'s `.cxx` dir and fails with `ninja: error: manifest 'build.ninja' still dirty after 100 tries`. Enabling `LongPathsEnabled` does not help. After moving, delete all native build output — `android/.gradle`, `android/build`, `android/app/build`, `android/app/.cxx`, and every `android/build` and `android/.cxx` under `node_modules` and `modules` — not just `.cxx`: Gradle's cached prefab publications in `android/app/build` keep pointing native libraries at the old folder, so the build silently compiles them there.

## One-time setup

```bash
eas login
eas init
```

`eas init` links this repo to an EAS project and writes `extra.eas.projectId` into `app.json` — that id is not committed yet because it doesn't exist until someone with EAS access runs this.

`eas.json` (already committed) defines the `development` build profile: `developmentClient: true` bundles `expo-dev-client`; `distribution: "internal"` produces a build installable directly on a registered device, not gated behind store review.

## Building

```bash
# iOS — requires an Apple Developer account; eas-cli walks through device
# registration and provisioning-profile creation on first run
eas build -p ios --profile development

# Android — no paid account required for an internal build
eas build -p android --profile development
```

Both run in EAS's cloud by default. `--local` builds on your own machine instead (iOS `--local` still requires a Mac with Xcode; Android `--local` needs the Android SDK + Java installed locally) — see the `expo-dev-client` skill for the local-build flags if cloud minutes are a concern.

## Installing on a device

- **iOS**: `eas build:run -p ios` installs directly on a connected/registered device, or download the `.ipa` link EAS emails you and install via Xcode's Devices window.
- **Android**: download the `.apk` link EAS emails you and open it on the device (or `adb install path/to/build.apk` over USB).

## Testing the custom scheme

Once the dev client is installed:

1. Cold start: fully close the app, then open `qlikanswers://auth` from another app (Notes, a browser address bar, an SMS link) and confirm the dev client launches to it.
2. Background: open the dev client, send it to the background (don't kill it), then open `qlikanswers://auth` again and confirm it resumes into the app rather than launching a second instance or doing nothing.

Do this on both a physical iOS device and a physical Android device — a simulator/emulator can't stand in for the "installs and runs on a physical device" checklist item, and in this project's case there wasn't one available either way.

## Connecting to Metro

```bash
npx expo start
```

With `expo-dev-client` installed, the CLI targets the installed dev client automatically (no more Expo Go QR flow) — scan the QR from the dev client's launcher screen, or paste the URL in.

## Status against the ticket 3 checklist

| Checklist item | Status |
|---|---|
| Development build installs and runs on a physical iOS device and a physical Android device | **Blocked** — no EAS account, no Apple Developer access, no physical devices available in this environment. Steps above are ready to run once someone has both. |
| `qlikanswers://auth` opens the app from cold start and from background, on both platforms | **Blocked**, same reason — also fixed a real bug found while preparing this: `app.json`'s `scheme` was `qlikanswersapp`, not `qlikanswers`, which would have made the documented redirect URI (technical-proposal.md:554) wrong on every platform. Corrected before this could bite during onboarding. |
| Build and install steps documented well enough to reproduce without help | Done — this document. |
| Expo Go no longer part of the workflow, reason written down | Done — see "Why not Expo Go" above, plus a pointer in [AGENTS.md](../AGENTS.md). |
