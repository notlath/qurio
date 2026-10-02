# 22 — Retire native classic chat and decide ADR-0006's scope

**What to build:** Remove the native classic Assistant implementation after the embedded Agentic Assistant ships, with an ADR explaining which domain/port boundaries remain for the native Analytics App list.

**Blocked by:** Tickets [15](15-record-embedded-auth-spike-outcome.md) and [21](21-embedded-agentic-assistant-tab.md). It does not wait on ticket [20](20-open-analytics-app-sheets.md), whose Analytics App embed is unproven. Ticket 21 must have shipped and passed device acceptance, including Knowledge Base Answers, Citations and Thread history, before retirement starts.

**Status:** blocked

- [ ] Write an ADR for the retirement before deleting tested work. State that Qlik now owns embedded rendering and that native screens still consume domain types for REST lists
- [ ] Decide whether ADR-0006 is amended to cover surviving native REST surfaces or superseded by a narrower decision; link the resulting record from ADR-0006. Do not delete the Analytics App port/domain type introduced by ticket 18
- [ ] Inventory the routes, classic adapter, streaming, Thread/history, Starters, Feedback, Answer/Citation rendering, fixtures, tests and provider methods belonging to tickets 06–11. Remove only code made obsolete by retirement, retaining shared transport/auth/configuration/theme/error utilities needed by Analytics Apps and the host
- [ ] Remove native classic-chat entry points and obsolete deep links; only Qlik-owned Agentic Assistant history remains under Assistant. Record how old classic Threads are accessed outside this app if the embedded surface cannot show them; no speculative migration is added
- [ ] Decide and implement the final Tenant Configuration completeness rules: classic `assistantId` no longer blocks Apps-only use, `agenticAssistantId` stays optional, and managed configuration precedence cannot fall through to a different development Tenant merely because a retired field is absent
- [ ] Update affected MDM schema, development Settings validation and onboarding guidance for the retired field, preserving compatibility with old payloads where harmless
- [ ] Preserve meaningful tests for surviving REST/auth/host behaviour; remove tests and fixtures only when their sole implementation was deliberately retired. Keep historical ticket/evidence documents and mark tickets 06–11 as retired with a pointer to this decision rather than erasing their history
- [ ] The fixtures-only web preview still works for surviving native surfaces and cannot import live Qlik auth or WebView code
- [ ] Evidence: Apps list, Agentic Assistant → Answer/Citations/history, Apps-only configuration and Settings/sign-out work after cleanup. `npm run lint`, `npx tsc --noEmit`, `npm test` pass; regenerate typed routes if changed and run `graphify update .`

References: [ADR-0006](../adr/0006-domain-port-with-qlik-adapter.md), [CONTEXT.md](../../CONTEXT.md), [ADR-0005](../adr/0005-native-only-qlik-integration.md), [ADR-0007](../adr/0007-no-answer-content-on-device.md).
