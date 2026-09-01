# 10 — Answer rendering subset

**What to build:** An evidence-gathering and decision ticket, not a UI ticket. Capture what Qlik actually emits, catalogue it, then implement only what is there.

**Blocked by:** Ticket 07.

**Status:** ready-for-agent

- [ ] A corpus of real answers is captured across question types — lists, tables, code, links, very long answers, and questions the Assistant cannot or will not answer
- [ ] The corpus is sanitised, committed, and catalogued: which formatting constructs actually appear, and how often
- [ ] The decision is recorded in writing — render a subset in-house, or take a dependency — with the reasoning and the evidence behind it
- [ ] Only the constructs evidenced in the corpus are implemented
- [ ] An unrecognised construct degrades to readable text; raw markup is never shown to a user
- [ ] Rendering is tested against the captured corpus
