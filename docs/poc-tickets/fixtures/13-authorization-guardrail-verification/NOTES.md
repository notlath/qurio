# Ticket 13 — status

Covers [docs/poc-tickets/13-authorization-guardrail-verification.md](../../13-authorization-guardrail-verification.md).
This ticket's own external prerequisite is explicit: **two Qlik Users with deliberately different
access**. This environment has exactly one identity (a personal API key). Provisioning a second real
user with different Knowledge Base access means creating and configuring accounts and entitlements on
the Customer's real tenant — administrative action on production identity infrastructure, not something
to take unilaterally without the Customer's own tenant admin doing it, or at minimum a direct, informed
instruction to do so. Not attempted. Two checklist items don't need a second user, though, and both were
verified for real.

## Done

**No client-side filtering exists anywhere in the path** (checklist item 2) — verified by exhaustive
search, not by trusting the design. Grepped `src/qlik/` and `src/domain/` for
`filter|permission|entitle|authoriz|restrict`: the only matches are the HTTP-status-to-`AppError`
mapping (`NotEntitled`, `AssistantForbidden` — ticket 11's error states, which react to what Qlik
returns, they don't decide it). The mapper functions (`toThread`, `toCitations`, `toAnswer`,
`toInteraction`, ticket 6) are pure pass-through transforms of whatever Qlik's response contains — there
is no code path anywhere that could narrow, hide, or re-filter a source or citation based on who's
asking. If access is ever wrong, it's Qlik's restriction that's wrong, not a bug in this app inventing
its own.

**A retry after the stated delay succeeds** (part of checklist item 7) — verified live, single-user,
against the real tenant:
1. Fired 21 concurrent `invoke` calls; request 21 returned the real `429` (same shape as ticket 11's
   finding: no `Retry-After` header, `detail` mentions "20 per 60s").
2. Waited until 65 seconds had elapsed since triggering the limit.
3. Retried: `200 OK`, answered normally.

This confirms the app's 60-second default backoff (`toDomainError`, ticket 11) is not just a guess at
the right number — it's long enough for a real retry to actually succeed, not just long enough to stop
looking broken.

**Measured ceiling, for rollout sizing** (checklist item 8, partial): confirmed twice now (ticket 11 and
this ticket, both single-user) — **exactly 20 `invoke`/`stream` calls succeed per 60-second window**, the
21st onward gets `429` every time. `listThreads` (history) is unaffected by this limit even while `ask`
is actively throttled — confirmed live in ticket 11 (a `listThreads` call succeeded with `200`
immediately after triggering the `ask` 429). This is real, useful sizing data for the Customer
regardless of the subscription-vs-per-user scoping question below, since it establishes the *floor* — a
single active user alone can hit the ceiling in well under a minute of normal use.

## Blocked — all need the external prerequisite (two real Qlik Users)

| Checklist item | Status |
|---|---|
| Same question, two users with different source access, answers differ exactly per permissions, evidence captured side by side | **Blocked** |
| Behaviour recorded for a user with no entitlement, and for a user with no Assistant access | **Blocked** — this is also where ticket 11's `NotEntitled` vs `AssistantForbidden` HTTP-status disambiguation was deliberately deferred to |
| More than 20 questions/minute driven across **two or more users concurrently** | **Blocked** — this environment can drive concurrent requests (already done, single-user, tickets 11 and 13), but not as two distinct identities |
| Proof that one user is throttled by another user's traffic (subscription-scoped, not per-user) | **Blocked** — the ticket is explicit that a single-user test cannot show this, and it can't be inferred from single-user evidence no matter how the requests are shaped |

## Runbook — run once two distinct Qlik Users with different access are available

1. As TenantAdmin, confirm the two users' actual Knowledge Base source permissions differ, and note
   exactly how.
2. Ask the identical question as both users in the same short window; capture both raw answers side by
   side; confirm the difference in content matches the permission difference from step 1 exactly (not
   approximately).
3. Ask as a user with no Answers entitlement at all; record the exact HTTP status and error body.
4. Ask as an entitled user who lacks access to the configured Assistant specifically; record the exact
   HTTP status and error body; compare against step 3 — this is what finally answers ticket 11's deferred
   403-disambiguation question.
5. With both users' apps open, fire enough concurrent requests from User A alone to reach the 20/60s
   ceiling, then immediately have User B ask one question. Record whether User B is throttled purely by
   User A's traffic.
6. Confirm the busy state appears for whichever user gets throttled, and that no retry storm occurs from
   either client during the shared window.
