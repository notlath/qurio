# 13 — Authorization and guardrail verification

**What to build:** Prove the two assumptions the whole architecture rests on: that authorization is Qlik's job and the app never substitutes its own, and that the subscription-wide question guardrail behaves the way the busy state assumes.

The authorization criteria depend only on a working request path and should be run as early as possible. The guardrail criteria need the busy state to exist.

**Blocked by:** Ticket 06 for the authorization criteria; ticket 11 for the rate-limit criteria.

**External prerequisite:** two Qlik Users with deliberately different access to the Knowledge Base sources.

**Status:** ready-for-agent

- [ ] **Authorization (needs 06):** the same question asked by two users with different source access returns answers that differ exactly as their permissions dictate, captured side by side as evidence
- [ ] **Authorization:** the restriction is demonstrably enforced by Qlik — no client-side filtering exists anywhere in the path
- [ ] **Authorization:** behaviour is recorded for a user with no Answers entitlement at all, and for a user with no access to the configured Assistant
- [ ] **Guardrail (needs 11):** more than twenty questions per minute are driven across **two or more users concurrently**, and the rate-limit response with its retry delay is observed
- [ ] **Guardrail:** it is demonstrated that one user is throttled by another user's traffic — proving the limit is subscription-scoped, not per user. A single-user test cannot show this and does not satisfy this criterion
- [ ] **Guardrail:** history browsing still succeeds while asking is throttled
- [ ] **Guardrail:** the busy state appears, a retry after the stated delay succeeds, and no retry storm occurs
- [ ] The measured ceiling is written up for rollout sizing and shared with the Customer
