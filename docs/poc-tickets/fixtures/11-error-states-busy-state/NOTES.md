# Ticket 11 — status

Covers [docs/poc-tickets/11-error-states-busy-state.md](../../11-error-states-busy-state.md).

## Real finding: the live tenant sends no `Retry-After` header

Verified via curl against the real tenant (same approach as tickets 1/10 — no device needed, doesn't
require PKCE): fired 25 concurrent `invoke` calls against one thread. Exactly 20 succeeded, requests 21
onward all returned:

```
HTTP/1.1 429 Too Many Requests
Content-Type: application/json
(no Retry-After header)

{"errors":[{"code":"AE-6","status_code":429,"title":"API usage rate limit is exceeded","detail":"This question is over the limit of 20 per 60s. Please try again later","origin":"assistants-executor"}]}
```

This directly confirms the documented "20 assistant questions per minute per subscription" ceiling
(technical-proposal.md:604), but contradicts the plan to "honour the retry delay the API returns"
(ticket 11's own checklist item 4) via a header — there isn't one, only a human-readable `detail`
string with no machine-parseable delay. `toDomainError` defaults `RateLimited.retryAfterMs` to 60
seconds (the confirmed window) when no `Retry-After` header is present, while still honouring one if a
future API version adds it.

**Also confirmed live**: immediately after triggering the 429 on `actions/invoke`, `GET
.../threads?limit=5` (list) succeeded with `200` — proving asking and browsing really are on different
rate tiers, directly satisfying checklist item 5 without needing simulation for that specific claim.

## Done

- [`src/qlik/classic/errors.ts`](../../../src/qlik/classic/errors.ts) — `toDomainError` (HTTP status →
  `AppError`, all 8 checklist states except the 403 split — see below) and `classifyFetchFailure`
  (network throw → `Offline`, distinct from an intentional abort, which ticket 7 already owns).
  Unit-tested, including the real 429/no-header finding above.
- [`src/domain/error-messages.ts`](../../../src/domain/error-messages.ts) — `errorMessageFor`, the only
  thing allowed to reach the screen: curated title/message/`canRetry` per state, admin-contact copy for
  every non-retryable one. Unit-tested for all 8 states.
- **A real bug found and fixed while wiring this in**: `handleAsk` cleared the typed question
  immediately, before knowing whether `ask()` would even succeed, and the pending-question display
  disappeared the moment `asking` flipped false — so a failure silently dropped whatever the user had
  typed, violating this ticket's own requirement. Fixed by moving `question` state into
  `useThreadConversation` itself: cleared only once committed to asking, restored verbatim on any
  failure. Verified live, not just by inspection — typed a simulated-error trigger, confirmed the exact
  text was still sitting in the input box after the failure.
- [`src/components/error-state.tsx`](../../../src/components/error-state.tsx) — renders
  `errorMessageFor`'s copy, a Retry action gated behind a live countdown for `RateLimited` (never an
  auto-retry loop — retrying is always an explicit tap once the countdown reaches zero), and Dismiss.
  Verified live: `RateLimited` showed "Retry in 9s" counting down, then a plain enabled "Retry" once
  elapsed, no auto-retry ever fired; `Offline` showed an immediately-enabled Retry; `NotEntitled` showed
  no Retry button at all (non-retryable, per `canRetry: false`).
- Simulated triggers wired into the fixture port (`ask("ERROR:<Kind>")` throws that `AppError` instead
  of answering — a fixture-only convention, documented in `port.ts`, never a real API behavior) — this
  is what ticket 11 itself calls out as an acceptable way to reach every state ("by simulation").
- Settings' `ConfigMissing` display now uses `errorMessageFor` instead of a separate hand-written
  string, so it's the same curated copy everywhere rather than two slightly-different messages for the
  same state.

## Blocked

| Checklist item | Status |
|---|---|
| Distinguishing `NotEntitled` from `AssistantForbidden` by HTTP status, with the statuses recorded | **Explicitly ticket 13's job** (re-read its own doc to confirm) — needs two real Qlik Users with deliberately different access, which this environment can't produce. `toDomainError` maps 403 → `NotEntitled` as the documented default (technical-proposal.md:486); `AssistantForbidden` exists in the type and in `errorMessageFor`, ready for ticket 13's second-call disambiguation to select between them |
| Session expiry attempts one silent refresh, then interactive re-authentication | The **state and message** exist (`SessionExpired`, retryable, "sign in again"); the actual silent-refresh-then-interactive-reauth *mechanism* needs real auth wired into the ask flow, which doesn't exist yet — the app still runs on the fixture port (deferred since ticket 6). Building a fake refresh step now would be simulating a flow that has no real counterpart to attempt |
| Multi-user proof that one user's traffic throttles another (subscription-scoped, not per-user) | Explicitly ticket 13's job, needs two concurrent real users |

Everything else — distinct states, actionable non-generic messages, the busy state with a non-aggressive
retry, throttled-asking-doesn't-block-history, offline-vs-tenant-failure, no raw errors on screen,
evidence by simulation — is done and verified above.
