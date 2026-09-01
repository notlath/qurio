# 06 — Ask a question and get an answer with citations

**What to build:** The tracer bullet. A question typed on a device creates a Thread, returns a real answer from the real tenant, and renders it with usable citations — deliberately without streaming, so the whole stack is proven end to end before streaming complicates it.

**Blocked by:** Tickets 01 and 05.

**Status:** ready-for-agent

- [ ] Typing a question creates a Thread and renders the returned answer on a device
- [ ] Citations render with their document path and excerpt text, and tapping one resolves to the underlying source document — or, if that route does not work, the limitation is documented with evidence
- [ ] The UI consumes domain types only; no Qlik response shape appears above the adapter, verified by inspection
- [ ] The adapter maps the ticket-01 fixtures correctly in unit tests that run with no network
- [ ] The answer is modelled as a list of blocks, so a future richer answer type does not restructure the UI
- [ ] A loading state is shown while the answer is pending
- [ ] No answer content is written to disk — verified, not assumed
- [ ] Demoable end to end on a physical device
