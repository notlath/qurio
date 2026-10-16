# Qurio client presentation: briefing pack

Prepared 2026-10-17 from branch `feature/gemini-integration` (commit `ab22d74`). Evidence comes from the source code, ADRs, tickets, and `docs/research-qlik-analytics-comparison.md` (Qlik facts read 2026-10-15).

Contents:

1. [Run instructions](#1-run-instructions)
2. [Codebase analysis summary](#2-codebase-analysis-summary)
3. [Feature verification matrix](#3-feature-verification-matrix)
4. [Security summary](#4-security-summary)
5. [Live demo script](#5-live-demo-script)
6. [Assumptions and open questions](#6-assumptions-and-open-questions)

Presenter notes for each slide are inside the deck. Press **P** for the presenter window, or open `index.html?notes` for a printable handout.

## 1. Run instructions

The deck is one HTML file. It has no dependencies, no build step, and no network calls. Fonts, the logo, and screenshots are in this folder.

Open it in Chrome or Edge:

```bash
start presentation/index.html
```

On macOS, use `open presentation/index.html`.

| Key | Action |
| --- | --- |
| `→` `Space` `PgDn` / `←` `PgUp` | Next / previous slide |
| `Home` / `End` | First / last slide |
| `F` | Fullscreen |
| `P` | Presenter window: current and next slide, notes, timer with pace against the 60-minute plan |
| `N` | Notes drawer in the audience window (for rehearsal on one screen) |
| `O` | Overview of all slides |
| `T` | Switch light and dark theme |
| `?` | Keyboard help |

For two screens: open the deck, press **P**, drag the presenter window to the laptop screen, then press **F** in the audience window on the projector. Arrow keys work in both windows. The windows stay in sync.

Printable notes: add `?notes` to the URL (for example `index.html?notes`), then print.

To capture new app screenshots, start the web preview (`npx expo start --web --port 8082`). The web preview uses sample data only.

## 2. Codebase analysis summary

**What the app is.** Qurio (project `QlikAnswersApp`) is a native iOS and Android app for Qlik Cloud by MTC. It opens on a Qlik Answers Assistant. A side panel holds New chat, Apps, History, and the Profile with Settings (ADR-0011). Analytics Apps are listed natively and open in Qlik's own embedded view.

**Technology.** Expo SDK 57, React Native 0.86.3, React 19.2.3, Expo Router (typed routes), TypeScript strict, React Compiler, `react-native-webview` 13.16.1, Jest with `jest-expo`, ESLint. CI runs lint, type check, and tests (`.github/workflows/ci.yml`).

**Architecture.**

- No backend (ADR-0001). The phone talks directly to the client's Qlik Cloud Tenant.
- Screens use MTC's own domain types (`src/domain/`). The Qlik adapter (`src/qlik/adapter.ts`, `src/qlik/classic/`) maps Qlik REST JSON to those types (ADR-0006). Web builds use a fixture adapter and never reach Qlik (ADR-0005).
- Sign-in: OAuth 2.0 authorization code with PKCE, public Native client, redirect `qlikanswers://auth`, scopes `user_default offline_access` (`src/auth/`). MTC publishes one client per Qlik region: `ap` and `sg` today (ADR-0010, `src/config/resolver.ts`).
- Embedded Qlik content: a WebView loads `@qlik/embed-web-components@1` from jsDelivr. A token bridge feeds the person's own token to the runtime (`src/qlik-embed/`, ADR-0009). This is a workaround with no Qlik contract.

**Qlik integration points.**

| Purpose | Mechanism | Owner |
| --- | --- | --- |
| Sign-in, refresh, revoke | `/oauth/authorize`, `/oauth/token`, `/oauth/revoke` via `expo-auth-session` | MTC client, Qlik endpoints |
| Tenant check before sign-in | `GET /.well-known/oauth-authorization-server` (`src/config/preflight.ts`) | MTC |
| Assistants list | `GET /api/v1/assistants` (all pages) | Qlik API |
| Threads, Interactions, Feedback, Starters | `/api/v1/assistants/<id>/threads/...` | Qlik API |
| Streamed Answers | `POST .../threads/<id>/actions/stream`, parsed by `src/qlik/classic/stream-parser.ts` | MTC parser, Qlik API |
| Rename and pin a Thread | `PATCH /threads/<id>` JSON Patch on `/name` and `/favorite` | Qlik API |
| Analytics Apps list | `GET /api/v1/items?resourceType=app` with `name=` search | Qlik API |
| App thumbnails | `GET /api/v1/apps/<id>/media/thumbnail` (marked unverified live) | Qlik API |
| Profile | `GET /api/v1/users/me` (redirect followed with the token) | Qlik API |
| Agentic Assistant | `qlik-embed ui="ai/agentic-assistant"` in a WebView | Qlik UI, MTC host |
| Analytics App viewer | `qlik-embed ui="classic/app"` and a native WebSocket token exchange | Qlik UI, MTC host |

**Errors and loading.** HTTP and network failures map to domain errors (`src/domain/errors.ts`): Offline, SessionExpired, RateLimited (with `Retry-After`, default 60 s), ServiceUnavailable, NotEntitled, AssistantForbidden, AccessDenied, TenantApprovalRequired (`OAUTH-28`), and others. Each has a title, message, and retry flag (`src/domain/error-messages.ts`). The embedded host shows native guidance after a load failure, a blocked navigation, a missing token, or 20 seconds with no token request.

**State.** React state and hooks (`use-thread-conversation`, `use-thread-history`). No global store. Answers and Threads are not persisted (ADR-0007). Preferences use AsyncStorage.

**Deployment.** EAS `development` profile with internal distribution (`eas.json`). The repository has no production build profile or store release. iOS works in Expo Go for native chat. Android needs a development build.

**Note on the README.** `README.md` still describes three tabs. The code on this branch uses the side panel from ADR-0011. The deck follows the code.

## 3. Feature verification matrix

Status key: **Implemented** = in the code with tests or recorded evidence. **Implemented, sign-off pending** = in the code, GitHub issue labelled `ready-for-human` for device sign-off. **PoC** = in the code, proof of concept, limited device evidence. **Planned** = in a ticket or ADR only. **Unverified** = cannot be confirmed from the repository.

| Feature | Status | Evidence |
| --- | --- | --- |
| Hostname-only Tenant entry and preflight | Implemented | `src/components/tenant-entry.tsx`, `src/config/preflight.ts`, ADR-0010 |
| Published OAuth client per region (`ap`, `sg`) | Implemented | `src/config/resolver.ts`. Production clients: GitHub issue 8 (open) |
| OAuth PKCE sign-in, silent refresh, sign-out with revoke | Implemented | `src/auth/session.ts`, `src/auth/access-token.ts`, `docs/auth-verification-runbook.md` |
| Tenant Approval required message (`OAUTH-28`) | Implemented | `src/auth/session.ts`, `src/domain/error-messages.ts` |
| Change Tenant | Implemented | `src/app/settings/change-tenant.tsx` |
| Profile (name, email, picture) | Implemented | `getCurrentUser` in `src/qlik/adapter.ts`, `src/components/sign-in-section.tsx` |
| Assistant chooser (Legacy and Agentic groups) | Implemented | `src/components/assistant-switcher.tsx`, `src/app/(drawer)/assistant/choose.tsx` |
| Legacy Assistant chat with streaming | Implemented | `src/qlik/classic/stream-session.ts`, `src/hooks/use-thread-conversation.ts` |
| Stop a streaming Answer | Implemented | `AskHandlers.signal` in `src/qlik/port.ts`, ticket 07 notes |
| Citations (document name and excerpt, no link) | Implemented | `src/components/interaction-row.tsx` |
| Feedback with reason and comment | Implemented | `src/components/interaction-row.tsx`, `submitFeedback` |
| Starters | Implemented, live shape unverified | `listStarters` is marked `[POC] Shape unverified` in `src/qlik/adapter.ts` |
| Answer rendering subset (markdown, lists, tables) | Implemented | `src/components/answer-markdown.ts`, ticket 10 catalogue |
| Side panel navigation, opens on Assistant | Implemented, sign-off pending | ADR-0011, `src/components/side-panel.tsx`, issues 31–33 |
| History: open a Thread as the current chat | Implemented, sign-off pending | Issue 34 |
| History: delete (long press, confirm) | Implemented, sign-off pending | Issue 35, `src/components/confirm-delete-thread.ts` |
| History: rename | Implemented, sign-off pending | Issue 39, `src/components/rename-thread-dialog.tsx` |
| History: pin (Qlik `favorite` flag) | Implemented, review fixes merged | Issue 41, commits `15a1458`, `9b2d6ec`, fixture `docs/poc-tickets/fixtures/40-favorite-patch` |
| Name a new Thread after its first question | Implemented, sign-off pending | Issue 38 |
| Agentic Assistant note in the panel | Implemented, sign-off pending | Issue 36 |
| Tablet layout (docked panel at 768 pt and wider, rotation) | Implemented, sign-off pending | Issue 37, `src/components/side-panel-layout.tsx` |
| Analytics Apps list: search, list/grid, paging, pull to refresh | Implemented | `src/app/(drawer)/apps/index.tsx`, ticket 18 |
| App thumbnails | Implemented, endpoint unverified live | `thumbnailImage` comment in `src/qlik/adapter.ts` |
| Analytics App viewer (embedded `classic/app`) | PoC | `src/app/(drawer)/apps/[id].tsx`, ticket 20, ADR-0009 addendum |
| Sheet browsing on a phone | Planned | Ticket 20 acceptance criteria (open) |
| Agentic Assistant (embedded `ai/agentic-assistant`) | PoC | `src/app/(drawer)/assistant/agentic.tsx`, ticket 21 (Android emulator evidence) |
| Privacy lock (device authentication, timeout) | Implemented | `src/components/lock-gate.tsx`, `src/auth/biometric-gate.ts` |
| Screenshot and recording protection | Implemented | `src/config/screen-capture.ts` |
| Managed configuration (iOS AppConfig, Android restrictions) | Implemented, real-MDM test not recorded | `src/config/managed.ts`, `modules/managed-config/`, ticket 14 |
| Error states with retry guidance | Implemented | `src/domain/error-messages.ts`, `src/components/error-state.tsx` |
| Retire native Legacy chat | Planned, blocked | Ticket 22 |
| Embedded host hardening | Planned, blocked | Ticket 24 |
| Offline content, alerts, push notifications | Not planned | ADR-0007, README known limitations |
| Gemini Enterprise or Qlik MCP integration | Research only | `docs/research-gemini-enterprise-mcp-integration.md` recommends not building now |
| iOS device acceptance of embedded views | Unverified | ADR-0009, tickets 19–21 |

## 4. Security summary

### Verified controls (in the code)

| Control | Implementation |
| --- | --- |
| Per-person authentication | OAuth 2.0 authorization code with PKCE, public Native client, no client secret (`src/auth/session.ts`). No shared service account (ADR-0001). |
| Access token storage | Memory only (`src/auth/access-token.ts`). |
| Refresh token storage | `expo-secure-store` with `WHEN_UNLOCKED_THIS_DEVICE_ONLY` (`src/auth/tokens.ts`). |
| Token refresh | Before each request, 60-second margin. Concurrent requests share one refresh, because Qlik rotates refresh tokens. |
| Sign-out | Revokes the access and refresh tokens at Qlik, then clears local tokens even if revocation fails. Asks for confirmation. |
| Token destination | `qlikUrl` sends the bearer token only to the configured Tenant. Off-Tenant pagination links are refused (`src/qlik/classic/http.ts`). |
| Data at rest | No Answer, Citation, or Thread content is written to storage (ADR-0007). The embedded WebView runs `incognito` with `cacheEnabled={false}`. |
| Device protection | Privacy lock on by default, default 5-minute background timeout, configurable by MDM. Release builds always request screenshot and recording protection. |
| Embedded host | Messages carry a per-session ID. Replies for an ended session are dropped. Top-frame navigation away from the host page ends the session with native guidance. WebView debugging only in development builds. Traces remove query strings and do not log tokens. |
| Web build | Fixtures only. Cannot reach Qlik (ADR-0005). |
| Secrets in the repository | `.env` files are ignored. `.env.example` holds names only. The app does not read `QLIK_API_KEY`. |

### Responsibility boundaries

| Area | Qlik | MTC app | Client |
| --- | --- | --- | --- |
| Identity, login, identity provider | Yes | Opens the OS sign-in sheet | Configures the identity provider |
| Approval of the app | Enforces it | Shows a clear message | Tenant admin approves once |
| Answers Entitlement, space and Knowledge Base access | Enforces per person | Shows the error | Assigns access |
| Rate limits | Enforces (20 questions per minute per subscription, per technical proposal §14) | Shows a retry delay | — |
| Tokens and data on the device | — | Yes | MDM policy, if used |

### Outstanding concerns

1. Ticket 24 is open. Navigation containment, embedded runtime storage (local storage, IndexedDB, service workers), and teardown of an already-mounted embedded view at sign-out are not verified. Earlier Android evidence showed a missed login redirect.
2. The token bridge depends on Qlik runtime behaviour. Qlik can change it without notice. The page holds the access token in JavaScript memory for the session.
3. `@qlik/embed-web-components@1` loads from jsDelivr at major version 1, not pinned to a release.
4. The runtime wrapper adds the bearer token to `fetch` only. It does not cover all XHR or WebSocket traffic.
5. Embedded-view evidence comes from an Android emulator and development builds. iOS and physical-device acceptance are not established.
6. GitHub issue 24: high npm audit findings in build-time dependencies, waiting on upstream patches.
7. HTTP 403 on Assistant calls maps to "No Answers access". The app cannot tell a missing entitlement from denied Assistant access.
8. No production build profile, penetration test, or compliance review is recorded. Do not present the app as production-ready.

## 5. Live demo script

Total: 18 minutes. The order matches the numbers on slide 5.

### Preparation (the day before)

- [ ] Tenant admin approval of the published client is done on the demo Tenant.
- [ ] The demo Qlik User has the Answers Entitlement and space access to at least one Legacy Assistant, its Knowledge Bases (indexed), one Agentic Assistant, and two or three Analytics Apps.
- [ ] Device: Android development build for the embedded views. iOS (Expo Go or development build) is acceptable for native chat only.
- [ ] Rehearse every question below on this Tenant. Write down the Answers you get. Never promise an Answer you have not seen.
- [ ] Record a screen capture of the full walkthrough as a fallback.
- [ ] On the day: device charged, signed in, Do Not Disturb on, screen mirroring tested, Wi-Fi and a mobile hotspot available.

### Sequence

| # | Min | Action | Expected behaviour | Say |
| --- | --- | --- | --- | --- |
| 1 | 1 | Cold-start the app. Select **Unlock**. | "Your workspace is locked." Device authentication prompt. App opens on the Assistant. | "The app locks by default. Unlocking uses the phone's own biometrics." |
| 1b | (opt.) | On a second, signed-out device: type the Tenant hostname, **Continue**, **Sign in**. | Hostname check, then Qlik's own login page in the OS sign-in sheet. | "People type only the hostname. Qlik handles the login." |
| 2 | 1 | Tap the Assistant name in the header. | Sheet with Legacy and Agentic Assistant groups. Pick the Legacy Assistant. | "People choose the Assistant for each conversation." |
| 3 | 5 | Tap a Starter. Then ask 2–3 rehearsed questions. Tap **Stop** once mid-Answer. Open **sources**. Give a thumbs-down with a reason. | Text streams in. Stop keeps the partial Answer. Sources list document names and excerpts. Feedback is accepted. | "Every Answer shows where it came from. Feedback goes back to Qlik." |
| 4 | 2 | Open the side panel. Reopen an earlier Thread. Rename one. Pin one. Long-press to delete and cancel. | History for the selected Assistant. Pinned group at the top. Delete asks for confirmation. | "Conversations live in Qlik, not on the phone. A pin shows on every device." |
| 5 | 3 | **Apps** in the panel. Search part of a name. Switch to grid. Open one app. | Filtered list. Grid view. Qlik's embedded app view loads. | "This viewer is a proof of concept. It shows Qlik's own interface, signed in as you." |
| 6 | 3 | Choose the Agentic Assistant. Ask one rehearsed question about an Analytics App. | Qlik's agentic UI loads without a second sign-in. Answer with Qlik's own rendering. | "Also a proof of concept. This is Qlik's agentic interface inside our app." |
| 7 | 1 | Open Settings from the Profile gear. Show the privacy lock switch. Select **Sign out** and cancel. | Profile details, lock switch, sign-out confirmation. | "Sign-out revokes the tokens at Qlik, not only on the phone." |
| 8 | 2 | Turn on airplane mode. Ask a question. Turn it off. Select **Retry**. | "You're offline. Check your internet connection and try again." with **Retry** and **Dismiss**. Retry works. | "Failures say what happened and what to do next." |

### Question templates

Replace these with questions you rehearsed on the demo Tenant:

- "What does our [policy] say about [topic]?"
- "Summarize the main points of [document]."
- "What changed in [document or process] this year?"
- Agentic: "Which [region or product] had the highest [measure] last quarter?"

### Fallback plan

1. The Qlik service or network fails: name it calmly ("this depends on a live connection to Qlik"), then play the recorded walkthrough.
2. Only an embedded view fails: say it is a proof of concept, select **Try again** once, then move on.
3. No device or recording: run the web preview (`npx expo start --web`) and say it uses sample data. It shows the chat, History, and Apps layouts only. It does not show sign-in or embedded Qlik views.

## 6. Assumptions and open questions

- **No `DESIGN.md` exists in the repository.** The only file with that name is a third-party skill under `.agents/`. The deck uses the app's own design system instead: colours, radii, motion durations, and elevation from `src/constants/theme.ts`, and the Plus Jakarta Sans font from `src/app/_layout.tsx`. Radii use the app's iOS values. Status chips use only existing tokens (no new colours).
- **Screenshots** come from the app's web preview with built-in sample data, captured at 390 × 844. They show real app screens, not mock-ups. The deck labels them as sample data. Live Qlik content appears only in the demo.
- **Presenter name and client name** are not in the repository. The deck says "Analytics Integration Developer · MTC".
- **Business value** is stated qualitatively. The repository has no usage, performance, or cost metrics. The deck shows none.
- **Qlik Analytics facts** come from public materials read 2026-10-15. A hands-on check of Qlik Analytics 1.179.14 on an Answers-enabled Tenant was not done.
- **Next steps** after "feedback" and "prioritize" are proposals. No project document commits them.
