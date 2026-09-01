# 11 — Error states and the busy state

**What to build:** Every failure resolves to a distinct, actionable screen. This is where the subscription-wide question guardrail stops being an error and becomes an expected, retryable condition.

**Blocked by:** Ticket 06.

**Status:** ready-for-agent

- [ ] Each failure resolves to its own state: configuration missing, no Answers entitlement, no access to this Assistant, assistant not found, session expired, rate-limited or busy, service unavailable, offline
- [ ] Every message says what happened, whether the user can fix it, and who to contact
- [ ] Lack of entitlement is distinguished from lack of access to the Assistant using the published user and item surfaces; **which HTTP statuses actually appear for each is recorded**
- [ ] A rate-limit response produces a retryable busy state, honours the retry delay the API returns, and does not retry aggressively
- [ ] Throttled asking does not block history browsing, since the two use different rate tiers
- [ ] Session expiry attempts one silent refresh, then interactive re-authentication, without losing the question the user had typed
- [ ] Being offline is distinguished from the tenant failing
- [ ] No raw API errors, tenant internals or identifiers reach the screen
- [ ] Evidence: each state is reached in a demo, by simulation or by forcing the real condition
