# 17 — Add Apps · Assistant · Settings bottom tabs

**What to build:** The native bottom-tab shell for Analytics Apps, the Assistant and Settings, replacing the current header navigation while keeping native classic chat usable until its replacement ships.

**Blocked by:** Ticket [16](16-agentic-assistant-tenant-configuration.md). It does not wait on ticket [15](15-record-embedded-auth-spike-outcome.md): the tab shell is needed under every auth path.

**Status:** blocked

- [ ] Native builds have bottom tabs labelled Apps · Assistant · Settings; Apps has a landing route ready for ticket 18, and Settings retains configuration and sign-in/sign-out access
- [ ] Sign-in/sign-out remains reachable in release builds with managed configuration; it must not depend on the internal-only development configuration form
- [ ] Until ticket 21 replaces it, the Assistant area contains the existing native classic-chat entry and History/Thread routes; History is reached from Assistant rather than a global header action
- [ ] Record how the classic entry remains reachable during this transition when `agenticAssistantId` is absent. The final shell hides the Assistant tab without that identifier; do not remove the working classic entry before its replacement is validated
- [ ] Nested Thread and Analytics App navigation preserves the expected active tab and Back behaviour; auth/configuration guidance still leaves Settings reachable
- [ ] The root providers, lock gate, app-wide screen-capture protection, font loading and splash behaviour remain in force
- [ ] Routes remain under `src/app/`; remove only header-navigation code replaced by the tabs. Use existing theme values and provide accessible tab labels
- [ ] The web target stays a fixtures-only development preview; native WebView destinations and real Qlik authentication are hidden and guarded on direct entry
- [ ] Consult [Expo SDK 57 Router documentation](https://docs.expo.dev/versions/v57.0.0/sdk/router/) before selecting the tab implementation. After changing routes, briefly run `npx expo start` to regenerate `.expo/types/router.d.ts`; keep generated files ignored
- [ ] Evidence: device walkthrough of all tabs, nested Back navigation, transitional classic History and Settings access; `npm run lint`, `npx tsc --noEmit`, `npm test` pass, and `graphify update .` completes

References: [CONTEXT.md](../../CONTEXT.md), [ADR-0005](../adr/0005-native-only-qlik-integration.md), [development-build runbook](../dev-build-runbook.md).
