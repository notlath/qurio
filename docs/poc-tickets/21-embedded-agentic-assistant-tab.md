# 21 — Open the Agentic Assistant from the Assistant tab

**What to build:** The Assistant tab opens the configured Agentic Assistant in the shared native host, replacing its entry surface only after device validation. Native classic chat remains available during validation and is retired separately in ticket 22.

**Blocked by:** Tickets [15](15-record-embedded-auth-spike-outcome.md), [16](16-agentic-assistant-tenant-configuration.md), [17](17-apps-assistant-settings-tabs.md), [19](19-reusable-embedded-qlik-host.md) and [24](24-harden-embedded-host-navigation-storage-signout.md); Tenant-side agentic prerequisites from research §10.

**Status:** in-progress — Agentic Assistant mounted as an additional, guarded entry in the Assistant tab so it can be device-validated; nothing is replaced or hidden yet, and ticket 24's hardening is not done

**Progress 2026-10-02.** `assistant/agentic` opens the shared host (ticket 19) with `agenticTargetFor(config)`, which uses only `agenticAssistantId` and never the classic `assistantId`. The Assistant screen shows an "Open the Agentic Assistant" entry only when that id is configured on native; the route itself redirects to classic chat on direct entry when it is not (and on web). Classic chat, History and Thread are untouched. iOS device validation is still to do (no Apple Developer account or Xcode machine yet); validation runs Android-first on a physical phone and the iOS criteria stay open until an iOS run exists. Still to do: device validation (walkthroughs, 20-minute session past the token exchange, Thread/history behaviour, error signals, Singapore limits), ticket 24's rules, then hiding the tab when the id is missing and replacing the entry — which waits for validation and keeps classic reachable until ticket 22.

- [x] The normal embed path uses `ui="ai/agentic-assistant"` and `assistant-id` from resolved `agenticAssistantId`; it never substitutes the classic `assistantId`
- [ ] If ticket 15 accepted Qlik web pages, use its proven Agentic Assistant URL through the same host rather than reintroducing an unproven embed-auth path
- [ ] The final Assistant tab is absent when `agenticAssistantId` is missing; direct native entry is guarded too. Apps and Settings remain usable
- [x] Replacing the tab entry follows ticket 17's transition plan so the working native classic surface is retained until the embedded Agentic Assistant is validated; do not delete tickets 06–11's implementation here
- [ ] With cross-region inference opt-in, Answers Entitlement, Agentic AI permissions and the selected auth prerequisites in place, a Qlik User can ask about an Analytics App and a Knowledge Base and see Qlik-rendered Answers and Citations
- [x] Verify the embedded Thread/history behaviour needed after native History retires. Do not present classic REST Threads as Agentic Assistant Threads or build against the abandoned `cloud-assistants` contract
  - Observed on an Android emulator: Qlik's own history control inside the embed lists the user's Agentic conversations; reopening starts a fresh chat. See Evidence below
- [ ] Missing access/entitlement, invalid Assistant configuration, unavailable service, offline and session expiry are demonstrable with actionable guidance where the runtime exposes enough information; record observed signals instead of assuming HTTP statuses
- [ ] Singapore's unavailable Data product, Glossary and Data quality contexts are recorded as Tenant limits, not application defects; do not promise them as working capabilities
- [ ] A session of at least 20 minutes with several questions stays signed in, including past the runtime's token exchange (the spike saw it 1.5–4 minutes after chat activity), on physical iOS and Android devices; the spike's emulator-only result is not accepted as device evidence
- [ ] The host enforces shared navigation, expiry, sign-out and no-content-on-disk rules (ticket 24). The web preview neither exposes this WebView screen nor connects to the Tenant
- [ ] Evidence: Agentic Assistant walkthroughs on physical iOS/Android development builds covering Knowledge Base and Analytics App questions, Citations, Thread history, hidden/direct-entry behaviour and sign-out. `npm run lint`, `npx tsc --noEmit`, `npm test` pass; refresh typed routes if changed and run `graphify update .`

## Evidence — Android emulator (Pixel 9, Android Studio), 2026-10-02

Not device evidence (see ticket 19 for the full run). Observed signals, recorded instead of assumed:

- **Invalid Agentic Assistant id:** the embed opens Qlik's Answers screen with "No context selected" and no message box; the host sees nothing wrong (token requests are granted), so the app cannot warn. It is Qlik-owned behaviour.
- **Offline:** at load the app shows its own "could not load" screen with Try again; mid-session Qlik's chat shows its own interrupted-request messages.
- **Session expiry / sign-out:** native "Please sign in again" guidance, with Open Settings and Try again.
- **Threads and history:** reopening the Agentic Assistant starts a fresh chat; earlier conversations are listed by Qlik's own history control inside the embed, under the user's account. Classic REST Threads remain a separate list in the classic chat's History.
- **After an app restart:** no Agentic Assistant conversation is visible outside the embed.
- **Not observed:** missing access or entitlement, an unavailable service, Singapore's unavailable contexts, a second Qlik User, Knowledge Base versus Analytics App answer quality on a device, the 20-minute session on a physical device, and anything on iOS.

## Evidence — physical Android phone, 2026-10-02

See ticket 19 for the full run. A 20+ minute session with many questions stayed signed in past the runtime's exchange (Android only; iOS not yet run). After backgrounding for 10+ minutes the first question can fail with Qlik's own "Failed stream call" message and succeeds when asked again — an observed runtime signal the host cannot see, with a possible mitigation (reload the embed on a long resume) not yet decided.

References: [research §10](../research-integration-gaps.md#10-agentic-path--any-supported-route-today), [qlik-embed parameters](https://qlik.dev/embed/qlik-embed/parameters/), [ADR-0007](../adr/0007-no-answer-content-on-device.md).
