# 01 — Verify the Assistants API by hand

**What to build:** Prove by hand, against the real Qlik tenant, that the published Assistants API behaves the way the specs say it does — and capture sanitised fixtures that every later ticket builds against and tests with. No application code is written in this ticket.

This exists because ticket 10 deliberately waits for evidence rather than assumptions, and because ticket 7's parser can only be tested against real stream bytes. If this ticket fails, nothing below it matters.

**Blocked by:** None — can start immediately.

**External prerequisite:** a **classic** Assistant must exist over the Knowledge Base. The tenant currently has an *agentic* Assistant, which the published API does not serve. Confirm one exists or have one created before starting.

**Status:** ready-for-agent

- [ ] A Thread is created against the real tenant and its identifier recorded
- [ ] `invoke` returns an answer; the complete raw response is saved verbatim, not summarised
- [ ] The invoke fixture set records: answer output, sources with chunk text (requested with `includeText`), the question echo, the thread identifier, and **any field present on the wire that the published schema does not declare**
- [ ] The interaction identifier is retrieved from the interactions listing sorted newest-first, and it is recorded whether `invoke` itself ever returns one
- [ ] The raw `actions/stream` response body is captured **byte for byte** to a file — object boundaries, partial output fragments, where sources appear in the sequence, whether any completion or error event exists, and whether any terminator is sent
- [ ] An error response is captured deliberately (bad assistant id, malformed body) so the error contract is evidenced rather than assumed
- [ ] Every fixture is sanitised of customer and tenant content and committed as the contract later tickets test against
- [ ] A short written note lists anything observed that contradicts the technical proposal, naming the section it affects
