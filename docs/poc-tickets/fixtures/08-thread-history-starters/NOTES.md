# Ticket 8 — status

Covers [docs/poc-tickets/08-thread-history-starters.md](../../08-thread-history-starters.md). Unlike
tickets 3/5/6/7, almost all of this ticket is buildable and demoable against the fixture port — no live
device or session needed for the UI/state behaviour itself.

## Done

- [`src/qlik/fixtures/pagination.ts`](../../../src/qlik/fixtures/pagination.ts) — pure `paginate()`,
  unit-tested (first page + cursor, continuing from a cursor, last page has no cursor, no-options
  default). Wired into the fixture port's `listThreads`, replacing the old "return everything" stub —
  needed for "scrolling loads older pages" to be demoable against something real rather than a fake
  that always returns one page.
- History screen: real infinite scroll via `onEndReached`, delete (calls `port.deleteThread`, confirmed
  by a new port-level test since it had been implemented but never tested since ticket 2), navigates to
  a new `thread/[id]` route.
- New `src/app/thread/[id].tsx` — opens a past Thread, restores its interactions and citations, and is
  genuinely resumable (the question input keeps working, reusing the same ask/stream/stop logic as the
  new-Thread screen via the shared `useThreadConversation` hook and `InteractionRow` component, both
  extracted from `src/app/index.tsx` this ticket).
- Starters wired into the new-Thread screen (deliberately left undone in ticket 2 for this ticket):
  shown when a thread has no interactions yet, tapping one asks it.
- Verified in the browser: 14 seeded threads paginate across 3 pages of 5 while scrolling; a resumed
  thread shows its prior Q&A and citations, and a follow-up question in that thread works; delete
  removes a thread from the list without navigating away; starters ask correctly with citations.

## Two real bugs found and fixed during this pass (not ticket-8-specific, but ticket-8's testing surfaced them)

1. **`ThreadDetailScreen` initially discarded the seeded interactions.** `useThreadConversation`'s
   `useState(initialInteractions)` only reads its initial-value argument on a component's first render.
   Since the parent called the hook on the very first render — before `getThread` had resolved — the
   hook locked in `[]` forever, even once real data arrived on a later render. Fixed by only mounting
   the conversation UI (a fresh component, fresh hook state) once `detail` is loaded, instead of calling
   the hook eagerly with a placeholder.
2. **Delete silently didn't delete — it navigated to the thread instead.** Delete was a `Pressable`
   nested inside the row's `Link`-wrapped `Pressable` (which renders as an anchor on web). Its
   `e.stopPropagation()` stopped React's synthetic event bubbling but not the anchor's native
   navigation, which needs `preventDefault()` (or, better, no nesting at all). Fixed by restructuring so
   Delete is a sibling of the link, not a descendant — also resolves nested-interactive-element
   accessibility concerns for free.

## Blocked

| Checklist item | Status |
|---|---|
| Deleting a Thread stays gone after a relaunch | Works today because nothing persists across a fixture-port reload at all — that's not a meaningful test of the real requirement. Against a real backend, relaunch correctness depends on delete actually being a server-side `DELETE`, which needs the live adapter (deferred since ticket 6) |
| Recorded: whether thread listing returns only the signed-in user's Threads | **Not observed** — needs a live tenant and at least two distinct signed-in users to compare; blocked on ticket 5's device access |

## Not pursued: auto-loading more pages when the first page doesn't fill the screen

Went further than the ticket asked and tried to also auto-load additional pages when a short list
doesn't overflow the viewport (so `onEndReached` would never otherwise fire). Implemented via
`onLayout`/`onContentSizeChange`, but ran into a real measurement ambiguity in this environment's
browser-automation tooling (`window.innerHeight` reporting `0` until an explicit resize, and a
content-container `flexGrow` interaction that made "how tall is the content really" unverifiable without
more time than the enhancement — which the ticket never asked for — justified). Reverted to the
standard `onEndReached`-only pattern, which is what the checklist literally asks for ("scrolling loads
older pages") and is proven working. Worth revisiting if a real device shows a short list getting stuck
un-scrollable in practice.
