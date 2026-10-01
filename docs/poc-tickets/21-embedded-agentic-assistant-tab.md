# 21 — Open the Agentic Assistant from the Assistant tab

**What to build:** The Assistant tab opens the configured Agentic Assistant in the shared native host, replacing its entry surface only after device validation. Native classic chat remains available during validation and is retired separately in ticket 22.

**Blocked by:** Tickets [15](15-record-embedded-auth-spike-outcome.md), [16](16-agentic-assistant-tenant-configuration.md), [17](17-apps-assistant-settings-tabs.md), [19](19-reusable-embedded-qlik-host.md) and [24](24-harden-embedded-host-navigation-storage-signout.md); Tenant-side agentic prerequisites from research §10.

**Status:** blocked

- [ ] The normal embed path uses `ui="ai/agentic-assistant"` and `assistant-id` from resolved `agenticAssistantId`; it never substitutes the classic `assistantId`
- [ ] If ticket 15 accepted Qlik web pages, use its proven Agentic Assistant URL through the same host rather than reintroducing an unproven embed-auth path
- [ ] The final Assistant tab is absent when `agenticAssistantId` is missing; direct native entry is guarded too. Apps and Settings remain usable
- [ ] Replacing the tab entry follows ticket 17's transition plan so the working native classic surface is retained until the embedded Agentic Assistant is validated; do not delete tickets 06–11's implementation here
- [ ] With cross-region inference opt-in, Answers Entitlement, Agentic AI permissions and the selected auth prerequisites in place, a Qlik User can ask about an Analytics App and a Knowledge Base and see Qlik-rendered Answers and Citations
- [ ] Verify the embedded Thread/history behaviour needed after native History retires. Do not present classic REST Threads as Agentic Assistant Threads or build against the abandoned `cloud-assistants` contract
- [ ] Missing access/entitlement, invalid Assistant configuration, unavailable service, offline and session expiry are demonstrable with actionable guidance where the runtime exposes enough information; record observed signals instead of assuming HTTP statuses
- [ ] Singapore's unavailable Data product, Glossary and Data quality contexts are recorded as Tenant limits, not application defects; do not promise them as working capabilities
- [ ] A session of at least 20 minutes with several questions stays signed in, including past the runtime's token exchange (the spike saw it 1.5–4 minutes after chat activity), on physical iOS and Android devices; the spike's emulator-only result is not accepted as device evidence
- [ ] The host enforces shared navigation, expiry, sign-out and no-content-on-disk rules (ticket 24). The web preview neither exposes this WebView screen nor connects to the Tenant
- [ ] Evidence: Agentic Assistant walkthroughs on physical iOS/Android development builds covering Knowledge Base and Analytics App questions, Citations, Thread history, hidden/direct-entry behaviour and sign-out. `npm run lint`, `npx tsc --noEmit`, `npm test` pass; refresh typed routes if changed and run `graphify update .`

References: [research §10](../research-integration-gaps.md#10-agentic-path--any-supported-route-today), [qlik-embed parameters](https://qlik.dev/embed/qlik-embed/parameters/), [ADR-0007](../adr/0007-no-answer-content-on-device.md).
