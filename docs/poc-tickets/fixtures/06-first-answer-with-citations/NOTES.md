# Ticket 6 — status

Covers [docs/poc-tickets/06-first-answer-with-citations.md](../../06-first-answer-with-citations.md).
Per the confirmed scope, this pass builds and tests the classic adapter's **mapping layer** only — the
app keeps using the fixture port (as it has since ticket 2). The network-calling half of the adapter
(real `fetch` calls against `/threads`, `/actions/invoke`) is separate work for whichever ticket first
has a live signed-in session to exercise it against — nothing here blocks writing it, it just wasn't
built now to avoid a half-finished, unverifiable `AnswersPort` implementation.

## Done

- [`src/qlik/classic/mappers.ts`](../../../src/qlik/classic/mappers.ts) — `toThread`, `toCitations`,
  `toAnswer`, `toInteraction`, unit-tested against ticket 1's real captured fixtures (02, 03, 04, 09) —
  the ticket's own explicit checklist item ("the adapter maps the ticket-01 fixtures correctly in unit
  tests that run with no network").
- Citation rendering in [`src/app/index.tsx`](../../../src/app/index.tsx): document path + excerpt(s)
  under a "Sources" heading, wired against fixture data extended to include a citation-bearing answer.
- A visible loading state (question appears immediately with a spinner where the answer will land) —
  confirmed in the browser by catching the fixture port's simulated 300ms latency mid-flight.
- Verified by inspection: `src/app/index.tsx` imports only `@/domain` types and the `useAnswersPort`
  hook — never a Qlik wire shape or the mapper module directly (ADR-0006). No answer content is written
  to any persistent store — `AsyncStorage` (ticket 4) holds only dev tenant config, `SecureStore`
  (ticket 5) holds only tokens; neither ever sees an `Interaction` or `Answer` (ADR-0007).

## Blocked

| Checklist item | Status |
|---|---|
| Typing a question creates a Thread and renders the answer **on a device** | Blocked — needs a dev-client build (ticket 3) and a signed-in session (ticket 5), neither available |
| Citation tap-through resolves to the source document | **Unverifiable, not just unbuilt.** Every wire shape ticket 1 captured (`source`, `documentId`, `datasourceId`, `knowledgebaseId`) is an opaque identifier or a bare filename — none is a URL, and nothing in the published Assistants API spec offers a "resolve this citation" endpoint. Citations are rendered read-only (no tap target) rather than a link to nowhere. This is the ticket's own documented-limitation escape hatch, not a gap to close later without new evidence — closing it would need a live tenant session to find whatever route (if any) actually resolves a `documentId` to a viewable document. |
| Demoable end to end on a physical device | Blocked, same as row 1 |

## Not yet needed, flagged for whoever builds the live adapter

- `ask()`'s real implementation will need interaction-id reconciliation the same way streaming does
  (ticket 1 confirmed `invoke` never returns an `id`): call `invoke`, then `listInteractions` sorted
  newest-first, map the first item with `toInteraction`. `toInteraction` is already built and tested
  for exactly this.
- `Citation.documentPath` currently maps 1:1 from Qlik's `source` field (a bare filename like
  `"Q3-Handbook.pdf"`) — if a resolvable document URL is ever found, it belongs on the domain `Citation`
  type as a new optional field, not a repurposing of `documentPath`.
