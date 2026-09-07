# Ticket 7 — status

Covers [docs/poc-tickets/07-streaming-stop-recovery.md](../../07-streaming-stop-recovery.md). Same split
as ticket 6: the parser and stream-lifecycle logic don't need a live device and are built + tested; the
real `expo/fetch` network call and on-device `AppState` behaviour do need one and aren't built, since
there's still no live transport in the app for them to drive (ticket 6 deferred that for the same reason).

## Done

- [`src/qlik/classic/stream-parser.ts`](../../../src/qlik/classic/stream-parser.ts) — `takeObjects`,
  unit-tested: concatenated objects with no delimiter (fixture 05's shape), an object split across two
  reads, a literal `}{` inside answer text, a truncated tail, and a real-scale 91-object stream matching
  fixture 10's structure. All five are the ticket's own named checklist item.
- [`src/qlik/classic/stream-session.ts`](../../../src/qlik/classic/stream-session.ts) — `consumeStream`,
  the accumulate/stop/truncate state machine from technical-proposal.md §6's `streamAnswer`, factored to
  take an injected reader so it's testable without a network. Unit-tested: delta accumulation, **stop
  preserves the partial answer** without pulling further reads, a truncated tail (connection closes
  mid-object, not user-initiated) throws `ServiceUnavailable`, a clean end does not throw.
- Progressive rendering and Stop wired into [`src/app/index.tsx`](../../../src/app/index.tsx) and the
  fixture port ([`src/qlik/fixtures/port.ts`](../../../src/qlik/fixtures/port.ts)), which now delivers
  its canned answer word-by-word with simulated latency instead of in one shot. Verified in the browser:
  a question mid-stream shows the answer growing word by word; tapping Stop mid-stream ends the
  interaction immediately with exactly the words delivered so far as its permanent answer — not the full
  text, not deleted, not an error.

## Blocked

| Checklist item | Status |
|---|---|
| Answers render progressively **on both platforms** | Mechanism built and proven in the web preview; native on-device rendering unverified — needs a dev-client build (ticket 3), still unavailable |
| Backgrounding mid-answer aborts the stream; foreground reconciles and shows the completed answer | Not built — needs a live transport to abort and a live tenant to reconcile against; wiring `AppState` now would be untestable glue with no real consumer |
| Recorded: whether aborting the client cancels Qlik's server-side processing | **Not measured** — needs a live stream to abort mid-flight against a real tenant |
| Recorded: whether the Interaction is still persisted when the client disconnects | **Not measured** — same reason |
| Interaction id recovered after every completed answer | The mapping (`toInteraction`, ticket 6) is already correct for this; the live reconciliation call itself (`invoke`/`stream` then `listInteractions`, per ticket-01 fixture 04's confirmed pattern) isn't wired yet — no live transport to call it from |

## Runbook — run once a dev-client build and a live session exist

1. Ask a real question against the real tenant; confirm the answer renders progressively on both iOS
   and Android, not just resolved answer.
2. Tap Stop mid-stream. Confirm the partial answer stays visible (not replaced with an error, not
   cleared) and record what `GET .../interactions` shows for that thread immediately after — was the
   Interaction persisted server-side even though the client aborted?
3. Background the app mid-answer. Confirm the stream aborts client-side (no zombie connection), then
   foreground and confirm the app reconciles via `listInteractions` and shows the completed answer.
4. Force a truncated stream (e.g. kill network mid-response) and confirm the UI shows a
   service-unavailable state — never a partial answer presented as if it were complete.
5. Record measured findings replacing the two "Not measured" rows above.
