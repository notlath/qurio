# 09 — Feedback on an answer

**What to build:** A user can rate a specific answer, which validates a distinct Qlik capability and the interaction-identifier flow that carries it.

**Blocked by:** Ticket 07.

**Status:** ready-for-agent

- [ ] Positive and negative feedback can be submitted against a specific answer, with a reason drawn from the values the API actually accepts and an optional comment
- [ ] Feedback uses the interaction identifier recovered by reconciliation, and is verified to attach to the correct interaction by re-fetching it
- [ ] Previously submitted feedback is reflected when the Thread is reopened
- [ ] A failed submission loses neither the answer nor the user's selection
