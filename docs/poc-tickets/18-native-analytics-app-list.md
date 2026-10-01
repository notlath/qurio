# 18 — Browse Analytics Apps in a native list

**What to build:** A flat Apps-tab list of all Analytics Apps visible to the signed-in Qlik User, most recently updated first, fetched through published Items REST and mapped to a domain type.

**Blocked by:** Ticket [17](17-apps-assistant-settings-tabs.md). It does not wait on ticket [15](15-record-embedded-auth-spike-outcome.md): the list uses published Items REST over the existing bearer transport.

**Status:** blocked

- [ ] Add an `AnalyticsApp` domain type and a list operation through a port, following ADR-0006 while it stands. Agree the minimum fields and pagination seam before implementation; Qlik wire JSON never reaches the screen
- [ ] Native requests use bearer auth and `GET /api/v1/items?resourceType=app&sort=-updatedAt`; no space, favourite or search filtering is added
- [ ] Map `resourceId` as the Analytics App identifier that ticket 20 will later pass to the embed; do not confuse it with the Items record's `id`
- [ ] Rows are **not interactive** in this ticket: opening an Analytics App depends on ticket [20](20-open-analytics-app-sheets.md), whose `classic/app` embed is unproven. Rows show name and last-updated only, and the empty-state wording must not promise that an app can be opened
- [ ] Handle pagination so all accessible Analytics Apps can be reached with global update ordering preserved; record the actual list envelope and next-link behaviour using sanitised fixtures
- [ ] Reuse the existing token/error handling. The current `src/qlik/classic/http.ts` builds Assistant-relative URLs, so make the minimum change needed to address `/api/v1/items` without breaking existing Assistant requests. Any bearer-bearing pagination URL remains within the configured Tenant
- [ ] Provide loading, empty and actionable error states using ticket 11 conventions. Do not interpret zero Analytics Apps as proof of missing Answers Entitlement, or require Answers Entitlement merely to render this list
- [ ] Distinguish missing configuration, expired session, denied access, rate limiting, offline and service failure when evidence allows; honour retry delays and keep Settings accessible
- [ ] Shared HTTP error mapping does not label an Items access failure as missing Assistant access/Answers Entitlement; verify the Analytics App wording against observed statuses
- [ ] List content is memory-only and is discarded on sign-out or Tenant change; no offline cache is introduced
- [ ] The web preview uses Analytics App fixtures and cannot reach live Items REST
- [ ] Tests cover URL/sort construction, identifier mapping, multiple pages, empty results, representative errors and the fixture/platform boundary; existing Assistant transport tests still pass
- [ ] Evidence: a low-privilege Qlik User sees only accessible Analytics Apps, correctly ordered across pages; loading/empty/error demonstrations and `npm run lint`, `npx tsc --noEmit`, `npm test` pass

**Decide during:** What the Apps tab shows when the Qlik User has zero Analytics Apps, including wording and any administrator guidance. Agree this before implementing the empty state; do not add search, spaces or favourites to solve it.

References: [ADR-0006](../adr/0006-domain-port-with-qlik-adapter.md), [ticket 11](11-error-states-busy-state.md), [Items REST documentation](https://qlik.dev/apis/rest/items/).
