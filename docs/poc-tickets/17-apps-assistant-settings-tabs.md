# 17 — Add Apps · Assistant · Settings bottom tabs

**What to build:** The native bottom-tab shell for Analytics Apps, the Assistant and Settings, replacing the current header navigation while keeping native classic chat usable until its replacement ships.

**Blocked by:** Ticket [16](16-agentic-assistant-tenant-configuration.md) (code merged; its native delivery evidence is still open and does not gate this ticket). It does not wait on ticket [15](15-record-embedded-auth-spike-outcome.md): the tab shell is needed under every auth path.

**Status:** in-progress — code in place; device walkthrough and release-build sign-in check still open

- [ ] Native builds have bottom tabs labelled Apps · Assistant · Settings; Apps has a landing route ready for ticket 18, and Settings retains configuration and sign-in/sign-out access
  - Implemented with SDK 57's native tabs (`expo-router/unstable-native-tabs`: native system tab bar on iOS/Android, `sf`/`md` icons, no new dependency). The `unstable-` path is SDK 57's documented one and becomes `native-tabs` in SDK 58. Open: not yet seen on a device; verified so far by typecheck and a web export that renders every route
- [ ] Sign-in/sign-out remains reachable in release builds with managed configuration; it must not depend on the internal-only development configuration form
  - Implemented: Settings now renders the sign-in section for a managed configuration without the development form (`ManagedSettings`). Open: not exercised on a release build or with real MDM configuration
- [x] Until ticket 21 replaces it, the Assistant area contains the existing native classic-chat entry and History/Thread routes; History is reached from Assistant rather than a global header action
  - Assistant is its own stack (`assistant`, `assistant/history`, `assistant/thread/[id]`); History is a header action inside Assistant, no longer global
- [x] Record how the classic entry remains reachable during this transition when `agenticAssistantId` is absent. The final shell hides the Assistant tab without that identifier; do not remove the working classic entry before its replacement is validated
  - Recorded: in this ticket the Assistant tab is always visible and always contains the classic chat, whether or not `agenticAssistantId` is set, so nothing becomes unreachable. Ticket 21 introduces hiding the tab, and must keep classic chat reachable until ticket 22 (native tabs `hidden` remounts the navigator when it changes)
- [ ] Nested Thread and Analytics App navigation preserves the expected active tab and Back behaviour; auth/configuration guidance still leaves Settings reachable
  - Thread now lives inside the Assistant stack, so opening one from History keeps Assistant selected. Open: Back behaviour not yet walked through on a device; no Analytics App route exists yet
- [x] The root providers, lock gate, app-wide screen-capture protection, font loading and splash behaviour remain in force
- [x] Routes remain under `src/app/`; remove only header-navigation code replaced by the tabs. Use existing theme values and provide accessible tab labels
  - The header navigation is gone from the root layout; the internal-only Agentic spike link moved to Settings so it stays reachable in internal builds. The OAuth redirect (`+native-intent`) now returns to `/settings`, where sign-in starts, instead of the first tab
- [x] The web target stays a fixtures-only development preview; native WebView destinations and real Qlik authentication are hidden and guarded on direct entry
- [x] Consult [Expo SDK 57 Router documentation](https://docs.expo.dev/versions/v57.0.0/sdk/router/) before selecting the tab implementation. After changing routes, briefly run `npx expo start` to regenerate `.expo/types/router.d.ts`; keep generated files ignored
- [ ] Evidence: device walkthrough of all tabs, nested Back navigation, transitional classic History and Settings access; `npm run lint`, `npx tsc --noEmit`, `npm test` pass, and `graphify update .` completes
  - Done so far: `npx tsc --noEmit`, `npm run lint`, a clean web export of all routes. Open: the device walkthrough and `graphify update .` after the final change

References: [CONTEXT.md](../../CONTEXT.md), [ADR-0005](../adr/0005-native-only-qlik-integration.md), [development-build runbook](../dev-build-runbook.md).
