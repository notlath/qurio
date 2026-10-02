# 18 — Browse Analytics Apps in a native list

**What to build:** A flat Apps-tab list of all Analytics Apps visible to the signed-in Qlik User, most recently updated first, fetched through published Items REST and mapped to a domain type.

**Blocked by:** Ticket [17](17-apps-assistant-settings-tabs.md) (code merged; its device walkthrough is still open and does not gate this ticket). It does not wait on ticket [15](15-record-embedded-auth-spike-outcome.md): the list uses published Items REST over the existing bearer transport.

**Status:** in-progress — implemented and unit-tested; device and real-tenant evidence still open

- [x] Add an `AnalyticsApp` domain type and a list operation through a port, following ADR-0006 while it stands. Agree the minimum fields and pagination seam before implementation; Qlik wire JSON never reaches the screen
  - Agreed and implemented: `AnalyticsApp` is `{ id, name, updatedAt }`. The seam is `listAnalyticsApps({ limit?, cursor? })` on the existing port, returning `{ items, next? }` exactly like `listThreads`; `cursor` is Qlik's whole next href and callers never build one. It lives on `AnswersPort` for now; ticket 22 decides the port's final name and scope
- [x] Native requests use bearer auth and `GET /api/v1/items?resourceType=app&sort=-updatedAt`; no space, favourite or search filtering is added
  - The first request also carries `limit=50`; no space, favourite or search parameter is sent (tested)
- [x] Map `resourceId` as the Analytics App identifier that ticket 20 will later pass to the embed; do not confuse it with the Items record's `id`
- [x] Rows are **not interactive** in this ticket: opening an Analytics App depends on ticket [20](20-open-analytics-app-sheets.md), whose `classic/app` embed is unproven. Rows show name and last-updated only, and the empty-state wording must not promise that an app can be opened
- [ ] Handle pagination so all accessible Analytics Apps can be reached with global update ordering preserved; record the actual list envelope and next-link behaviour using sanitised fixtures
  - Paging works by following the next href and keeps Qlik's order across pages (tested with fixtures). Open: the envelope and next-link behaviour are taken from the published Items API and ticket 01's list shape, not captured from the real tenant, because no sign-in was available. The fixtures say so
- [x] Reuse the existing token/error handling. The current `src/qlik/classic/http.ts` builds Assistant-relative URLs, so make the minimum change needed to address `/api/v1/items` without breaking existing Assistant requests. Any bearer-bearing pagination URL remains within the configured Tenant
  - `assistantUrl` became `qlikUrl`: `/api/` paths root at the Tenant, other relative paths at the Assistant, and an absolute URL is followed only if it starts with the configured tenant origin. This also closes an existing gap: before, any `https://` next href received the bearer token. An off-tenant URL is refused before a token is fetched (tested, including look-alike hosts, credentials in the URL and plain http)
- [ ] Provide loading, empty and actionable error states using ticket 11 conventions. Do not interpret zero Analytics Apps as proof of missing Answers Entitlement, or require Answers Entitlement merely to render this list
  - Implemented on the Apps screen with the shared error component (retry countdown for rate limiting), pull to refresh and an empty state that makes no claim about licences or access. Open: not yet seen on a device
- [x] Distinguish missing configuration, expired session, denied access, rate limiting, offline and service failure when evidence allows; honour retry delays and keep Settings accessible
  - New `AccessDenied` error for a denied Items request; configuration, session, rate limit, offline and service failures reuse the existing kinds. The Items 403 and 404 readings are untested against a real tenant
- [x] Shared HTTP error mapping does not label an Items access failure as missing Assistant access/Answers Entitlement; verify the Analytics App wording against observed statuses
  - Tenant-level 403 → `AccessDenied` (no Answers wording); 404 → `ServiceUnavailable`. Open: verify the wording against statuses observed on a real tenant
- [ ] List content is memory-only and is discarded on sign-out or Tenant change; no offline cache is introduced
  - Implemented: the list is held against the current port, nothing is stored, and sign-in/sign-out and a Tenant change build a new port, which discards it. Open: not exercised on a device, and the screen has no automated test (no component-test setup)
- [x] The web preview uses Analytics App fixtures and cannot reach live Items REST
- [x] Tests cover URL/sort construction, identifier mapping, multiple pages, empty results, representative errors and the fixture/platform boundary; existing Assistant transport tests still pass
- [ ] Evidence: a low-privilege Qlik User sees only accessible Analytics Apps, correctly ordered across pages; loading/empty/error demonstrations and `npm run lint`, `npx tsc --noEmit`, `npm test` pass
  - Done so far: `npm run lint`, `npx tsc --noEmit` and `npm test` pass (184 tests); the web export renders. Open: a low-privilege user on a device against a real tenant, and the loading/empty/error demonstrations

**Decide during:** What the Apps tab shows when the Qlik User has zero Analytics Apps, including wording and any administrator guidance. Provisional wording is in place — "No Analytics Apps to show. Apps you have access to in Qlik will appear here." — chosen because it claims nothing about licences or access; it still needs agreement. Do not add search, spaces or favourites to solve it.

References: [ADR-0006](../adr/0006-domain-port-with-qlik-adapter.md), [ticket 11](11-error-states-busy-state.md), [Items REST documentation](https://qlik.dev/apis/rest/items/).
