# Ticket 9 — status

Covers [docs/poc-tickets/09-answer-feedback.md](../../09-answer-feedback.md). Like ticket 8, this is
almost entirely buildable and demoable against the fixture port — no live device or session needed for
the UI/state behaviour itself, since `submitFeedback` and the `Feedback`/`FeedbackReason` domain types
already existed (ticket 2) and already matched the real API shape confirmed in ticket 1's research
(technical-proposal.md:95).

## Done

- Port-level test added for `submitFeedback` (existed since ticket 2, never tested until now, same
  pattern as `deleteThread` before ticket 8): attaches feedback to the *correct* interaction only when
  a thread has more than one, verified by re-fetching via `listInteractions` — this was already correct,
  confirmed green on the first run. Also added: rejects an unknown interaction id.
- Feedback control added to `InteractionRow`: "Helpful" submits immediately; "Not helpful" reveals a
  reason picker built from the real `FeedbackReason` values plus an optional comment, then an explicit
  Submit. Selection is set *before* the network call resolves and is never reverted on failure — the
  actual requirement, not just belief in the code: verified live by triggering a real failure (a
  fixture-only `comment === 'FAIL'` sentinel, documented in `port.ts`, never a real API behavior) and
  confirming the answer, the reason selection, and the form all stayed exactly as the user left them,
  with an error message alongside.
- "Previously submitted feedback is reflected when reopening the Thread" — verified live, not just by
  inspection: submitted feedback on a Thread, navigated to History and back in via real link clicks (see
  note below on why that distinction mattered), and the reopened Thread showed "You marked this
  helpful." immediately.

## A testing-methodology note, not an app bug

Early attempts to verify "reflected on reopen" kept failing — feedback appeared to reset on every
navigation. Traced it to this environment's `navigate` tool (used for typed URLs): with
`app.json`'s `"web": { "output": "static" }`, a real URL navigation is a full page load, which resets
the in-memory fixture port entirely — expected and correct given ADR-0007, not a bug. Real in-app
`Link` clicks (via the browser tool's synthetic `left_click`, matching how an actual user interacts) are
intercepted client-side as they should be, preserving state — confirmed separately by other now-known
runtime data ("New thread" persisting across the same navigation) staying present across the same
click-only navigation. Once verification used only real link clicks and never the URL-navigate tool
mid-flow, reopen persistence showed correctly.

## Blocked

| Checklist item | Status |
|---|---|
| Positive/negative feedback submits against a real answer, with a real reason and comment | Code does this against fixtures; not exercised against a live tenant — needs ticket 5's device access |
| Attaches to the correct interaction id **recovered by reconciliation** | The *mechanism* (fixed to a known interaction id, verified by re-fetch) is tested; the actual reconciliation step (`invoke`/`stream` → `listInteractions` to recover the id, per ticket 1 fixture 04) isn't wired yet — it's part of the live adapter deferred since ticket 6 |

Nothing else is blocked — this ticket didn't have a live-only measurement requirement like tickets 5 or
7 did.
